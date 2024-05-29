import { createDeferred } from '@trezor/utils';
import { v1 as v1Protocol, thp as thpProtocol } from '@trezor/protocol';

import {
    AbstractTransport,
    AbstractTransportParams,
    AbstractTransportMethodParams,
} from './abstract';
import { AbstractApi } from '../api/abstract';
import { buildMessage, createChunks, sendChunks } from '../utils/send';
import { sendThpMessage, receiveThpMessage, parseThpMessage } from '../thp';
import { receiveAndParse } from '../utils/receive';
import { SessionsClient } from '../sessions/client';
import * as ERRORS from '../errors';

interface ConstructorParams extends AbstractTransportParams {
    api: AbstractApi;
    sessionsClient: (typeof SessionsClient)['prototype'];
}

/**
 * Abstract class for transports with abstract api (webusb, nodeusb, udp, react-native).
 */
export abstract class AbstractApiTransport extends AbstractTransport {
    // sessions client is a standardized interface for communicating with sessions backend
    // which can live in couple of context (shared worker, local module, websocket server etc)
    private sessionsClient: ConstructorParams['sessionsClient'];
    protected api: AbstractApi;

    constructor({ messages, api, sessionsClient, signal, logger }: ConstructorParams) {
        super({ messages, signal, logger });
        this.sessionsClient = sessionsClient;
        this.api = api;
    }

    public init() {
        return this.scheduleAction(async () => {
            const handshakeRes = await this.sessionsClient.handshake();
            this.stopped = !handshakeRes.success;

            return handshakeRes.success
                ? this.success(undefined)
                : this.unknownError('handshake error', []);
        });
    }

    public listen() {
        if (this.listening) {
            return this.error({ error: ERRORS.ALREADY_LISTENING });
        }

        this.listening = true;

        // 1. transport api reports descriptors change
        this.api.on('transport-interface-change', descriptors => {
            this?.logger?.debug('new descriptors from api', descriptors);
            // 2. we signal this to sessions background
            this.sessionsClient.enumerateDone({
                descriptors,
            });
        });
        // 3. based on 2.sessions background distributes information about descriptors change to all clients
        this.sessionsClient.on('descriptors', descriptors => {
            this?.logger?.debug('new descriptors from background', descriptors);
            // 4. we propagate new descriptors to higher levels
            this.handleDescriptorsChange(descriptors);
        });

        return this.success(undefined);
    }

    public enumerate() {
        return this.scheduleAction(async signal => {
            // todo: consider doing await this.sessionsClient.enumerateIntent() here
            // it looks like Webusb does not need it is not needed at least on macos.

            // enumerate usb api
            const enumerateResult = await this.api.enumerate(signal);

            if (!enumerateResult.success) {
                return enumerateResult;
            }
            // partial descriptors with path
            const descriptors = enumerateResult.payload;

            // inform sessions background about occupied paths and get descriptors back
            const enumerateDoneResponse = await this.sessionsClient.enumerateDone({
                descriptors,
            });

            return this.success(enumerateDoneResponse.payload.descriptors);
        });
    }

    public acquire({ input }: AbstractTransportMethodParams<'acquire'>) {
        return this.scheduleAction(
            async signal => {
                const { path } = input;

                if (this.listening) {
                    this.listenPromise[path] = createDeferred();
                }

                const acquireIntentResponse = await this.sessionsClient.acquireIntent(input);

                if (!acquireIntentResponse.success) {
                    return this.error({ error: acquireIntentResponse.error });
                }

                this.acquiredUnconfirmed[path] = acquireIntentResponse.payload.session;

                const reset = !!input.previous;
                const openDeviceResult = await this.api.openDevice(path, reset, signal);

                if (!openDeviceResult.success) {
                    if (this.listenPromise[path]) {
                        this.listenPromise[path].resolve(openDeviceResult);
                    }

                    return openDeviceResult;
                }

                this.sessionsClient.acquireDone({ path });

                if (!this.listenPromise[path]) {
                    return this.success(acquireIntentResponse.payload.session);
                }

                return this.listenPromise[path].promise.finally(() => {
                    delete this.listenPromise[path];
                });
            },
            undefined,
            [ERRORS.DEVICE_DISCONNECTED_DURING_ACTION, ERRORS.SESSION_WRONG_PREVIOUS],
        );
    }

