// Messages handled by THP layer on Trezor firmware are not defined in proto files

import type {
    ThpDeviceProperties,
    ThpPairingMethod,
    ThpProtobufMessageType,
} from './protobufTypes';

export type ThpError = {
    code: string;
    message: string;
};

export type ThpReadAck = {
    ack: true;
};

export type ThpCreateChannelRequest = {
    nonce: Buffer;
};

export type ThpCreateChannelResponse = {
    nonce: Buffer;
    channel: Buffer;
    properties: ThpDeviceProperties;
    handshakeHash: Buffer;
};

export type ThpHandshakeInitRequest = {
    key: Buffer;
    knownCredentials: {
        publicStaticKey: string;
        credential: string;
    }[];
};

export type ThpHandshakeInitResponse = {
    handshakeHash: Buffer;
    trezorEphemeralPubkey: Buffer;
    trezorEncryptedStaticPubkey: Buffer;
    trezorMaskedStaticPubkey: Buffer;
    tag: Buffer;
    hostEncryptedStaticPubkey: Buffer;
    hostKey: Buffer;
    trezorKey: Buffer;
};

export type ThpHandshakeCompletionRequest = {
    hostPubkey: Buffer;
    noise: {
        pairing_methods: ThpPairingMethod[];
        host_pairing_credential?: Buffer;
    };
};

export type ThpHandshakeCompletionResponse = {
    state: 0 | 1;
    tag: Buffer;
};

export type ThpMessageType = ThpProtobufMessageType & {
    ThpError: ThpError;
    ThpReadAck: ThpReadAck;
    ThpCreateChannelRequest: ThpCreateChannelRequest;
    ThpCreateChannelResponse: ThpCreateChannelResponse;
    ThpHandshakeInitRequest: ThpHandshakeInitRequest;
    ThpHandshakeInitResponse: ThpHandshakeInitResponse;
    ThpHandshakeCompletionRequest: ThpHandshakeCompletionRequest;
    ThpHandshakeCompletionResponse: ThpHandshakeCompletionResponse;
};

export type ThpHandshakeCredentials = {
    pairingMethods: ThpDeviceProperties['pairing_methods'];
    handshakeHash: Buffer;
    handshakeCommitment: Buffer;
    trezorEncryptedStaticPubkey: Buffer;
    hostEncryptedStaticPubkey: Buffer;
    hostKey: Buffer;
    trezorKey: Buffer;
};

export type ThpMessageSyncBit = 0 | 1;
