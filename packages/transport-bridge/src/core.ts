import { WebUSB } from 'usb';

import {
    v1 as protocolV1,
    v2 as protocolV2,
    thp as protocolThp,
    bridge as protocolBridge,
    TransportProtocol,
} from '@trezor/protocol';
import { receive as receiveUtil } from '@trezor/transport/src/utils/receive';
import { sendThpMessage, receiveThpMessage } from '@trezor/transport/src/thp';
import { createChunks, sendChunks } from '@trezor/transport/src/utils/send';
import { SessionsBackground } from '@trezor/transport/src/sessions/background';
import { SessionsClient } from '@trezor/transport/src/sessions/client';
import { UsbApi } from '@trezor/transport/src/api/usb';
import { UdpApi } from '@trezor/transport/src/api/udp';
import { AcquireInput, ReleaseInput } from '@trezor/transport/src/transports/abstract';
import { Session, BridgeProtocolMessage } from '@trezor/transport/src/types';
import { createProtocolMessage } from '@trezor/transport/src/utils/bridgeProtocolMessage';
import { Log } from '@trezor/utils';
import { AbstractApi } from '@trezor/transport/src/api/abstract';

export const createCore = (apiArg: 'usb' | 'udp' | AbstractApi, logger?: Log) => {
    let api: AbstractApi;

    const abortController = new AbortController();
    const sessionsBackground = new SessionsBackground({ signal: abortController.signal });

    const sessionsClient = new SessionsClient({
        requestFn: args => sessionsBackground.handleMessage(args),
        registerBackgroundCallbacks: () => {},
    });

    sessionsBackground.on('descriptors', descriptors => {
        sessionsClient.emit('descriptors', descriptors);
    });

    if (typeof apiArg === 'string') {
        api =
            apiArg === 'udp'
                ? new UdpApi({ logger })
                : new UsbApi({
                      logger,
                      usbInterface: new WebUSB({
                          allowAllDevices: true, // return all devices, not only authorized
                      }),

                      // todo: possibly only for windows
                      forceReadSerialOnConnect: true,
                  });
    } else {
        api = apiArg;
    }

    api.listen();

    // whenever low-level api reports changes to descriptors, report them to sessions module
    api.on('transport-interface-change', descriptors => {
        logger?.debug(`core: transport-interface-change ${JSON.stringify(descriptors)}`);
        sessionsClient.enumerateDone({ descriptors });
    });

    const writeUtil = async ({
        path,
        data,
        signal,
        protocol,
    }: {
        path: string;
        data: string;
        signal: AbortSignal;
        protocol: TransportProtocol;
    }) => {
        logger?.debug(`core: writeUtil protocol ${protocol.name}`);
        const buffer = Buffer.from(data, 'hex');
        let encodedMessage;
        let chunkHeader;
        if (protocol.name === 'bridge') {
            const { messageType, payload } = protocolBridge.decode(buffer);
            encodedMessage = protocolV1.encode(payload, { messageType });
            chunkHeader = protocolV1.getChunkHeader(encodedMessage);
        } else {
            encodedMessage = buffer;
            chunkHeader = protocol.getChunkHeader(encodedMessage);
        }

        const chunks = createChunks(encodedMessage, chunkHeader, api.chunkSize);
        const apiWrite = (chunk: Buffer) => api.write(path, chunk, signal);
        const sendResult = await sendChunks(chunks, apiWrite);

        return sendResult;
    };

    const readUtil = async ({
        path,
        signal,
        protocol,
    }: {
        path: string;
        signal: AbortSignal;
        protocol: TransportProtocol;
    }) => {
        logger?.debug(`core: readUtil protocol ${protocol.name}`);
        try {
            const receiveProtocol = protocol.name === 'bridge' ? protocolV1 : protocol;
            const { messageType, payload } = await receiveUtil(() => {
                logger?.debug(`core: readUtil: api.read: reading next chunk`);

                return api.read(path, signal).then(result => {
                    if (result.success) {
                        logger?.debug(
                            `core: readUtil partial result: byteLength: ${result.payload.byteLength}`,
                        );

                        return result.payload;
                    }
                    logger?.debug(`core: readUtil partial result: error: ${result.error}`);
                    throw new Error(result.error);
                });
            }, receiveProtocol);

            logger?.debug(
                `core: readUtil result: messageType: ${messageType} byteLength: ${payload?.byteLength}`,
            );

            return {
                success: true as const,
                payload: protocol.encode(payload, { messageType }).toString('hex'),
            };
        } catch (err) {
            logger?.debug(`core: readUtil catch: ${err.message}`);

            return { success: false as const, error: err.message as string };
        }
    };

    const enumerate = async ({ signal }: { signal: AbortSignal }) => {
        await sessionsClient.enumerateIntent();
        const enumerateResult = await api.enumerate(signal);

        if (!enumerateResult.success) {
            return enumerateResult;
        }

        const enumerateDoneResponse = await sessionsClient.enumerateDone({
            descriptors: enumerateResult.payload,
        });

        return enumerateDoneResponse;
    };

    const acquire = async (
        acquireInput: Omit<AcquireInput, 'previous'> & {
            previous: Session | 'null';
            signal: AbortSignal;
        },
    ) => {
        const acquireIntentResult = await sessionsClient.acquireIntent({
            path: acquireInput.path,
            previous: acquireInput.previous === 'null' ? null : acquireInput.previous,
        });
        if (!acquireIntentResult.success) {
            return acquireIntentResult;
        }

        const openDeviceResult = await api.openDevice(acquireInput.path, true, acquireInput.signal);
        logger?.debug(`core: openDevice: result: ${JSON.stringify(openDeviceResult)}`);

        if (!openDeviceResult.success) {
            return openDeviceResult;
        }
        await sessionsClient.acquireDone({ path: acquireInput.path });

        return acquireIntentResult;
    };

    const release = async ({ session }: Omit<ReleaseInput, 'path'>) => {
        await sessionsClient.releaseIntent({ session });

        const sessionsResult = await sessionsClient.getPathBySession({
            session,
        });

        if (!sessionsResult.success) {
            return sessionsResult;
        }

        const closeRes = await api.closeDevice(sessionsResult.payload.path);

        if (!closeRes.success) {
            logger?.error(`core: release: api.closeDevice error: ${closeRes.error}`);
        }

        return sessionsClient.releaseDone({ path: sessionsResult.payload.path });
    };

    const getProtocol = (name: BridgeProtocolMessage['protocol']) => {
        if (name === 'v1') {
            return protocolV1;
        }

        if (name === 'v2') {
            return protocolV2;
        }

        return protocolBridge;
    };

    const createProtocolMessageResponse = (
        protocol: BridgeProtocolMessage['protocol'],
        response: Awaited<ReturnType<typeof readUtil>> | Awaited<ReturnType<typeof writeUtil>>,
    ) => {
        if (response.success) {
            const body = 'payload' in response ? response.payload : '';

            return {
                ...response,
                payload: createProtocolMessage(body, protocol),
            };
        }

        return response;
    };
    // const getRequestBody = (data: string, protocol?: TransportProtocol) => {
    //     if (protocol?.name === 'v2') {
    //         try {
    //             const json = JSON.parse(data);
    //             const protocolState = new protocolThp.ThpProtocolState();
    //             protocolState.deserialize(json.state);

    //             return {
    //                 protocolState,
    //                 body: json.body,
    //             };
    //         } catch (e) {
    //             logger?.debug(`THP getRequestBody error: ${e} ${data}`);
    //             // TODO: break communication and return success: false
    //         }
    //     }

    //     return {
    //         protocolState: undefined,
    //         body: data,
    //     };
    // };

    const call = async ({
        session,
        data,
        signal,
        protocol: protocolName,
        state,
    }: BridgeProtocolMessage & {
        session: Session;
        signal: AbortSignal;
    }) => {
        logger?.debug(`core: call: session: ${session} ${protocolName}`);
        const sessionsResult = await sessionsClient.getPathBySession({
            session,
        });
        if (!sessionsResult.success) {
            logger?.error(`core: call: retrieving path error: ${sessionsResult.error}`);

            return sessionsResult;
        }
        const protocol = getProtocol(protocolName);
        let protocolState;
        if (state) {
            protocolState = new protocolThp.ThpProtocolState();
            protocolState.deserialize(state);
        }

        const { path } = sessionsResult.payload;
        logger?.debug(`core: call: retrieved path ${path} for session ${session}`);

        const openResult = await api.openDevice(path, false, signal);

        if (!openResult.success) {
            logger?.error(`core: call: api.openDevice error: ${openResult.error}`);

            return openResult;
        }
        logger?.debug(`core: call: api.openDevice done`);

        if (protocol.name === 'v2') {
            const b = Buffer.from(data, 'hex');
            const chunks = createChunks(b, protocol.getChunkHeader(b), api.chunkSize);
            protocolState?.setChannel(b.subarray(1, 3));

            const apiWrite = (chunk: Buffer, attemptSignal?: AbortSignal) =>
                api.write(path, chunk, attemptSignal || signal);
            const apiRead = (attemptSignal?: AbortSignal) =>
                api.read(path, attemptSignal || signal);

            await sendThpMessage({
                protocolState,
                chunks,
                apiWrite,
                apiRead,
                signal,
            });

            const message = await receiveThpMessage({
                protocolState,
                apiWrite,
                apiRead,
                signal,
            });

            return createProtocolMessageResponse(protocol.name, {
                success: true,
                payload: protocol.encode(message.payload, message).toString('hex'),
            });
        }

        const writeResult = await writeUtil({ path, data, protocol, signal });
        if (!writeResult.success) {
            logger?.error(`core: call: writeUtil ${writeResult.error}`);

            return writeResult;
        }
        logger?.debug('core: call: readUtil');

        const readResult = await readUtil({ path, signal, protocol });

        return createProtocolMessageResponse(protocolName, readResult);
        // if (!readResult.success) {
        //     return readResult;
        // }

        // if (protocol.name !== 'bridge') {
        //     const buffer = Buffer.from(readResult.payload, 'hex');
        //     const thpMessage = protocol.decode(buffer);
        //     const isThpAck = protocolThp.decodeAck(thpMessage);

        //     if (isThpAck) {
        //         protocolState?.updateSyncBit('send');
        //         // protocolState?.updateNonce('send');

        //         console.warn('ACK in response, reading again');
        //         const realResult = await readUtil({ path, protocol, signal });
        //         if (!realResult.success) {
        //             return realResult;
        //         }
        //         // protocolState?.updateNonce('recv');

        //         console.warn('Send ThpReadAck');
        //         const chunk = protocolThp.encodeAck(Buffer.from(realResult.payload, 'hex'));

        //         const ackResult = await writeUtil({
        //             path,
        //             data: chunk.toString('hex'),
        //             signal,
        //             protocol,
        //         });
        //         if (!ackResult.success) {
        //             return ackResult;
        //         }
        //         protocolState?.updateSyncBit('recv');

        //         return {
        //             ...realResult,
        //             payload: JSON.stringify({
        //                 body: realResult.payload,
        //                 state: protocolState?.serialize(),
        //             }),
        //         };
        //     } else {
        //         return {
        //             ...readResult,
        //             payload: JSON.stringify({
        //                 body: readResult.payload,
        //                 state: protocolState?.serialize(),
        //             }),
        //         };
        //     }
        // }

        // return readResult;
    };

    const send = async ({
        session,
        data,
        signal,
        protocol: protocolName,
        state,
    }: BridgeProtocolMessage & {
        session: Session;
        signal: AbortSignal;
    }) => {
        const sessionsResult = await sessionsClient.getPathBySession({
            session,
        });

        if (!sessionsResult.success) {
            return sessionsResult;
        }
        const { path } = sessionsResult.payload;
        const protocol = getProtocol(protocolName);
        if (state) {
            const protocolState = new protocolThp.ThpProtocolState();
            protocolState.deserialize(state);
        }

        const openResult = await api.openDevice(path, false, signal);
        if (!openResult.success) {
            return openResult;
        }

        if (protocol.name === 'v2') {
            const writeResult = await writeUtil({ path, data, signal, protocol });
            if (!writeResult.success) {
                return writeResult;
            }
            // // Read ACK
            // const readResult = await readUtil({ path, signal, protocol });
            // if (!readResult.success) {
            //     return readResult;
            // }

            return createProtocolMessageResponse(protocolName, writeResult);
        }

        const writeResult = await writeUtil({ path, data, signal, protocol });

        return createProtocolMessageResponse(protocolName, writeResult);
    };

    const receive = async ({
        session,
        signal,
        protocol: protocolName,
        state,
    }: BridgeProtocolMessage & {
        session: Session;
        signal: AbortSignal;
    }) => {
        const sessionsResult = await sessionsClient.getPathBySession({
            session,
        });

        if (!sessionsResult.success) {
            return sessionsResult;
        }
        const { path } = sessionsResult.payload;
        const protocol = getProtocol(protocolName);

        const openResult = await api.openDevice(path, false, signal);
        if (!openResult.success) {
            return openResult;
        }

        if (protocol.name === 'v2') {
            const protocolState = new protocolThp.ThpProtocolState();
            if (state) {
                protocolState.deserialize(state);
                protocolState.setExpectedResponse([4, 128, 1000]);
            }

            const apiWrite = (chunk: Buffer, attemptSignal?: AbortSignal) =>
                api.write(path, chunk, attemptSignal || signal);
            const apiRead = (attemptSignal?: AbortSignal) =>
                api.read(path, attemptSignal || signal);

            try {
                const message = await receiveThpMessage({
                    protocolState,
                    apiWrite,
                    apiRead,
                    signal,
                });

                return createProtocolMessageResponse(protocolName, message);
            } catch (e) {
                return {
                    success: false,
                    error: e.message,
                };
            }
        }

        const readResult = await readUtil({ path, signal, protocol });

        return createProtocolMessageResponse(protocolName, readResult);
    };

    const dispose = () => {
        abortController.abort();
        api.dispose();
        sessionsClient.dispose();
    };

    return {
        enumerate,
        acquire,
        release,
        call,
        send,
        receive,
        dispose,
        sessionsClient,
    };
};
