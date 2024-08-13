import { WebUSB } from 'usb';

import { v1 as protocolV1, bridge as protocolBridge } from '@trezor/protocol';
import { receive as receiveUtil } from '@trezor/transport/src/utils/receive';
import { createChunks, sendChunks } from '@trezor/transport/src/utils/send';
import { SessionsBackground } from '@trezor/transport/src/sessions/background';
import { SessionsClient } from '@trezor/transport/src/sessions/client';
import { UsbApi } from '@trezor/transport/src/api/usb';
import { UdpApi } from '@trezor/transport/src/api/udp';
import { AcquireInput, ReleaseInput } from '@trezor/transport/src/transports/abstract';
import { Session } from '@trezor/transport/src/types';
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
    }: {
        path: string;
        data: string;
        signal: AbortSignal;
    }) => {
        const { messageType, payload } = protocolBridge.decode(Buffer.from(data, 'hex'));

        const encodedMessage = protocolV1.encode(payload, { messageType });
        const chunks = createChunks(
            encodedMessage,
            protocolV1.getChunkHeader(encodedMessage),
            api.chunkSize,
        );
        const apiWrite = (chunk: Buffer) => api.write(path, chunk, signal);
        const sendResult = await sendChunks(chunks, apiWrite);

        return sendResult;
    };

    const readUtil = async ({ path, signal }: { path: string; signal: AbortSignal }) => {
        try {
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
            }, protocolV1);

            logger?.debug(
                `core: readUtil result: messageType: ${messageType} byteLength: ${payload?.byteLength}`,
            );

            return {
                success: true as const,
                payload: protocolBridge.encode(payload, { messageType }).toString('hex'),
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

    type OpLock = {
        op: 'receive' | 'send' | 'call';
        session: string;
        path: string;
    };

    const locksQueue: OpLock[] = [];

    const findLock = ({ op, session, path }: OpLock) => {
        // - requested op == 'call' get any lock (call/read/write)
        // - requested op != 'call' get requested op lock (read/write)
        // - current op == 'call' get any lock (call/read/write)
        const index = locksQueue.findIndex(
            i =>
                i.session === session &&
                i.path === path &&
                (op === 'call' || i.op === op || i.op === 'call'),
        );
        if (index >= 0) {
            return {
                index,
                item: locksQueue[index],
            };
        }
    };

    // const getLock = (input: OpLock) => {
    //     console.warn('removeLock', input);
    //     const item = findLock(input);
    //     if (item) {
    //         locksQueue.splice(item.index, 1);
    //     }
    // };

    const removeLock = (input: OpLock) => {
        console.warn('removeLock', input);
        const item = findLock(input);
        if (item) {
            locksQueue.splice(item.index, 1);
        }
    };

    const call = async ({
        session,
        data,
        signal,
    }: {
        session: Session;
        data: string;
        signal: AbortSignal;
    }) => {
        logger?.debug(`core: call: session: ${session}`);
        // TODO: lock should be validated here but i dont know the path yet

        const sessionsResult = await sessionsClient.getPathBySession({
            session,
        });
        if (!sessionsResult.success) {
            logger?.error(`core: call: retrieving path error: ${sessionsResult.error}`);

            return sessionsResult;
        }
        const { path } = sessionsResult.payload;
        logger?.debug(`core: call: retrieved path ${path} for session ${session}`);

        const lock: OpLock = {
            op: 'call',
            path,
            session,
        };

        const isLocked = findLock(lock);
        if (isLocked) {
            return {
                success: false,
                error: 'other call in progress',
            };
        }
        locksQueue.push(lock);

        const openResult = await api.openDevice(path, false, signal);

        if (!openResult.success) {
            logger?.error(`core: call: api.openDevice error: ${openResult.error}`);
            removeLock(lock);

            return openResult;
        }
        logger?.debug(`core: call: api.openDevice done`);

        logger?.debug('core: call: writeUtil');
        const writeResult = await writeUtil({ path, data, signal });
        if (!writeResult.success) {
            logger?.error(`core: call: writeUtil ${writeResult.error}`);
            removeLock(lock);

            return writeResult;
        }
        logger?.debug('core: call: readUtil');

        return readUtil({ path, signal }).finally(() => {
            removeLock(lock);
        });
    };

    const send = async ({
        session,
        data,
        signal,
    }: {
        session: Session;
        data: string;
        signal: AbortSignal;
    }) => {
        console.warn('Send request');
        const sessionsResult = await sessionsClient.getPathBySession({
            session,
        });

        if (!sessionsResult.success) {
            return sessionsResult;
        }

        console.warn('Send sessionsResult');
        const { path } = sessionsResult.payload;

        const lock: OpLock = {
            op: 'send',
            path,
            session,
        };

        const isLocked = findLock(lock);
        console.warn('Send', isLocked);
        if (isLocked) {
            return {
                success: false,
                error: 'other call in progress',
            };
        }

        console.warn('Send', locksQueue);
        locksQueue.push(lock);

        const openResult = await api.openDevice(path, false, signal);
        if (!openResult.success) {
            removeLock(lock);

            return openResult;
        }

        return writeUtil({ path, data, signal }).finally(() => {
            removeLock(lock);
        });
    };

    const receive = async ({ session, signal }: { session: Session; signal: AbortSignal }) => {
        const sessionsResult = await sessionsClient.getPathBySession({
            session,
        });

        if (!sessionsResult.success) {
            return sessionsResult;
        }
        const { path } = sessionsResult.payload;

        const lock: OpLock = {
            op: 'receive',
            path,
            session,
        };

        const isLocked = findLock(lock);
        if (isLocked) {
            return {
                success: false,
                error: 'other call in progress',
            };
        }
        locksQueue.push(lock);

        const openResult = await api.openDevice(path, false, signal);
        if (!openResult.success) {
            removeLock(lock);

            return openResult;
        }

        return readUtil({ path, signal }).finally(() => {
            removeLock(lock);
        });
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
