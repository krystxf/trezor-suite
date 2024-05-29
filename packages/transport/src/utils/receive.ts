import { Root } from 'protobufjs/light';

import { decode as decodeProtobuf, createMessageFromType } from '@trezor/protobuf';
import { TransportProtocol, TransportProtocolState, thp as protocolThp } from '@trezor/protocol';

async function receiveRest(
    result: Buffer,
    receiver: () => Promise<Buffer>,
    offset: number,
    expectedLength: number,
    chunkHeader: Buffer,
): Promise<void> {
    if (offset >= expectedLength) {
        return;
    }
    const data = await receiver();
    // sanity check
    if (data == null) {
        throw new Error('Received no data.');
    }
    const length = offset + data.byteLength - chunkHeader.byteLength;
    Buffer.from(data).copy(result, offset, chunkHeader.byteLength, length);

    return receiveRest(result, receiver, length, expectedLength, chunkHeader);
}

export async function receive(receiver: () => Promise<Buffer>, protocol: TransportProtocol) {
    const data = await receiver();
    // TODO: what if received data is empty? fails on 'Attempt to access memory outside buffer bounds'
    // console.warn('received data', data);
    // const { length, messageType, payload } = protocol.decode(data);
    // console.warn('received data2', length, messageType, payload);
    // const result = Buffer.alloc(length);
    const decoded = protocol.decode(data);
    const result = Buffer.alloc(decoded.length);
    const chunkHeader = protocol.getChunkHeader(Buffer.from(data));

    if (decoded.length) {
        decoded.payload.copy(result);
    }

    await receiveRest(result, receiver, decoded.payload.length, decoded.length, chunkHeader);

    return { ...decoded, payload: result };
}

export async function receiveAndParse(
    messages: Root,
    receiver: () => Promise<Buffer>,
    protocol: TransportProtocol,
    protocolState?: TransportProtocolState,
) {
    const decoded = await receive(receiver, protocol);

    const protobufDecoder = (protobufMessageType: string | number, protobufPayload: Buffer) => {
        const { Message, messageName } = createMessageFromType(messages, protobufMessageType);
        const message = decodeProtobuf(Message, protobufPayload);

        return {
            messageName,
            message,
        };
    };

    if (protocol.name === 'v2') {
        // make sure that THP protobuf messages are loaded
        protocolThp.loadProtobuf(messages);

        const { messageName, message } = protocolThp.decode(
            decoded,
            protobufDecoder,
            protocolState,
        );

        return {
            message,
            type: messageName,
        };
    }

    const { messageName, message } = protobufDecoder(decoded.messageType, decoded.payload);

    return {
        message,
        type: messageName,
    };
}
