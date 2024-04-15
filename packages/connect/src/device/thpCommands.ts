import { createHash, randomBytes } from 'crypto';
import { Messages } from '@trezor/transport';
import { thp as protocolThp } from '@trezor/protocol';
// import { createDeferred } from '@trezor/utils';
import type { Device } from './Device';
import { UiResponseThpPairingTag, DEVICE } from '../events';
import { ThpSettings } from '../types';

type DefaultMessageResponse = any;

// TODO: react to device disconnection?
// TODO: return type
export const thpCall = async (
    device: Device,
    name: keyof protocolThp.ThpMessageType | Messages.MessageKey,
    data: Record<string, unknown> = {},
): Promise<any> => {
    console.warn('THPCall', name, device.transportState);
    const result = await device.transport.call({
        session: device.activitySessionID!, // TODO: possible conflicts
        name,
        data,
        protocol: device.protocol,
        protocolState: device.transportState,
        // TODO: abort signal
    }).promise;
    console.warn('THPCall result', result);

    if (result.success) {
        if (
            (name === 'ThpStartPairingRequest' || name === 'ThpCodeEntryChallenge') &&
            result.payload.type === 'ThpPairingPreparationsFinished'
        ) {
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            return thpWaitForThpPairingTag(device);
        }

        // TODO: duplicate with DeviceCommands
        if (result.payload.type === 'ButtonRequest') {
            return thpCall(device, 'ButtonAck', {});
        }
        if (result.payload.type === 'Failure') {
            throw new Error('thpCall Failure');
        }
        if (result.payload.type === 'ThpError') {
            throw new Error('ThpError ' + result.payload.message.code);
        }
    }

    return result;
};

// Try to establish Trezor Host Protocol channel
// this operation is allowed to fail:
// - on older FW without THP
// - using older trezord, bridge older than 3.0.0 adds MESSAGE_MAGIC_HEADER_BYTE to each chunk
export const createThpChannel = async (device: Device) => {
    console.warn('createThpChannel');
    if (device.useLegacyProtocol()) {
        console.warn(`Trezor Host Protocol unavailable on bridge ${device.transport.version}`);

        // TODO: try protocolV1 anyway, it sill can be an older device...
        return false;
    }

    // already set
    // if (device.transportState.channel.toString('hex') !== 'ffff') {
    //     if (!device.features) {
    //         console.warn('Start pairing...', device.transportState);
    //         const handshake = await thpHandshake(device);
    //         console.warn('Hanshake success', handshake);
    //         if (!handshake.success) {
    //             return handshake;
    //         }

    //         // eslint-disable-next-line @typescript-eslint/no-use-before-define
    //         await thpPairing(device);
    //     }

    //     return;
    // }

    const createChannel = await thpCall(device, 'ThpCreateChannelRequest', {
        nonce: randomBytes(8),
    });

    if (createChannel.success) {
        const { properties, ...p } = createChannel.payload.message;
        device.properties = properties;
        device.transportState.setChannel(p.channel);
        device.transportState.updateHandshakeCredentials({ handshakeHash: p.handshakeHash });
    } else {
        throw new Error('ThpCreateChannelRequest error');
    }

    // if (withHandshake) {
    //     await thpHandshake(device);
    // }
};

const promptThpPairing = (device: Device) => {
    return new Promise<UiResponseThpPairingTag>((resolve, reject) => {
        device.commands!._cancelableRequest = () =>
            new Promise<void>(res => {
                console.warn('Rejecting....');
                reject();
                // console.warn('Waiting....');
                setTimeout(res, 3000);
            });

        device.emit(DEVICE.THP_PAIRING, device, (err, code) => {
            console.warn('--promptThpPairing resolve', err, code);
            device.commands!._cancelableRequest = undefined;
            if (err) {
                reject(err);
            } else {
                resolve(code);
            }
        });
    });
};

// TODO: duplicate with DeviceCommands
type PassphrasePromptResponse = {
    passphrase?: string;
    passphraseOnDevice?: boolean;
    cache?: boolean;
};
const promptPassphrase = (device: Device) => {
    return new Promise<PassphrasePromptResponse>((resolve, reject) => {
        device.emit(DEVICE.PASSPHRASE, device, (response, error?: Error) => {
            if (error) {
                reject(error);
            } else {
                resolve(response);
            }
        });
    });
};

