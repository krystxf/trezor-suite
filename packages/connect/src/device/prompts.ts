import { Messages, TRANSPORT_ERROR } from '@trezor/transport';

import { ERRORS } from '../constants';
import { DEVICE } from '../events';
import type { Device, DeviceEvents } from './Device';

export type PromptPassphraseResponse = {
    passphrase?: string;
    passphraseOnDevice?: boolean;
    cache?: boolean;
};

export type PromptCallback<T> = (response: T | null, error?: Error) => void;

const cancelPrompt = (device: Device) => {
    if (!device.activitySessionID) {
        return Promise.resolve({
            success: false,
            error: TRANSPORT_ERROR.SESSION_NOT_FOUND,
        } as const);
    }

    return device.transport.call({
        session: device.activitySessionID,
        name: 'Cancel',
        data: {},
        protocol: device.protocol,
    }).promise;
};

type PromptEvents = typeof DEVICE.PIN | typeof DEVICE.PASSPHRASE | typeof DEVICE.WORD;
// infer all args but one (callback)
type PromptArgs<T extends unknown[]> = T extends readonly [...infer A, any] ? A : never;
type DeviceEventCallback<K extends keyof DeviceEvents> = DeviceEvents[K];
type AnyFn = (...args: any[]) => any;
// callback fn is either 2nd or 3rd param, find it and use it as return type of prompt promise
type PromptReturnType<K extends keyof DeviceEvents> = DeviceEvents[K] extends AnyFn
    ? Parameters<DeviceEvents[K]>[1] extends AnyFn
        ? NonNullable<Parameters<Parameters<DeviceEvents[K]>[1]>[0]>
        : Parameters<DeviceEvents[K]>[2] extends AnyFn
          ? NonNullable<Parameters<Parameters<DeviceEvents[K]>[2]>[0]>
          : never
    : never;

const prompt = <E extends PromptEvents>(
    event: E,
    ...[device, ...args]: PromptArgs<Parameters<DeviceEventCallback<E>>>
) => {
    return new Promise<PromptReturnType<E>>((resolve, reject) => {
        const cancelAndReject = (error?: Error) =>
            cancelPrompt(device).then(onCancel =>
                reject(
                    error ||
                        new Error(
                            onCancel.success
                                ? (onCancel.payload.message.message as string)
                                : onCancel.error,
                        ),
                ),
            );

        if (device.listenerCount(event) > 0) {
            device.setCancelableRequest(error => {
                device.setCancelableRequest();

                return cancelAndReject(error);
            });

            const callback: PromptCallback<PromptReturnType<E>> = (response, error) => {
                device.setCancelableRequest();
                if (error || response == null) {
                    cancelAndReject(error);
                } else {
                    resolve(response);
                }
            };

            const emitArgs = [event, device, ...args, callback] as unknown as Parameters<
                typeof device.emit<E>
            >;

            device.emit(...emitArgs);
        } else {
            cancelAndReject(ERRORS.TypedError('Runtime', `${event} callback not configured`));
        }
    });
};

export const promptPassphrase = (device: Device) => {
    return prompt(DEVICE.PASSPHRASE, device);
};

export const promptPin = (device: Device, type?: Messages.PinMatrixRequestType) => {
    return prompt(DEVICE.PIN, device, type);
};

export const promptWord = (device: Device, type: Messages.WordRequestType) => {
    return prompt(DEVICE.WORD, device, type);
};