    public release({ path, session, onClose }: AbstractTransportMethodParams<'release'>) {
        return this.scheduleAction(async () => {
            if (this.listening) {
                this.releaseUnconfirmed[path] = session;
                this.listenPromise[path] = createDeferred();
            }
            const releaseIntentResponse = await this.sessionsClient.releaseIntent({
                session,
            });

            if (!releaseIntentResponse.success) {
                return this.error({ error: releaseIntentResponse.error });
            }

            const releasePromise = this.releaseDevice(releaseIntentResponse.payload.path);
            if (onClose) return this.success(undefined);

            await releasePromise;

            await this.sessionsClient.releaseDone({
                path: releaseIntentResponse.payload.path,
            });

            if (!this.listenPromise[path]) {
                return this.success(undefined);
            }

            return this.listenPromise[path].promise
                .then(() => this.success(undefined))
                .finally(() => {
                    delete this.listenPromise[path];
                });
        });
    }

    public call({
        session,
        name,
        data,
        protocol: customProtocol,
        protocolState,
    }: AbstractTransportMethodParams<'call'>) {
        return this.scheduleAction(
            async signal => {
                const getPathBySessionResponse = await this.sessionsClient.getPathBySession({
                    session,
                });
                if (!getPathBySessionResponse.success) {
                    // session not found means that device was disconnected
                    if (getPathBySessionResponse.error === 'session not found') {
                        return this.error({ error: ERRORS.DEVICE_DISCONNECTED_DURING_ACTION });
                    }

                    return this.error({ error: ERRORS.UNEXPECTED_ERROR });
                }
                const { path } = getPathBySessionResponse.payload;

                try {
                    const protocol = customProtocol || v1Protocol;
                    const bytes = buildMessage({
                        messages: this.messages,
                        name,
                        data,
                        protocol,
                        protocolState,
                    });
                    const chunks = createChunks(
                        bytes,
                        protocol.getChunkHeader(bytes),
                        this.api.chunkSize,
                    );

                    const apiWrite = (chunk: Buffer, attemptSignal?: AbortSignal) =>
                        this.api.write(path, chunk, attemptSignal || signal);
                    const apiRead = (attemptSignal?: AbortSignal) =>
                        this.api.read(path, attemptSignal || signal);

                    console.warn('Bytes to send', bytes.toString('hex'));

                    if (protocol.name === 'v2') {
                        await sendThpMessage({
                            protocolState,
                            chunks,
                            apiWrite,
                            apiRead,
                            signal,
                        });

                        const decoded = await receiveThpMessage({
                            protocolState,
                            apiWrite,
                            apiRead,
                            signal,
                        });

                        const message = parseThpMessage({
                            messages: this.messages,
                            decoded,
                            protocolState,
                        });

                        return this.success(message);
                    }

                    const sendResult = await sendChunks(chunks, apiWrite);
                    if (!sendResult.success) {
                        throw new Error(sendResult.error);
                    }

                    const message = await receiveAndParse(
                        this.messages,
                        () =>
                            this.api.read(path, signal).then(result => {
                                if (result.success) {
                                    return result.payload;
                                }
                                throw new Error(result.error);
                            }),
                        protocol,
                    );

                    return this.success(message);
                } catch (err) {
                    // if user revokes usb permissions in browser we need a way how propagate that the device was technically disconnected,
                    if (err.message === ERRORS.DEVICE_DISCONNECTED_DURING_ACTION) {
                        this.enumerate();
                    }

                    return this.unknownError(err, [
                        ERRORS.DEVICE_DISCONNECTED_DURING_ACTION,
                        ERRORS.DEVICE_NOT_FOUND,
                        ERRORS.INTERFACE_UNABLE_TO_OPEN_DEVICE,
                        ERRORS.INTERFACE_DATA_TRANSFER,
                    ]);
                }
            },
            { timeout: undefined },
        );
    }

