import TrezorConnect from './src';

import * as messages from '@trezor/protobuf/messages.json';
import { NodeUsbTransport, UdpTransport } from '../transport/src';

const abort = new AbortController();
const debugTransport =
    process.argv[2] === 'udp'
        ? new UdpTransport({ messages, debugLink: true, signal: abort.signal })
        : new NodeUsbTransport({ messages, debugLink: true, signal: abort.signal });

const initDebugLink = async () => {
    const enumerate = await debugTransport.enumerate().promise;
    if (!enumerate.success) {
        return;
    }
};

const debugLinkState = async channel => {
    const enumerate = await debugTransport.enumerate().promise;
    if (!enumerate.success) {
        return;
    }
    const acquire = await debugTransport.acquire({ input: enumerate.payload[0] }).promise;

    const highBytes = Buffer.from(channel, 'hex').readUInt16LE(); // Read the two bytes as a uint16
    const value = highBytes << 16; // Shift the highBytes by 16 bits to form a uint32

    const response = await debugTransport.call({
        name: 'DebugLinkGetState',
        // data: { thp_channel_id: value },
        data: { thp_channel_id: Buffer.from(channel, 'hex').readUInt16BE() },
        session: acquire.payload,
    }).promise;

    console.warn('DebugLinkState', response.payload);

    await debugTransport.release(enumerate.payload[0]).promise;
    await debugTransport.enumerate().promise;

    return response;
};

const debugLinkDecision = async () => {
    const enumerate = await debugTransport.enumerate().promise;
    if (!enumerate.success) {
        return;
    }
    const acquire = await debugTransport.acquire({ input: enumerate.payload[0] }).promise;

    await debugTransport.send({
        name: 'DebugLinkDecision',
        data: { button: 1 },
        session: acquire.payload,
    }).promise;

    await debugTransport.release(enumerate.payload[0]).promise;
    await debugTransport.enumerate().promise;
};

const getFeatures = device => {
    return TrezorConnect.getFeatures({
        device,
    });
};

const signTx = device => {
    const outputs = [];
    for (let i = 0; i < 4; i++) {
        const output = {
            address: 'momtnzR3XqXgDSsFmd8gkGxUiHZLde3RmA',
            amount: 7129,
            script_type: 'PAYTOADDRESS',
        };

        outputs.push(output);
    }

    return TrezorConnect.signTransaction({
        device,
        coin: 'Testnet',
        inputs: [
            {
                address_n: "m/44'/1'/0'/0/0",
                prev_hash: '58d56a5d1325cf83543ee4c87fd73a784e4ba1499ced574be359fa2bdcb9ac8e',
                prev_index: 1,
                amount: 1827955,
            },
            //     {
            //         address_n: "m/84'/1'/0'/0/0",
            //         amount: '129999867',
            //         prev_hash:
            //             'e294c4c172c3d87991b0369e45d6af8584be92914d01e3060fad1ed31d12ff00',
            //         prev_index: 0,
            //         script_type: 'SPENDWITNESS',
            //         sequence: 4294967293,
            //     },
        ],
        outputs,
        // refTxs: TX_CACHE(['58d56a']),
        coin: 'testnet',

        // outputs: [
        //     {
        //         address: '2MsiAgG5LVDmnmJUPnYaCeQnARWGbGSVnr3',
        //         amount: '10000000',
        //         script_type: 'PAYTOADDRESS',
        //     },
        //     {
        //         address: 'tb1q9l0rk0gkgn73d0gc57qn3t3cwvucaj3h8wtrlu',
        //         amount: '20000000',
        //         script_type: 'PAYTOADDRESS',
        //     },
        //     {
        //         address_n: "m/84'/1'/0'/1/0",
        //         amount: '99999694',
        //         script_type: 'PAYTOWITNESS',
        //     },
        // ],
    });
};

