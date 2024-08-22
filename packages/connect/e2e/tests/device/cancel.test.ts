import { SetupEmu } from '@trezor/trezor-user-env-link';
import TrezorConnect from '../../../src';

const { getController, setup, initTrezorConnect } = global.Trezor;

const getAddress = async (showOnTrezor: boolean) => {
    return TrezorConnect.getAddress({
        path: "m/44'/1'/0'/0/0",
        showOnTrezor,
    });
};

const passphraseHandler = (value: string) => () => {
    TrezorConnect.uiResponse({
        type: 'ui-receive_passphrase',
        payload: {
            passphraseOnDevice: false,
            value,
        },
    });
    TrezorConnect.removeAllListeners('ui-request_passphrase');
};

const assertGetAddressWorks = async () => {
    // validate that further communication is possible without any glitch
    TrezorConnect.on('ui-request_passphrase', passphraseHandler('a'));
    const getAddressResponse = await getAddress(false);
    expect(getAddressResponse.success).toEqual(true);
};

describe('TrezorConnect.cancel', () => {
    const controller = getController();

    const setupTest = async ({ setupParams }: { setupParams: SetupEmu }) => {
        await setup(controller, setupParams);
        await TrezorConnect.dispose();
        await initTrezorConnect(controller, { debug: false });
    };

    afterAll(async () => {
        controller.dispose();
        await TrezorConnect.dispose();
    });

    // the goal is to run this test couple of times to uncover possible race conditions/flakiness
    [0, 1, 10, 100, 300].forEach(delay => {
        test(`GetAddress - ButtonRequest_Address - delay ${delay}ms - Cancel `, async () => {
            await setupTest({
                setupParams: {
                    mnemonic: 'mnemonic_all',
                },
            });

            const getAddressCall = getAddress(true);
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

            // TODO: this sometimes fails with, probably a race condition
            //   success: false,
            //   payload: {
            //     error: 'Initialize failed: Unexpected message, code: Failure_UnexpectedMessage',
            //     code: 'Device_InitializeFailed'
            //   }
            await assertGetAddressWorks();
        });
    });

    test('Synchronous Cancel', async () => {
        await setupTest({
            setupParams: {
                mnemonic: 'mnemonic_all',
            },
        });

        const getAddressCall = getAddress(true);

        TrezorConnect.cancel();

        const response = await getAddressCall;

        // This looks like a bug. there was showOnTrezor: true but we bypassed it by sending cancel?
        expect(response).toMatchObject({
            success: true,
            payload: {
                address: 'mvbu1Gdy8SUjTenqerxUaZyYjmveZvt33q',
            },
        });
    });

    test('Passphrase request - Cancel', async () => {
        await setupTest({
            setupParams: {
                mnemonic: 'mnemonic_all',
                passphrase_protection: true,
            },
        });

        const getAddressCall = getAddress(true);
        await new Promise(resolve => {
            TrezorConnect.on('UI_EVENT', event => {
                if (event.type === 'ui-request_passphrase') {
                    resolve(undefined);
                }
            });
        });
        TrezorConnect.cancel();

        const response = await getAddressCall;

        expect(response.success).toEqual(false);

        await assertGetAddressWorks();
    });
});
