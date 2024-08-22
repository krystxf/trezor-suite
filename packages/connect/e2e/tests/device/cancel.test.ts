import TrezorConnect from '../../../src';

const { getController, setup, initTrezorConnect } = global.Trezor;

describe('TrezorConnect.cancel', () => {
    const controller = getController();

    beforeAll(async () => {
        await setup(controller, {
            mnemonic: 'mnemonic_all',
        });
    });

    beforeEach(async () => {
        // restart connect for each test (working with event listeners)
        await TrezorConnect.dispose();
        await initTrezorConnect(controller, { debug: false });
    });

    afterAll(async () => {
        controller.dispose();
        await TrezorConnect.dispose();
    });

    // the goal is to run this test couple of times to uncover possible race conditions/flakiness
    [0, 1, 10, 100, 300].forEach(delay => {
        test('ButtonRequest - Cancel after ButtonRequest_Address', async () => {
            const getAddressCall = TrezorConnect.getAddress({
                path: "m/44'/1'/0'/0/0",
                showOnTrezor: true,
            });
            await new Promise(resolve => {
                TrezorConnect.on('button', event => {
                    if (event.code === 'ButtonRequest_Address') {
                        resolve(undefined);
                    }
                });
            });

            await new Promise(resolve => setTimeout(resolve, delay));

            TrezorConnect.cancel('my custom message');

            const response = await getAddressCall;
            console.log('response', response);

            expect(response).toMatchObject({
                success: false,
                payload: {
                    error: 'my custom message',
                    code: 'Method_Cancel',
                },
            });

            // validate that further communication is possible without any glitch
            const getAddressResponse = await TrezorConnect.getAddress({
                path: "m/44'/1'/0'/0/0",
                showOnTrezor: false,
            });

            console.log('getAddressResponse,', getAddressResponse);
            // TODO: this sometimes fails with, probably a race condition
            //   success: false,
            //   payload: {
            //     error: 'Initialize failed: Unexpected message, code: Failure_UnexpectedMessage',
            //     code: 'Device_InitializeFailed'
            //   }

            expect(getAddressResponse.success).toEqual(true);
        });
    });

    // is such test doable?
    test('ButtonRequest - Cancel before ButtonRequest_Address', async () => {
        const getAddressCall = TrezorConnect.getAddress({
            path: "m/44'/1'/0'/0/0",
            showOnTrezor: true,
        });

        let getAddressCallResolved = false;

        TrezorConnect.on('button', event => {
            if (event.code === 'ButtonRequest_Address') {
                if (getAddressCallResolved) {
                    // this should not happen
                    throw new Error('ButtonRequest_Address should not be called after cancel');
                }
            }
        });

        TrezorConnect.cancel('my custom message');

        const response = await getAddressCall;

        // this appears to be wrong maybe? cancel was fired too early and did not take effect.
        expect(response).toMatchObject({
            success: true,
            payload: {
                address: 'mvbu1Gdy8SUjTenqerxUaZyYjmveZvt33q',
            },
        });

        getAddressCallResolved = true;
    });

    // test('Pin request - Cancel', async () => {});
});