const run = async () => {
    const testStart = Date.now();
    TrezorConnect.on('DEVICE_EVENT', async event => {
        console.warn('DEVICE_EVENT', event);
        if (event.type === 'device-connect_unacquired' || event.type === 'device-connect') {
            // TrezorConnect.getAddress({
            //     device: { path: event.payload.path },
            //     path: "m/44'/0'/0'/0/0",
            // }).then(r => {
            //     console.warn(r);
            //     process.exit(1);
            // });
            await initDebugLink();

            signTx(event.payload).then(r => {
                console.warn(r);
                console.warn('Time--->', Math.round((Date.now() - testStart) / 1000));
                process.exit(1);
            });
        }
    });

    TrezorConnect.on('UI_EVENT', async event => {
        console.warn('UI_EVENT', event);
        if (event.type === 'ui-request_passphrase') {
            TrezorConnect.uiResponse({
                type: 'ui-receive_passphrase',
                payload: {
                    passphraseOnDevice: false,
                    // value: 'abcd',
                    value: '',
                },
            });
        }

        if (event.type === 'ui-request_thp_pairing') {
            const state = await debugLinkState(event.payload.device.protocolState?.channel);
            if (!state?.success) {
                throw new Error('DebugLinkState missing: ' + state.error);
            }

            // TODO: TrezorConnect.cancel();
            // await new Promise(resolve => setTimeout(resolve, 2000));
            // TrezorConnect.cancel();

            TrezorConnect.uiResponse({
                type: 'ui-receive_thp_pairing_tag',
                payload: {
                    source: 'code-entry',
                    value: state.payload.message.thp_pairing_code_entry_code,
                },
                // payload: {
                //     source: 'qr-code',
                //     value: state.payload.message.thp_pairing_secret,
                // },
                // payload: {
                //     source: 'nfc',
                //     value: state.payload.message.thp_pairing_secret,
                // },
            });
        }

        if (event.type === 'ui-button') {
            await debugLinkDecision();
        }
    });

    let transport = 'NodeUsbTransport';
    if (process.argv[2] === 'udp') {
        transport = 'UdpTransport';
    } else if (process.argv[2] === 'bridge') {
        transport = 'BridgeTransport';
    }

    await TrezorConnect.init({
        manifest: { appUrl: 'a', email: 'b' },
        transports: [transport],
        // transports: process.argv[2] === 'udp' ? ['UdpTransport'] : ['BridgeTransport'],
        pendingTransportEvent: false,
        // lazyLoad: true,
        thp: {
            hostName: 'TrezorConnect',
            staticKeys: '0007070707070707070707070707070707070707070707070707070707070747',
            knownCredentials: [
                // Trezor
                // {
                //     trezor_static_pubkey:
                //         '1317c99c16fce04935782ed250cf0cacb12216f739cea55257258a2ff9440763',
                //     credential:
                //         '0a0f0a0d5472657a6f72436f6e6e6563741220f69918996c0afa1045b3625d06e7e816b0c4c4bd3902dfd4cad068b3f2425ec8',
                // },
                // Emulator
                // {
                //     trezor_static_pubkey:
                //         '8a6c7ef08a100a29a59aaded32eb13e99b5740ce1489596d56f9e045045f8676',
                //     credential:
                //         '0a0f0a0d5472657a6f72436f6e6e65637412208f9a7d0ecb7b356752c7eeb308539f24683c1cd7ae93ad3426bbe7b32f304834',
                // },
            ],
            pairingMethods: [
                'PairingMethod_CodeEntry',
                'PairingMethod_QrCode',
                'PairingMethod_NFC_Unidirectional',
            ],
            // pairingMethods: ['PairingMethod_QrCode'],
            // pairingMethods: ['PairingMethod_NFC_Unidirectional'],
            // pairingMethods: ['PairingMethod_NoMethod'],
        },
    });

    // TrezorConnect.getAddress({ path: "m/44'/0'/0'/0/0" }).then(console.warn);
};

run();
