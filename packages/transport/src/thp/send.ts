// send with ThpAck

import { thp as protocolThp } from '@trezor/protocol';
import { scheduleAction } from '@trezor/utils';

import { sendChunks } from '../utils/send';
import { readWithExpectedState, ReceiveThpMessageProps } from './receive';

type SendThpMessageProps = Omit<ReceiveThpMessageProps, 'messages'> & {
    chunks: Buffer[];
};

export const sendThpMessage = async ({
    protocolState,
    chunks,
    apiWrite,
    apiRead,
    signal,
}: SendThpMessageProps) => {
    const expectedResponses = protocolThp.getExpectedResponse(chunks[0]);
    const isAckExpected = protocolThp.isAckExpected(chunks[0]);
    if (!isAckExpected) {
        const sendResult = await sendChunks(chunks, apiWrite);
        if (!sendResult.success) {
            return sendResult;
        }
        protocolState?.setExpectedResponse(expectedResponses);

        return sendResult;
    }

    let tries = 0;
    protocolState?.setExpectedResponse([0x20]);

    const attempt = async (): ReturnType<typeof apiRead> => {
        try {
            const result = await scheduleAction(
                async attemptSignal => {
                    console.warn('---> sendThpMessage attempt start', tries);
                    // TODO: send should not time out
                    const sendResult = await sendChunks(chunks, apiWrite);
                    if (!sendResult.success) {
                        return sendResult;
                    }

                    console.warn('...trying to read ack', tries);

                    return readWithExpectedState(apiRead, protocolState, attemptSignal);
                },
                {
                    signal,
                    timeout: 3000,
                    attempts: 3,
                    attemptFailureHandler: e => {
                        if (e.message !== 'Aborted by timeout') {
                            // break attempts on unexpected errors
                            return e;
                        }
                        console.warn('sendThpMessage retransmission');
                    },
                },
            );

            console.warn('sendWithRetransmission result', tries, result);

            return result;
        } catch (error) {
            console.warn('sendWithRetransmission error', tries, error);
            throw error;
        }
    };

    const result = await attempt();
    protocolState?.updateSyncBit('send');
    protocolState?.setExpectedResponse(expectedResponses);
    console.warn('the final result!', result);

    return expectedResponses;
};
