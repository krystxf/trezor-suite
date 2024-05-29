// import * as protobuf from 'protobufjs/light';
import { thp as protocolThp } from '@trezor/protocol';
import { readWithExpectedState, sendThpMessage, receiveThpMessage } from '../src/thp';

describe('thpUtils', () => {
    const apiWrite = jest.fn(() => Promise.resolve({ success: true } as any));
    // const apiRead = jest.fn(() => Promise.resolve({ success: true, payload: Buffer.alloc(0) }));
    const apiRead = jest.fn(signal => {
        return new Promise<any>((resolve, reject) => {
            const listener = () => {
                signal.removeEventListener('abort', listener);
                reject(new Error('Aborted by signal in API'));
            };
            signal?.addEventListener('abort', listener);

            setTimeout(() => {
                signal.removeEventListener('abort', listener);
                resolve({ success: true, payload: Buffer.alloc(5) });
            }, 100);
        });
    });

    const protocolState = new protocolThp.ThpProtocolState();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('readWithExpectedState aborted', async () => {
        jest.useFakeTimers();
        const abortController = new AbortController();
        const resultPromise = readWithExpectedState(
            apiRead,
            protocolState,
            abortController.signal,
        ).catch(e => ({ testError: e.message }));

        await jest.advanceTimersByTimeAsync(1000);
        expect(apiRead).toHaveBeenCalledTimes(11);

        abortController.abort();
        const result = await resultPromise;

        expect(result).toEqual({ testError: 'Aborted by signal in API' });
    });

    it('readWithExpectedState successful', async () => {
        const abortController = new AbortController();
        const r = await readWithExpectedState(
            () => Promise.resolve({ success: true, payload: Buffer.from([0x04]) }),
            protocolState,
            abortController.signal,
        );

        console.warn('TEST', r);
    });

    it('receiveThpMessage aborted', async () => {
        jest.useFakeTimers();
        const abortController = new AbortController();
        const resultPromise = receiveThpMessage({
            // messages: protobuf.Root.fromJSON({}),
            protocolState,
            apiRead,
            apiWrite,
            signal: abortController.signal,
        }).catch(e => ({ testError: e.message }));

        await jest.advanceTimersByTimeAsync(1000);
        expect(apiRead).toHaveBeenCalledTimes(11);

        abortController.abort();
        const result = await resultPromise;

        expect(result).toEqual({ testError: 'Aborted by signal in API' });
    });

    it.only('receiveThpMessage successful', async () => {
        const protocolState = new protocolThp.ThpProtocolState();
        protocolState.updateHandshakeCredentials({ trezorKey: Buffer.alloc(0) });

        // const readResult = Buffer.from([0x04, 12, 34, 0, 4, 1, 1, 1, 1]);
        const readResult = Buffer.from('200c22000471913136', 'hex');
        protocolState.setChannel(readResult.subarray(1, 3));
        protocolState.setExpectedResponse([0x20]);

        const result = await receiveThpMessage({
            // messages: protobuf.Root.fromJSON({}),
            protocolState,
            apiRead: () => Promise.resolve({ success: true, payload: readResult }),
            apiWrite,
        });

        expect(apiWrite).toHaveBeenCalledTimes(1);
        expect(result).toEqual(readResult);
    });

    it('receiveThpMessage successful without ThpAck', async () => {
        const readResult = Buffer.from([0x41, 0, 0, 0, 0]);
        const result = await receiveThpMessage({
            // messages: protobuf.Root.fromJSON({}),
            protocolState,
            apiRead: () => Promise.resolve({ success: true, payload: readResult }),
            apiWrite,
        });

        expect(apiWrite).toHaveBeenCalledTimes(0);
        expect(result).toEqual(readResult);
    });

    it('sendThpMessage rejected after retransmission attempts limit reached', async () => {
        jest.useFakeTimers();
        const abortController = new AbortController();
        // const apiRead = jest.fn(signal => {
        //     return new Promise((resolve, reject) => {
        //         const listener = () => {
        //             signal.removeEventListener('abort', listener);
        //             reject(new Error('Aborted by signal in API'));
        //         };
        //         signal?.addEventListener('abort', listener);

        //         setTimeout(() => {
        //             signal.removeEventListener('abort', listener);
        //             resolve({ success: true, payload: Buffer.from('a') });
        //         }, 500);
        //     });
        // });
        // const r = await sendThpMessage({
        //     chunks: [Buffer.from([0x40, 0, 0])],
        //     apiWrite,
        //     apiRead,
        //     signal: abortController.signal,
        // });

        // console.warn('Alloc', r);

        // expect(apiWrite).toHaveBeenCalledTimes(1);
        // expect(apiRead).toHaveBeenCalledTimes(0);

        // setTimeout(() => {
        //     abortController.abort();
        // }, 500);

        const sendPromise = sendThpMessage({
            protocolState,
            chunks: [Buffer.from([0x04, 0, 0])],
            apiWrite,
            apiRead,
            signal: abortController.signal,
        }).catch(e => ({ error: e.message }));

        await jest.advanceTimersByTimeAsync(5000);
        const result = await sendPromise;

        expect(result).toEqual({ error: 'Aborted by timeout' });

        expect(apiWrite).toHaveBeenCalledTimes(3);
    });

    it('sendThpMessage aborted by signal', async () => {
        jest.useFakeTimers();
        const abortController = new AbortController();
        const sendPromise = sendThpMessage({
            protocolState,
            chunks: [Buffer.from([0x04, 0, 0])],
            apiWrite,
            apiRead,
            signal: abortController.signal,
        }).catch(e => ({ error: e.message }));

        await jest.advanceTimersByTimeAsync(1000);
        expect(apiWrite).toHaveBeenCalledTimes(2); // there was at least 1 retransmission
        abortController.abort();
        const result = await sendPromise;

        expect(result).toEqual({ error: 'Aborted by signal' });
    });

    it('sendThpMessage rejected by apiWrite error', async () => {
        const apiWriteRejected = jest.fn(() =>
            Promise.resolve({ success: false, error: 'apiWrite error' } as any),
        );

        await expect(() =>
            sendThpMessage({
                protocolState,
                chunks: [Buffer.from([0x04, 0, 0])],
                apiWrite: apiWriteRejected,
                apiRead,
            }),
        ).rejects.toThrow('apiWrite error');
    });

    it('sendThpMessage rejected by apiRead error', async () => {
        const apiReadRejected = jest.fn(() => {
            return Promise.resolve({ success: false, error: 'apiRead error' } as any);
        });

        await expect(() =>
            sendThpMessage({
                protocolState,
                chunks: [Buffer.from([0x04, 0, 0])],
                apiWrite,
                apiRead: apiReadRejected,
            }),
        ).rejects.toThrow('apiRead error');
    });

    it('sendThpMessage successful (without ThpAck)', async () => {
        const result = await sendThpMessage({
            protocolState,
            chunks: [Buffer.from([0x40, 0, 0])],
            apiWrite,
            apiRead,
        });

        expect(apiWrite).toHaveBeenCalledTimes(1);
        expect(apiRead).toHaveBeenCalledTimes(0);

        expect(result).toEqual([Buffer.from([0x42, 0, 0]), Buffer.from([0x41, 0, 0])]);
    });

    it('sendThpMessage successful (with ThpAck)', async () => {
        const apiReadRejected = jest.fn(() => {
            return Promise.resolve({ success: true, payload: Buffer.from([0x42, 0, 0]) } as any);
        });

        const result = await sendThpMessage({
            protocolState,
            chunks: [Buffer.from([0x04, 0, 0])],
            apiWrite,
            apiRead: apiReadRejected,
        });

        expect(apiWrite).toHaveBeenCalledTimes(1);
        expect(apiReadRejected).toHaveBeenCalledTimes(1);

        expect(result).toEqual([Buffer.from([0x42, 0, 0]), Buffer.from([0x80, 0, 0])]);
    });
});