const processQrCodeTag = (device: Device, value: string) => {
    const shaCtx = createHash('sha256');
    shaCtx.update(device.transportState.handshakeCredentials!.handshakeHash);
    shaCtx.update(Buffer.from(value, 'hex'));
    shaCtx.update(Buffer.from('PairingMethod_QrCode', 'utf-8'));
    const qrCode = shaCtx.digest().subarray(0, 16);
    const tagSha = createHash('sha256').update(Buffer.from(qrCode)).digest('hex');

    return thpCall(device, 'ThpQrCodeTag', {
        tag: tagSha,
    });
};

const processNfcTag = (device: Device, value: string) => {
    const shaCtx = createHash('sha256');
    shaCtx.update(device.transportState.handshakeCredentials!.handshakeHash);
    shaCtx.update(Buffer.from(value, 'hex'));
    shaCtx.update(Buffer.from('PairingMethod_NfcUnidirectional', 'utf-8'));
    const nfcCode = shaCtx.digest().subarray(0, 16);
    const tagSha = createHash('sha256').update(Buffer.from(nfcCode)).digest('hex');

    return thpCall(device, 'ThpNfcUnidirectionalTag', {
        tag: tagSha,
    });
};

const processCodeEntry = async (device: Device, value: string) => {
    const hostKeys = protocolThp.getCpaceHostKeys(
        Number(value), // TODO: what if starts with 0
        device.transportState!.handshakeCredentials!.handshakeHash,
    );
    const cpaceTrezor = await thpCall(device, 'ThpCodeEntryCpaceHost', {
        cpace_host_public_key: hostKeys.publicKey.toString('hex'),
    });

    if (!cpaceTrezor.success) throw new Error('cpaceTrezor unsuccessful');

    if (!cpaceTrezor.payload.message.cpace_trezor_public_key) {
        throw new Error('TODO: is it optional?');
    }

    const tag = protocolThp
        .getShareSecret(
            Buffer.from(cpaceTrezor.payload.message.cpace_trezor_public_key, 'hex'),
            hostKeys.privateKey,
        )
        .toString('hex');

    return thpCall(device, 'ThpCodeEntryTag', {
        tag,
    });
};

const processThpPairingResponse = (device: Device, { payload }: UiResponseThpPairingTag) => {
    console.warn('processThpPairingResponse', payload);

    if (payload.source === 'qr-code') {
        return processQrCodeTag(device, payload.value);
    }

    if (payload.source === 'nfc') {
        return processNfcTag(device, payload.value);
    }

    if (payload.source === 'code-entry') {
        return processCodeEntry(device, payload.value);
    }

    throw new Error(`Unknown THP pairing source + ${payload.source}`);
};

