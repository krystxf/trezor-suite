import type { TransportProtocol } from '@trezor/protocol';
import type { BridgeProtocolMessage } from '../types';

// validate expected body:
// - string with hex (legacy bridge /call and /read results)
// - empty string (legacy bridge /write result, withMessage == false)
// - json string (protocol message)
// - parsed json string (parsed protocol message)
export function validateProtocolMessage(body: unknown, withMessage = true) {
    const isHex = (s: string) => /^[0-9A-Fa-f]+$/g.test(s); // TODO: trezor/utils accepts 0x prefix (eth)

    // Legacy bridge results
    if (typeof body === 'string' && (!body.length || isHex(body))) {
        return {
            data: body,
        };
    }

    let json: Record<string, any> | undefined;
    if (body && typeof body === 'object') {
        json = body;
    } else if (typeof body === 'string') {
        json = JSON.parse(body);
    }

    if (!json) {
        throw new Error('Invalid protocol body');
    }

    // validate TransportProtocol['name']
    if (typeof json.protocol !== 'string' || !/^bridge$|^v1$|^v2$/.test(json.protocol)) {
        throw new Error('Invalid protocol name');
    }
    if (withMessage && (typeof json.data !== 'string' || !isHex(json.data))) {
        throw new Error('Invalid protocol data');
    }

    return {
        protocol: json.protocol,
        data: json.data,
        state: json.state,
    } as BridgeProtocolMessage;
}

export function createProtocolMessage(
    body: unknown,
    protocol?: TransportProtocol | TransportProtocol['name'],
    protocolState?: any,
) {
    let data;
    if (Buffer.isBuffer(body)) {
        data = body.toString('hex');
    }
    if (typeof body === 'string') {
        data = body;
    }

    if (typeof data !== 'string') {
        throw new Error('Unexpected data');
    }

    // Legacy bridge message
    if (!protocol) {
        return data;
    }

    return JSON.stringify({
        protocol: typeof protocol === 'string' ? protocol : protocol.name,
        data,
        state: protocolState,
    });
}
