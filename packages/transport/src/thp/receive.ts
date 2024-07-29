// receive with ThpAck

import type { Root } from 'protobufjs/light';
import { decode as decodeProtobuf, createMessageFromType } from '@trezor/protobuf';
import { TransportProtocolState, thp as protocolThp, v2 as v2Protocol } from '@trezor/protocol';

import { receive } from '../utils/receive';
import { AsyncResultWithTypedError } from '../types';

export type ReceiveThpMessageProps = {
    messages: Root;
    apiWrite: (chunk: Buffer, signal?: AbortSignal) => AsyncResultWithTypedError<any, any>;
    apiRead: (signal?: AbortSignal) => AsyncResultWithTypedError<any, any>;
    protocolState?: TransportProtocolState;
    signal?: AbortSignal;
};

// Filter transport Api.read results and ignore unexpected messages
// retry indefinitely until aborted
export const readWithExpectedState = async (
    apiRead: ReceiveThpMessageProps['apiRead'],
    protocolState?: TransportProtocolState,
    signal?: AbortSignal,
): Promise<any> => {
    if (signal?.aborted) {
        throw new Error('Already aborted');
    }
    console.warn('readWithExpectedState start', signal?.aborted);
    const chunk = await apiRead(signal);

    if (signal?.aborted) {
        throw new Error('Already aborted after read');
    }

    console.warn('readWithExpectedState chunk', protocolState?.expectedResponses, chunk);
    // technically this done in send
    if (!chunk.success) {
        throw new Error(chunk.error);
    }

    const expected = protocolThp.isExpectedResponse(chunk.payload, protocolState);
    if (expected) {
        return chunk.payload;
    }

    console.warn(
        'readWithExpectedState chunk doesnt match',
        chunk.payload.subarray(0, 3),
        protocolState?.expectedResponses,
    );

    // TODO: setTimeout here?, check attempts and retry frequency?
    return readWithExpectedState(apiRead, protocolState, signal);
};

export const receiveThpMessage = async ({
    protocolState,
    apiRead,
    apiWrite,
    signal,
}: Omit<ReceiveThpMessageProps, 'messages'>): Promise<any> => {
    console.warn('receiveThpMessage start', protocolState);

    const decoded = await receive(
        () => readWithExpectedState(apiRead, protocolState, signal),
        v2Protocol,
    );

    const isAckExpected = protocolThp.isAckExpected(protocolState?.expectedResponses || []);
    if (isAckExpected) {
        const ack = protocolThp.encodeAck(decoded.header);
        console.warn('Writing Ack', ack);
        const ackResult = await apiWrite(ack, signal);

        if (!ackResult.success) {
            // TODO: what to do here?
        }
    }

    // if (isAckExpected) {
    //     protocolState?.updateSyncBit('recv');
    // }

    // if (protocolState?.shouldUpdateNonce(decoded.messageType)) {
    //     protocolState?.updateNonce('send');
    //     protocolState?.updateNonce('recv');
    // }

    return decoded;
};

export type ParseThpMessageProps = {
    messages: Root;
    decoded: Awaited<ReturnType<typeof receive>>;
    protocolState?: TransportProtocolState;
};

export const parseThpMessage = ({ decoded, messages, protocolState }: ParseThpMessageProps) => {
    console.warn('receiveAndParseThpMessage start');

    const isAckExpected = protocolThp.isAckExpected(protocolState?.expectedResponses || []);

    // make sure that THP protobuf messages are loaded
    protocolThp.loadProtobuf(messages);

    const protobufDecoder = (protobufMessageType: string | number, protobufPayload: Buffer) => {
        const { Message, messageName } = createMessageFromType(messages, protobufMessageType);
        const message = decodeProtobuf(Message, protobufPayload);

        return {
            messageName,
            message,
        };
    };

    const { messageName, message } = protocolThp.decode(decoded, protobufDecoder, protocolState);

    if (isAckExpected) {
        protocolState?.updateSyncBit('recv');
    }

    if (protocolState?.shouldUpdateNonce(messageName)) {
        protocolState?.updateNonce('send');
        protocolState?.updateNonce('recv');
    }

    return {
        message,
        type: messageName,
    };
};
