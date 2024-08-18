import * as messages from '@trezor/protobuf/messages.json';
import { BridgeTransport } from '@trezor/transport';

import { controller as TrezorUserEnvLink, env } from './controller';
import { pathLength, descriptor as expectedDescriptor } from './expect';
import { assertSuccess } from '../api/utils';

// todo: introduce global jest config for e2e
jest.setTimeout(60000);

const assertBridgeNotRunning = async () => {
    await expect(
        fetch('http://localhost:21325/', {
            method: 'GET',
        }),
    ).rejects.toThrow('fetch failed');
};

const emulatorStartOpts = { version: '2-main', wipe: true };

describe('bridge', () => {
    let bridge: BridgeTransport;
    let devices: any[];
    let session: any;

    beforeAll(async () => {
        await TrezorUserEnvLink.connect();
        await TrezorUserEnvLink.startEmu(emulatorStartOpts);
        await TrezorUserEnvLink.startBridge();

        const abortController = new AbortController();
        bridge = new BridgeTransport({ messages, signal: abortController.signal });
        await bridge.init().promise;

        const enumerateResult = await bridge.enumerate().promise;
        assertSuccess(enumerateResult);
        expect(enumerateResult).toMatchObject({
            success: true,
            payload: [
                {
                    path: expect.any(String),
                    session: null,
                    product: expectedDescriptor.product,
                },
            ],
        });

        const { path } = enumerateResult.payload[0];
        expect(path.length).toEqual(pathLength);

        devices = enumerateResult.payload;

        const acquireResult = await bridge.acquire({
            input: { path: devices[0].path, previous: session },
        }).promise;
        assertSuccess(acquireResult);
        expect(acquireResult).toEqual({
            success: true,
            payload: '1',
        });
        session = acquireResult.payload;
    });

    afterAll(async () => {
        await TrezorUserEnvLink.stopEmu();
        await TrezorUserEnvLink.stopBridge();
        TrezorUserEnvLink.disconnect();
    });

    test(`call(GetFeatures)`, async () => {
        const message = await bridge.call({ session, name: 'GetFeatures', data: {} }).promise;
        expect(message).toMatchObject({
            success: true,
            payload: {
                type: 'Features',
                message: {
                    vendor: 'trezor.io',
                },
            },
        });
    });

    test(`send(GetFeatures) - receive`, async () => {
        const sendResponse = await bridge.send({ session, name: 'GetFeatures', data: {} }).promise;
        expect(sendResponse).toEqual({ success: true, payload: undefined });

        const receiveResponse = await bridge.receive({ session }).promise;

        expect(receiveResponse).toMatchObject({
            success: true,
            payload: {
                type: 'Features',
                message: {
                    vendor: 'trezor.io',
                },
            },
        });
    });

    test(`call(RebootToBootloader) - send(Cancel) - receive`, async () => {
        // initiate RebootToBootloader procedure on device (it works regardless device is wiped or not)
        const callResponse = await bridge.call({ session, name: 'RebootToBootloader', data: {} })
            .promise;
        expect(callResponse).toMatchObject({
            success: true,
            payload: {
                type: 'ButtonRequest',
            },
        });

        // cancel RebootToBootloader procedure
        await bridge.send({ session, name: 'Cancel', data: {} }).promise;

        // receive response
        const receiveResponse = await bridge.receive({ session }).promise;

        expect(receiveResponse).toMatchObject({
            success: true,
            payload: {
                type: 'Failure',
                message: {
                    code: 'Failure_ActionCancelled',
                },
            },
        });

        // validate that we can continue with communication
        const message = await bridge.call({
            session,
            name: 'GetFeatures',
            data: {},
        }).promise;
        expect(message).toMatchObject({
            success: true,
            payload: {
                type: 'Features',
                message: {
                    vendor: 'trezor.io',
                },
            },
        });
    });

    test(`send(RebootToBootloader) - send(Cancel) - receive`, async () => {
        // special case - a procedure on device is initiated by SEND method.
        await bridge.send({ session, name: 'RebootToBootloader', data: {} }).promise;

        // cancel RebootToBootloader procedure
        await bridge.send({ session, name: 'Cancel', data: {} }).promise;

        // receive response
        const receiveResponse1 = await bridge.receive({ session }).promise;

        // this seems to be a bug in the old bridge and new bridge.
        // FIXME: this is wrong, send RebootToBootloader was not correctly cancelled by Cancel
        expect(receiveResponse1).toMatchObject({
            success: true,
            payload: {
                message: { code: 'ButtonRequest_ProtectCall', pages: null },
                type: 'ButtonRequest',
            },
        });

        const receiveResponse2 = await bridge.receive({ session }).promise;
        expect(receiveResponse2).toMatchObject({
            success: true,
            payload: {
                message: {
                    code: 'Failure_ActionCancelled',
                    message: 'Action cancelled by user',
                },
                type: 'Failure',
            },
        });
    });

    test(`concurrent acquire`, async () => {
        const { path } = devices[0];
        const results = await Promise.all([
            bridge.acquire({ input: { path, previous: session } }).promise,
            bridge.acquire({ input: { path, previous: session } }).promise,
        ]);
        expect(results).toMatchObject([
            { success: true, payload: `${Number.parseInt(session) + 1}` },
            { success: false, error: 'wrong previous session' },
        ]);
        assertSuccess(results[0]);
        session = results[0].payload;
    });

    test(`concurrent receive - not allowed`, async () => {
        await bridge.send({ session, name: 'GetFeatures', data: {} }).promise;

        const results = await Promise.all([
            bridge.receive({ session }).promise,
            bridge.receive({ session }).promise,
        ]);

        expect(results).toMatchObject([
            { success: true, payload: { type: 'Features' } },
            {
                success: false,
                error: 'other call in progress',
                message: undefined,
            },
        ]);
    });

    test(`concurrent call - not allowed`, async () => {
        const results = await Promise.all([
            bridge.call({ session, name: 'GetFeatures', data: {} }).promise,
            bridge.call({ session, name: 'GetFeatures', data: {} }).promise,
        ]);

        expect(results).toMatchObject([
            { success: true, payload: { type: 'Features' } },
            {
                success: false,
                error: 'other call in progress',
                message: undefined,
            },
        ]);
    });

    test(`concurrent call and receive - not allowed`, async () => {
        const results = await Promise.all([
            bridge.call({ session, name: 'GetFeatures', data: {} }).promise,
            bridge.receive({ session }).promise,
        ]);

        expect(results).toMatchObject([
            { success: true, payload: { type: 'Features' } },
            { success: false, error: 'other call in progress', message: undefined },
        ]);
    });

    test('This scenario crashes the old bridge (2.0.33) on Mac and doesnt really work with node-bridge', async () => {
        await bridge.send({ session, name: 'GetFeatures', data: {} }).promise;

        // wait a second
        await new Promise(resolve => setTimeout(resolve, 1000));
        await TrezorUserEnvLink.stopBridge();
        await new Promise(resolve => setTimeout(resolve, 1000));

        await TrezorUserEnvLink.startEmu(emulatorStartOpts);
        await TrezorUserEnvLink.startBridge();
        const abortController = new AbortController();
        bridge = new BridgeTransport({ messages, signal: abortController.signal });
        await bridge.init().promise;

        const enumerateResult = await bridge.enumerate().promise;
        assertSuccess(enumerateResult);
        expect(enumerateResult).toMatchObject({
            success: true,
            payload: [
                {
                    path: expect.any(String),
                    product: expectedDescriptor.product,
                },
            ],
        });
        devices = enumerateResult.payload;

        // acquire hangs and once it is aborted by client, the bridge crashes
        await bridge.acquire({
            input: {
                path: devices[0].path,
                // OK so not sending previous (or sending null (force)) is the key ingredient
                // so maybe it is not about send at all? it looks like that only one send is enough to cause it
                previous: null,
            },
        }).promise;

        // old bridge is crashed
        if (!env.USE_NODE_BRIDGE) {
            await assertBridgeNotRunning();

            return;
        } else {
            // new bridge received some nice fixes and now we can continue
            const enumerateResult2 = await bridge.enumerate().promise;
            expect(enumerateResult2).toMatchObject({
                success: true,
                payload: [
                    {
                        path: expect.any(String),
                    },
                ],
            });
        }
    });
});