const thpWaitForThpPairingTag = (device: Device): Promise<DefaultMessageResponse> => {
    // const dfd = createDeferred();
    const readCancel = device.transport.receive({
        session: device.activitySessionID!,
        protocol: device.protocol,
        protocolState: device.transportState,
    });

    const cancelPromise = readCancel.promise
        .then(r => {
            if (!r.success) {
                console.warn('readCancelPromise resolved with error', r);

                //return Promise.resolve();
                // never resolve?
                return new Promise<DefaultMessageResponse>(() => {});
            }
            console.warn('readCancelPromise result success', r);

            // cp.resolve(r as unknown as DefaultMessageResponse);

            // TODO: type is wrong, r is a TransportResponse not DefaultMessageResponse
            // return r as unknown as DefaultMessageResponse;
            return new Promise<DefaultMessageResponse>(() => {});
        })
        .catch(e => {
            console.warn('readCancelPromise error', e);

            // never resolve?
            return new Promise<DefaultMessageResponse>(() => {});
            // throw new Error(`Unknown source + ${response.payload.source}`);
        });

    console.warn('thpWaitForThpPairingTag', device.transportState.handshakeCredentials);

    const pairingPromise = promptThpPairing(device).then(
        response => {
            readCancel.abort();

            console.warn('.. waiting for CP', cancelPromise);

            // if (readCancel) {
            //     throw new Error('End!');
            // }

            // return (
            //     cancelPromise
            //         .then(cp => {
            //             console.warn('cancelPromise resolved with error-1', cp);
            //         })
            //         .catch(e => {
            //             console.warn('cancelPromise resolved with error-2', e);
            //         })
            //         // eslint-disable-next-line @typescript-eslint/no-use-before-define
            //         .finally(() => processThpPairingResponse(device, response))
            // );

            return processThpPairingResponse(device, response);

            // const hostKeys = protocolThp.getCpaceHostKeys(
            //     response.payload.value,
            //     device.transportState!.handshakeCredentials!.handshakeHash,
            // );

            // return device.thpCall(device, 'Cancel', {})transport
            //     .send({
            //         session: device.activitySessionID!,
            //         protocol: device.protocol,
            //         protocolState: device.transportState,
            //         name: 'ThpCodeEntryCpaceHost',
            //         data: {
            //             cpace_host_public_key: hostKeys.publicKey.toString('hex'),
            //         },
            //     })
            //     .promise.then(() => {
            //         return new Promise<DefaultMessageResponse>(() => {});
            //     });
        },
        () => {
            console.warn('Trying to send cancelll!!!!!');

            // device.transportState.updateSyncBit('send');

            return device.transport.send({
                session: device.activitySessionID!,
                protocol: device.protocol,
                protocolState: device.transportState,
                name: 'Cancel',
                data: {},
            }).promise;
        },
    );

    console.warn('Waiting....');

    // return either cancel on Trezor or pairing process
    // return Promise.race([cancelPromise, pairingPromise]);
    return Promise.race([pairingPromise]);
};

export const getThpSession = async (device: Device) => {
    if (device.transportState.sessionId) {
        return device.transportState.sessionId;
    }

    const passphrase = await promptPassphrase(device)
        .then(response => {
            // const { passphrase, passphraseOnDevice, cache } = response;
            console.warn('PASSS', response);

            return response;
        })
        .catch(e => {
            console.warn('PASSS error', e);
        });

    if (passphrase) {
        const newSessionParams = passphrase.passphraseOnDevice
            ? { on_device: passphrase.passphraseOnDevice }
            : { passphrase: passphrase.passphrase };

        const newSession = await thpCall(device, 'ThpCreateNewSession', newSessionParams);

        device.transportState.setSessionId(newSession.payload.message.new_session_id);

        return newSession.payload.message.new_session_id;
    }
};

const thpPairing = async (device: Device, handshake: any, settings: ThpSettings) => {
    let isPaired = handshake.state;

    if (!isPaired) {
        const pairingReq = await thpCall(device, 'ThpStartPairingRequest', {
            host_name: settings.hostName,
        });
        if (!pairingReq.success) {
            return pairingReq;
        }

        // No_Method
        if (pairingReq.payload.type === 'ThpEndResponse') {
            isPaired = true;
        }

        if (pairingReq.payload.message.commitment) {
            // TODO: validate commitment later
            device.transportState.updateHandshakeCredentials({
                handshakeCommitment: pairingReq.payload.message.commitment,
            });
        }
    }

    if (!isPaired) {
        if (
            handshake.pairingMethods.includes(protocolThp.ThpPairingMethod.PairingMethod_CodeEntry)
        ) {
            const createCodeEntryChallenge = await thpCall(device, 'ThpCodeEntryChallenge', {
                challenge: Buffer.alloc(32).fill(1),
            });

            if (!createCodeEntryChallenge.success) {
                throw new Error('ThpCodeEntryChallenge unsuccessful');
            }
        }

        const pairedCredentials = await thpCall(device, 'ThpCredentialRequest', {
            host_static_pubkey: handshake.hostStaticPublicKey,
        });
        if (!pairedCredentials.success) {
            throw new Error(pairedCredentials.message);
        }

        console.warn('my new credentials!', pairedCredentials.payload);

        const createEndReq = await thpCall(device, 'ThpEndRequest', {});
        if (!createEndReq.success) {
            throw new Error(createEndReq.message);
        }

        isPaired = true;
    }
};