    public send({
        data,
        session,
        name,
        protocol: customProtocol,
        protocolState,
    }: AbstractTransportMethodParams<'send'>) {
        return this.scheduleAction(
            async signal => {
                const getPathBySessionResponse = await this.sessionsClient.getPathBySession({
                    session,
                });
                if (!getPathBySessionResponse.success) {
                    return this.error({ error: getPathBySessionResponse.error });
                }
                const { path } = getPathBySessionResponse.payload;

                try {
                    const protocol = customProtocol || v1Protocol;
                    const { getChunkHeader } = protocol;
                    console.warn('just pure sending', name, protocol.name, protocolState);
                    const bytes = buildMessage({
                        messages: this.messages,
                        name,
                        data,
                        protocol,
                        protocolState,
                    });
                    const chunks = createChunks(bytes, getChunkHeader(bytes), this.api.chunkSize);
                    const apiWrite = (chunk: Buffer, attemptSignal?: AbortSignal) =>
                        this.api.write(path, chunk, attemptSignal || signal);
                    const apiRead = (attemptSignal?: AbortSignal) =>
                        this.api.read(path, attemptSignal || signal);
                    // const sendResult = await sendChunks(chunks, apiWrite);
                    // if (!sendResult.success) {
                    //     throw new Error(sendResult.error);
                    // }

                    if (protocol.name === 'v2') {
                        await sendThpMessage({
                            protocolState,
                            chunks,
                            apiWrite,
                            apiRead,
                            signal,
                        });

                        // console.warn('EXPECTING THP ACK!');
                        // const message = await receiveAndParse(
                        //     this.messages,
                        //     () =>
                        //         this.api.read(path).then(result => {
                        //             if (result.success) {
                        //                 return result.payload;
                        //             }
                        //             throw new Error(result.error);
                        //         }),
                        //     protocol,
                        // );
                        // console.warn('RECEIVED THP ACK!', message);
                    } else {
                        const sendResult = await sendChunks(chunks, apiWrite);
                        if (!sendResult.success) {
                            throw new Error(sendResult.error);
                        }
                    }

                    return this.success(undefined);
                } catch (err) {
                    console.warn('====================> is it here?', err);
                    if (err.message === ERRORS.DEVICE_DISCONNECTED_DURING_ACTION) {
                        this.enumerate();
                    }

                    return this.unknownError(err, [
                        ERRORS.DEVICE_DISCONNECTED_DURING_ACTION,
                        ERRORS.ABORTED_BY_SIGNAL,
                    ]);
                }
            },
            { timeout: undefined },
        );
    }

    public receive({
        session,
        protocol: customProtocol,
        protocolState,
    }: AbstractTransportMethodParams<'receive'>) {
        return this.scheduleAction(
            async signal => {
                const getPathBySessionResponse = await this.sessionsClient.getPathBySession({
                    session,
                });
                if (!getPathBySessionResponse.success) {
                    return this.error({ error: getPathBySessionResponse.error });
                }
                const { path } = getPathBySessionResponse.payload;

                const apiWrite = (chunk: Buffer, attemptSignal?: AbortSignal) =>
                    this.api.write(path, chunk, attemptSignal || signal);
                const apiRead = (attemptSignal?: AbortSignal) =>
                    this.api.read(path, attemptSignal || signal);

                try {
                    const protocol = customProtocol || v1Protocol;

                    if (protocol.name === 'v2') {
                        const decoded = await receiveThpMessage({
                            protocolState,
                            apiWrite,
                            apiRead,
                            signal,
                        });

                        const message = parseThpMessage({
                            messages: this.messages,
                            decoded,
                            protocolState,
                        });

                        return this.success(message);
                    }

                    const message = await receiveAndParse(
                        this.messages,
                        () =>
                            this.api.read(path, signal).then(result => {
                                if (!result.success) {
                                    throw new Error(result.error);
                                }
                                console.warn(
                                    'API READ',
                                    Buffer.from(result.payload).toString('hex'),
                                );

                                return result.payload;
                            }),
                        protocol,
                    );

                    // Host: read ack
                    const chunk = thpProtocol.encodeAck(protocolState!);
                    const readAck = await this.api.write(path, chunk).then(result => {
                        if (!result.success) {
                            throw new Error(result.error);
                        }
                    });
                    protocolState?.updateSyncBit('recv');

                    console.warn('ReadAck sent', readAck);

                    return this.success(message);
                } catch (err) {
                    if (err.message === ERRORS.DEVICE_DISCONNECTED_DURING_ACTION) {
                        this.enumerate();
                    }

                    return this.unknownError(err, [
                        ERRORS.DEVICE_DISCONNECTED_DURING_ACTION,
                        ERRORS.ABORTED_BY_SIGNAL,
                    ]);
                }
            },
            { timeout: undefined },
        );
    }

    releaseDevice(path: string) {
        return this.api.closeDevice(path);
    }

    stop() {
        this.api.on('transport-interface-change', () => {
            this.logger?.debug('device connected after transport stopped');
        });
        this.stopped = true;
        this.abortController.abort();
    }
}
