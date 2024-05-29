import * as messages from '@trezor/protobuf/messages.json';
import {
    v2 as protocol,
    thp as protocolThp,
    TransportProtocolState,
    TransportProtocol,
} from '@trezor/protocol';
import { createHash, randomBytes } from 'crypto';

import { BridgeTransport, NodeUsbTransport, UdpTransport, Transport } from './src';

function sha256(buffer: Buffer): Buffer {
    return createHash('sha256').update(buffer).digest();
}

interface TransportState {
    transport: Transport;
    protocol: TransportProtocol;
    path: any; // DeviceDescriptor
    session: `${number}`;
    channels: TransportProtocolState[];
}

interface Device {
    transports: TransportState[];
}

const USE_BRIDGE = false;
const USE_REAL_DEVICE = false;
const PAIRING_METHODS = [1]; // [2, 3, 4];
const USE_PAIRING: number = PAIRING_METHODS[0];

/* eslint-disable @typescript-eslint/no-use-before-define */

const run = async () => {
    const ctrl = new AbortController();
    let transport: Transport = USE_BRIDGE
        ? new BridgeTransport({ messages, signal: ctrl.signal })
        : new UdpTransport({ messages, signal: ctrl.signal });

    if (USE_REAL_DEVICE) {
        transport = new NodeUsbTransport({ messages, signal: ctrl.signal });
    }

    const transportState: TransportState = {
        transport,
        protocol,
        path: '',
        session: '0',
        channels: [],
    };

    const device: Device = {
        transports: [transportState],
    };

    let handshakeCommitment = Buffer.alloc(0);

    const codeEntryPairing = async (code: number, state: any) => {
        const hostKeys = protocolThp.getCpaceHostKeys(
            code,
            state.handshakeCredentials.handshakeHash,
        );

        const cpaceTrezor = await call('ThpCodeEntryCpaceHost', {
            cpace_host_public_key: hostKeys.publicKey,
        });

        if (!cpaceTrezor.success) throw new Error('cpaceTrezor unsuccessful');

        // 1. Set *shared_secret* = X25519(*cpace_host_private_key*, *cpace_trezor_public_key*).
        // 2. Set *tag* = SHA-256(*shared_secret*).

        const tag = protocolThp.getShareSecret(
            Buffer.from(cpaceTrezor.payload.message.cpace_trezor_public_key, 'hex'),
            hostKeys.privateKey,
        );

        const codeEntry = await call('ThpCodeEntryTag', {
            tag,
            // tag: Buffer.from(
            //     '2278a1ba6b91e6d5faaecf0978340b55ab4c74824f0d45222cdc3d4a7395fc65',
            //     'hex',
            // ),
        });

        if (!codeEntry.success) {
            throw new Error('ThpCodeEntryTag unsuccessful');
        }

        const { secret } = codeEntry.payload.message;
        const sha = sha256(Buffer.from(secret, 'hex'));

        console.warn('secret compare with commitment', sha.compare(handshakeCommitment));

        return codeEntry;
    };

    const qrCodePairing = (pairingSecret: any, state: any) => {
        const shaCtx = createHash('sha256');
        shaCtx.update(state.handshakeCredentials.handshakeHash);
        shaCtx.update(Buffer.from(pairingSecret, 'hex'));
        shaCtx.update(Buffer.from('PairingMethod_QrCode', 'utf-8'));
        const qrCode = shaCtx.digest().subarray(0, 16);
        const tagSha = sha256(Buffer.from(qrCode));

        return call('ThpQrCodeTag' as any, {
            tag: tagSha,
        });
    };

    const nfcPairing = (pairingSecret: any, state: any) => {
        const shaCtx = createHash('sha256');
        shaCtx.update(state.handshakeCredentials.handshakeHash);
        shaCtx.update(Buffer.from(pairingSecret, 'hex'));
        shaCtx.update(Buffer.from('PairingMethod_NfcUnidirectional', 'utf-8'));
        const nfcCode = shaCtx.digest().subarray(0, 16);
        const tagSha = sha256(Buffer.from(nfcCode));

        return call('ThpNfcUnidirectionalTag', {
            tag: tagSha,
        });
    };

    const call = async (name: string, data: any): Promise<any> => {
        const state = device.transports[0].channels[0];

        console.warn('Call', name, state);

        const result = await transport.call({
            name,
            data,
            protocolState: state,
            ...device.transports[0],
        }).promise;

        if (result.success) {
            if (
                (name === 'ThpStartPairingRequest' || name === 'ThpCodeEntryChallenge') &&
                result.payload.type === 'ThpPairingPreparationsFinished'
            ) {
                console.warn('Waitin before sending ' + USE_PAIRING + ' tag');

                await new Promise(resolve => setTimeout(resolve, 1000));

                const debugState = await call('DebugLinkGetState', {});
                const { thp_pairing_code_entry_code, thp_pairing_secret } =
                    debugState.payload.message;

                console.warn('debugState', debugState);

                if (USE_PAIRING === 2) {
                    return codeEntryPairing(thp_pairing_code_entry_code, state);
                } else if (USE_PAIRING === 3) {
                    return qrCodePairing(thp_pairing_secret, state);
                } else if (USE_PAIRING === 4) {
                    return nfcPairing(thp_pairing_secret, state);
                }

                throw new Error('Unknown paring ' + USE_PAIRING);
            }

            if (result.payload.type === 'ButtonRequest') {
                return call('ButtonAck', {});
            }
            if (['ThpError', 'Failure'].includes(result.payload.type)) {
                const { code, message } = result.payload.message;
                throw new Error(result.payload.type + ' ' + code + ': ' + message);
            }
        }

        return result;
    };

    await transport.init().promise;

    const devices = await transport.enumerate().promise;
    console.warn('TEST', devices);

    if (!devices.success || devices.payload.length < 1) {
        throw new Error('no devices');
    }

    const { path } = devices.payload[0];
    device.transports[0].path = path;
    const acquire = await transport.acquire({ input: { path, previous: null } }).promise;
    if (!acquire.success) {
        return;
    }
    device.transports[0].session = acquire.payload;

    const protocolState = new protocolThp.ThpProtocolState();

    device.transports[0].channels.push(protocolState);

    const startTime = Date.now();
    const callCreateChannel = await call('ThpCreateChannelRequest', {
        nonce: randomBytes(8),
    });
    if (!callCreateChannel.success) {
        throw new Error(callCreateChannel.message);
    }

    const { channel, handshakeHash } = callCreateChannel.payload.message;
    console.warn('callCreateChannel channel:', channel);

    protocolState.setChannel(channel);
    protocolState.updateHandshakeCredentials({ handshakeHash });

    const hostStaticKeys = protocolThp.getCurve25519KeyPair(randomBytes(32));
    const hostEphemeralKeys = protocolThp.getCurve25519KeyPair(randomBytes(32));
    const hostEphemeralPrivKey = Buffer.from(hostEphemeralKeys.privateKey).toString('hex');
    const hostEphemeralPubKey = Buffer.from(hostEphemeralKeys.publicKey).toString('hex');

    console.log('Host Ephemeral Private Key:', hostEphemeralPrivKey);
    console.log('Host Ephemeral Public Key:', hostEphemeralPubKey);

    const handshakeInit = await call('ThpHandshakeInitRequest', {
        key: hostEphemeralPubKey,
    });
    if (!handshakeInit.success) {
        throw new Error(handshakeInit.message);
    }

    const { trezorEphemeralPubkey, trezorEncryptedStaticPubkey } = handshakeInit.payload.message;

    // Result of ThpCredentialRequest below
    const knownCredentials = [
        // {
        //     staticPubkey: '00bf529fc8dd4662d4d1d1fa66368b8758c0b6673a1bb9d532d95ca607cbf700',
        //     credential: undefined,
        // },
        {
            trezor_static_pubkey:
                '2991323cda7f4d5e8a1d24a79d13d93495f23e9eb8bf4348cd55d7c50bda8322',
            credential:
                '0a0a0a08486f73744e616d651220489054607ae8deb607303831f1257352e3262aa17e530ffea66c081890ecbd52',
        },
    ];

    // const isKnown = protocolThp.findKnownPairingCredentials(
    //     Buffer.from(knownCredentials[0].trezor_static_pubkey, 'hex'),
    //     trezorEphemeralPubkey,
    // );

    const handshakeCredentials = protocolThp.handleHandshakeInitResponse(
        handshakeInit.payload.message,
        protocolState,
        {
            hostStaticKeys,
            hostEphemeralKeys,
            knownCredentials,
        },
    );

    // const handshakeCredentials = protocolThp.handleHandshakeInitResponse({
    //     hostStaticKeys,
    //     hostEphemeralKeys,
    //     trezorEphemeralPubkey,
    //     trezorEncryptedStaticPubkey,
    //     tag,
    //     handshakeHash: protocolState.handshakeCredentials!.handshakeHash,
    //     sendNonce: protocolState.sendNonce,
    //     recvNonce: protocolState.recvNonce,
    //     knownCredentials,
    // });

    const { hostKey, trezorKey, trezorMaskedStaticPubkey, hostEncryptedStaticPubkey } =
        handshakeCredentials;

    // console.warn('isKnown?', Buffer.compare(isKnown, trezorMaskedStaticPubkey));

    protocolState.updateHandshakeCredentials({
        trezorEncryptedStaticPubkey,
        hostEncryptedStaticPubkey,
        handshakeHash: handshakeCredentials.handshakeHash,
        trezorKey,
        hostKey,
    });

    // protocolState.handshakeCredentials = {
    //     trezorEncryptedStaticPubkey,
    //     hostEncryptedStaticPubkey,
    //     handshakeHash: handshakeHash2,
    //     trezorKey,
    //     hostKey,
    // };

    // if (knownCredentials.length === 1) return;

    const callHandshakeComplete = await call('ThpHandshakeCompletionRequest', {
        hostPubkey: hostEncryptedStaticPubkey,
        noise: {
            pairing_methods: PAIRING_METHODS,
            host_pairing_credential: handshakeCredentials.credentials?.credential,
        },
        trezorMaskedStaticPubkey,
        trezorEphemeralPubkey,
        knownCredentials,
    });
    if (!callHandshakeComplete.success) {
        throw new Error(callHandshakeComplete.message);
    }

    let isPaired = callHandshakeComplete.payload.message.state;

    console.warn('callHandshakeComplete', callHandshakeComplete.payload);

    if (!isPaired) {
        const pairingReq = await call('ThpStartPairingRequest', {
            host_name: 'HostName',
        });
        if (!pairingReq.success) {
            throw new Error(pairingReq.message);
        }

        // No_Method
        if (pairingReq.payload.type === 'ThpEndResponse') {
            isPaired = true;
        }

        if (pairingReq.payload.message.commitment) {
            handshakeCommitment = Buffer.from(pairingReq.payload.message.commitment, 'hex');
        }
    }

    if (!isPaired) {
        if (PAIRING_METHODS.includes(2)) {
            const createCodeEntryChallenge = await call('ThpCodeEntryChallenge', {
                challenge: Buffer.alloc(32).fill(1),
            });

            if (!createCodeEntryChallenge.success) {
                throw new Error('ThpCodeEntryChallenge unsuccessful');
            }
        }

        const pairedCredentials = await call('ThpCredentialRequest', {
            host_static_pubkey: hostStaticKeys.publicKey,
        });
        if (!pairedCredentials.success) {
            throw new Error(pairedCredentials.message);
        }

        console.warn('pairedCredentials', pairedCredentials, protocolState.handshakeCredentials);

        const createEndReq = await call('ThpEndRequest', {});
        if (!createEndReq.success) {
            throw new Error(createEndReq.message);
        }

        isPaired = true;
    }

    const features1 = await call('GetFeatures', {});
    if (!features1.success) {
        throw new Error(handshakeInit.message);
    }

    console.warn('TIME', Date.now() - startTime);

    if (!features1.payload.message.initialized) {
        const load = await call('LoadDevice', {
            pin: '',
            label: 'THP device',
            passphrase_protection: true,
            mnemonics: ['all all all all all all all all all all all all'],
            skip_checksum: true,
        });

        if (!load.success) {
            throw new Error(load.message);
        }
    }

    const createNewSession = await call('ThpCreateNewSession', {
        passphrase: 'pass1234',
        // passphrase: '',
        on_device: false,
    });
    if (!createNewSession.success) {
        throw new Error(createNewSession.message);
    }

    protocolState.setSessionId(createNewSession.payload.message.new_session_id);

    const features2 = await call('GetFeatures', {});
    if (!features2.success) {
        throw new Error(features2.message);
    }

    const getAddress = await call('GetAddress', {
        // address_n: [1, 1, 1],
        address_n: [44 | 0x80000000, 0 | 0x80000000, 0 | 0x80000000, 0, 0],
        show_display: true,
    });

    if (!getAddress.success) {
        throw new Error(getAddress.message);
    }

    if (getAddress) {
        process.exit(1);
    }

    // const ff2 = await transport.call({
    //     name: 'GetFeatures',
    //     data: {},
    //     // name: 'SignMessage',
    //     // data: {
    //     //     message: '00'.repeat(200),
    //     // },
    //     ...device.transports[0],
    // }).promise;

    // console.warn('call 2 features', ff2);

    // if (ff) return;

    // const decodedAck = decodeHandshakeAck(handshakeAck.payload);
    // console.warn('handshakeAck', handshakeAck.payload, decodedAck);
    /*



        const f = encodeProtobuf(
            channel, // chanel
            Buffer.from('0037', 'hex'),
            Buffer.alloc(0),
        );

        console.warn('GetFeatures:', f);

        const sendGetFeatures = await transport.send({
            name: 'GetFeatures',
            data: {},
            session,
            path,
            channel,
            protocol,
        }).promise;

        console.warn('sendGetFeatures', f, sendGetFeatures);

        const getFeaturesAck = await transport.receive({
            session,
            path,
            protocol,
        }).promise;

        console.warn('getFeaturesAck', getFeaturesAck);

        const getFeatures = await transport.receive({
            session,
            path,
            protocol,
        }).promise;

        if (!getFeatures.success) {
            return;
        }

        const sendGetFeaturesAck = await transport.send({
            name: 'ThpReadAck', // custom (!)
            data: {
                
            },
            session,
            path,
            protocol,
        }).promise;

        console.warn('sendGetFeaturesAck', sendGetFeaturesAck);

        const sendGetPk = await transport.send({
            name: 'GetPublicKey',
            data: { address_n: [1, 1, 1] },
            session: session,
            path,
            protocol,
        }).promise;

        console.warn('sendGetPk', sendGetPk);

        const getPkAck = await transport.receive({
            session: session,
            path,
            protocol,
        }).promise;

        console.warn('getPkAck', getPkAck);

        const pk = await transport.receive({
            session: session,
            path,
            protocol,
        }).promise;

        console.warn('pk', pk);

        if (!pk.success) {
            return;
        }

        const pkAck = await transport.send({
            name: 'ThpReadAck', // custom (!)
            data: {
 
            },
            session: session,
            path,
            protocol,
        }).promise;

        console.warn('pkAck', pkAck);


        */
};

run();