const getPairingMethods = (
    deviceMethods?: (protocolThp.ThpPairingMethod | keyof typeof protocolThp.ThpPairingMethod)[],
    settingsMethods?: (protocolThp.ThpPairingMethod | keyof typeof protocolThp.ThpPairingMethod)[],
) => {
    return deviceMethods?.flatMap(dm => {
        const value = typeof dm === 'string' ? protocolThp.ThpPairingMethod[dm] : dm;
        const isRequested =
            settingsMethods &&
            settingsMethods.find(sm => {
                const value2 = typeof sm === 'string' ? protocolThp.ThpPairingMethod[sm] : sm;

                return value === value2;
            });

        return isRequested ? value : [];
    });
};

// TODO: return type
export const thpHandshake = async (device: Device, settings: ThpSettings): Promise<any> => {
    const pairingMethods = getPairingMethods(
        device.properties?.pairing_methods,
        settings.pairingMethods,
    );

    if (!pairingMethods?.length) {
        throw new Error('No common pairing methods');
    }
    if (pairingMethods.includes(protocolThp.ThpPairingMethod.PairingMethod_NoMethod)) {
    }
    const hostStaticKeys = protocolThp.getCurve25519KeyPair(
        Buffer.from(settings.staticKeys, 'hex'),
    );
    const hostEphemeralKeys = protocolThp.getCurve25519KeyPair(randomBytes(32));
    const hostEphemeralPubKey = Buffer.from(hostEphemeralKeys.publicKey).toString('hex');

    const handshakeInit = await thpCall(device, 'ThpHandshakeInitRequest', {
        key: hostEphemeralPubKey,
    });
    if (!handshakeInit.success) {
        return handshakeInit;
    }

    const { trezorEphemeralPubkey, trezorEncryptedStaticPubkey } = handshakeInit.payload.message;

    const protocolState = device.transportState;

    // Result of ThpCredentialRequest below
    const knownCredentials = settings.knownCredentials || [];
    const handshakeCredentials = protocolThp.handleHandshakeInitResponse(
        handshakeInit.payload.message,
        protocolState,
        {
            hostStaticKeys,
            hostEphemeralKeys,
            knownCredentials,
        },
    );

    const { hostKey, trezorKey, trezorMaskedStaticPubkey, hostEncryptedStaticPubkey } =
        handshakeCredentials;

    device.transportState.updateHandshakeCredentials({
        pairingMethods, // TODO: move this after channel creation
        trezorEncryptedStaticPubkey,
        hostEncryptedStaticPubkey,
        handshakeHash: handshakeCredentials.handshakeHash,
        trezorKey,
        hostKey,
    });

    const handshakeCompletion = await thpCall(device, 'ThpHandshakeCompletionRequest', {
        hostPubkey: hostEncryptedStaticPubkey,
        noise: {
            pairing_methods: pairingMethods,
            host_pairing_credential: handshakeCredentials.credentials?.credential,
        },
        trezorMaskedStaticPubkey,
        trezorEphemeralPubkey,
        knownCredentials,
    });
    if (!handshakeCompletion.success) {
        return handshakeCompletion;
    }

    return {
        ...handshakeCompletion,
        payload: {
            message: {
                ...handshakeCompletion.payload.message,
                hostStaticPublicKey: hostStaticKeys.publicKey,
                pairingMethods,
            },
        },
    };
};

export const initThpChannel = async (device: Device, settings: any) => {
    console.warn('initThpChannel');
    if (device.protocol.name !== 'v2') {
        console.warn(`Trezor Host Protocol unavailable on bridge ${device.transport.version}`);

        // TODO: try protocolV1 anyway, it sill can be an older device...
        return false;
    }

    if (device.transportState.channel.toString('hex') === 'ffff') {
        await createThpChannel(device);
    }

    if (!device.features) {
        console.warn('Start pairing...', device.transportState);
        const handshake = await thpHandshake(device, settings);
        console.warn('Hanshake success', handshake);
        if (!handshake.success) {
            return handshake;
        }

        const pairing = await thpPairing(device, handshake.payload.message, settings);
        console.warn('Pairing success', pairing);
        // if (!pairing.success) {
        //     return pairing;
        // }
    }
};
