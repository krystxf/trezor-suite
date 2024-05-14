// original file https://github.com/trezor/connect/blob/develop/src/js/device/DeviceList.js

import { TypedEmitter } from '@trezor/utils';
import { promiseAllSequence, createDeferred } from '@trezor/utils';
import {
    BridgeTransport,
    WebUsbTransport,
    NodeUsbTransport,
    UdpTransport,
    Transport,
    TRANSPORT,
    Descriptor,
    TRANSPORT_ERROR,
    isTransportInstance,
} from '@trezor/transport';
import { ERRORS } from '../constants';
import { DEVICE, TransportInfo } from '../events';
import { Device } from './Device';
import type { Device as DeviceTyped } from '../types';
import { DataManager } from '../data/DataManager';
import { getBridgeInfo } from '../data/transportInfo';
import { initLog } from '../utils/debug';
import { resolveAfter } from '../utils/promiseUtils';

// custom log
const _log = initLog('DeviceList');

/**
 * when TRANSPORT.START_PENDING is emitted, we already know that transport is available
 * but we wait with emitting TRANSPORT.START event to the implementator until we read from devices
 * in case something wrong happens and we never finish reading from devices for whatever reason
 * implementator could get stuck waiting from TRANSPORT.START event forever. To avoid this,
 * we emit TRANSPORT.START event after autoResolveTransportEventTimeout
 */
let autoResolveTransportEventTimeout: ReturnType<typeof setTimeout> | undefined;

interface DeviceListEvents {
    [TRANSPORT.START]: TransportInfo;
    [TRANSPORT.ERROR]: string;
    [DEVICE.CONNECT]: DeviceTyped;
    [DEVICE.CONNECT_UNACQUIRED]: DeviceTyped;
    [DEVICE.DISCONNECT]: DeviceTyped;
    [DEVICE.CHANGED]: DeviceTyped;
    [DEVICE.RELEASED]: DeviceTyped;
    [DEVICE.ACQUIRED]: DeviceTyped;
}

export class DeviceList extends TypedEmitter<DeviceListEvents> {
    // @ts-expect-erro has no initializer
    // transport: Transport;

    // array of transport that might be used in this environment
    transports: Transport[] = [];

    devices: { [path: string]: Device } = {};

    messages: JSON | Record<string, any>;
    creatingDevicesDescriptors: { [k: string]: Descriptor } = {};

    transportStartPending = 0;

    penalizedDevices: { [deviceID: string]: number } = {};

    transportFirstEventPromise: Promise<void> | undefined;

    constructor() {
        super();

        let { transports } = DataManager.getSettings();
        const { debug } = DataManager.getSettings();
        this.messages = DataManager.getProtobufMessages();

        // we fill in `transports` with a reasonable fallback in src/index.
        // since web index is released into npm, we can not rely
        // on that that transports will be always set here. We need to provide a 'fallback of the last resort'
        if (!transports?.length) {
            transports = ['BridgeTransport'];
        }

        const transportLogger = initLog('@trezor/transport', debug);

        // mapping of provided transports[] to @trezor/transport classes
        transports.forEach(transportType => {
            if (typeof transportType === 'string') {
                switch (transportType) {
                    case 'WebUsbTransport':
                        this.transports.push(
                            new WebUsbTransport({
                                messages: this.messages,
                                logger: transportLogger,
                            }),
                        );
                        break;
                    case 'NodeUsbTransport':
                        this.transports.push(
                            new NodeUsbTransport({
                                messages: this.messages,
                                logger: transportLogger,
                            }),
                        );
                        break;
                    case 'BridgeTransport':
                        this.transports.push(
                            new BridgeTransport({
                                latestVersion: getBridgeInfo().version.join('.'),
                                messages: this.messages,
                                logger: transportLogger,
                            }),
                        );
                        break;
                    case 'UdpTransport':
                        this.transports.push(
                            new UdpTransport({
                                logger: transportLogger,
                                messages: this.messages,
                                // sessionsClient: 'a',
                            }),
                        );
                        break;
                    default:
                        throw ERRORS.TypedError(
                            'Runtime',
                            `DeviceList.init: transports[] of unexpected type: ${transportType}`,
                        );
                }
            } else if (isTransportInstance(transportType)) {
                // custom Transport might be initialized without messages, update them if so
                if (!transportType.getMessage()) {
                    transportType.updateMessages(this.messages);
                }
                this.transports.push(transportType);
            } else {
                // runtime check
                throw ERRORS.TypedError(
                    'Runtime',
                    'DeviceList.init: transports[] of unexpected type',
                );
            }
        });
    }

    getActiveTransports() {
        return this.transports.filter(t => t.isActive());
    }

    /**
     * Init @trezor/transport and do something with its results
     */
    async init() {
        try {
            _log.debug('Initializing transports');
            let lastError:
                | Extract<
                      Awaited<ReturnType<Transport['init']>['promise']>,
                      { success: false }
                  >['error']
                | undefined;

            console.warn('Init with Transports', this.transports.length);

            // const initializedTransports: Transport['apiType'][] = [];
            let transportIndex = 0;
            for (const transport of this.transports) {
                // if (!initializedTransports.includes(transport.apiType) && !transport.isActive()) {
                if (!transport.isActive()) {
                    console.warn('initialize', transport.name, transport.apiType);
                    // @ts-expect-error
                    transport.name = 'TransportIndex-' + transportIndex;
                    const result = await transport.init().promise;
                    console.warn('initialized');
                    if (result.success) {
                        lastError = undefined;
                        // break;
                    } else {
                        lastError = result.error;
                    }
                } else {
                    console.warn('ignore initialize', transport.name, transport.apiType);
                }
                transportIndex++;
            }

            if (lastError) {
                this.emit(TRANSPORT.ERROR, lastError);

                return;
            }

            /**
             * listen to change of descriptors reported by @trezor/transport
             * we can say that this part lets connect know about
             * "external activities with trezor devices" such as device was connected/disconnected
             * or it was acquired or released by another application.
             * releasing/acquiring device by this application is not solved here but directly
             * where transport.acquire, transport.release is called
             */

            const q = this.getActiveTransports().map(
                transport => () => this.setupTransport(transport),
            );
            console.warn('SETUP', q);
            await promiseAllSequence(q);
            console.warn('Setup completed!', q);
        } catch (error) {
            // transport should never. lets observe it but we could even remove try catch from here
            console.error('DeviceList init error', error);
        }
    }

    connectQueue: any[] = [];

    private async handleConnectedDevice(descriptor: Descriptor, transport: Transport) {
        // creatingDevicesDescriptors is needed, so that if *during* creating of Device,
        // other application acquires the device and changes the descriptor,
        // the new unacquired device has correct descriptor
        console.warn(
            'handleConnectedDevice',
            this.creatingDevicesDescriptors,
            descriptor,
            typeof this._createAndSaveDevice,
        );

        const dfd = createDeferred({ a: 1 });
        this.connectQueue.push(dfd);

        if (this.connectQueue.length > 1) {
            console.warn('Await for queue!', transport.name, this.connectQueue);
            await promiseAllSequence(
                this.connectQueue.slice(0, this.connectQueue.length - 1).map(pr => () => {
                    return pr.promise;
                }),
            );
            console.warn('Queue resolved! continue...', transport.name, this.connectQueue);
        }

        const path = descriptor.path.toString();
        this.creatingDevicesDescriptors[path] = descriptor;

        const priority = DataManager.getSettings('priority');
        const penalty = this.getAuthPenalty();

        if (priority || penalty) {
            await resolveAfter(501 + penalty + 100 * priority, null).promise;
        }
        if (this.creatingDevicesDescriptors[path].session == null) {
            await this._createAndSaveDevice(descriptor, transport);
        } else {
            const device = this._createUnacquiredDevice(descriptor, transport);
            // this.devices[path] = device;
            this.devices[transport.name + '/' + path] = device;
            this.emit(DEVICE.CONNECT_UNACQUIRED, device.toMessageObject());
        }

        console.warn('handleConnectedDevice-end');

        dfd.resolve();
        this.connectQueue = this.connectQueue.filter(q => q !== dfd);
    }

    private async setupTransport(transport: Transport) {
        console.warn('setup', transport.name);
        transport.on(TRANSPORT.UPDATE, diff => {
            console.warn('TRANSPORT.UPDATE', transport.name, diff);
            diff.disconnected.forEach(descriptor => {
                const path = descriptor.path.toString();
                const device = this.devices[transport.name + '/' + path];
                if (device) {
                    device.disconnect();
                    delete this.devices[transport.name + '/' + path];
                    this.emit(DEVICE.DISCONNECT, device.toMessageObject());
                }
                // TODO: resolve/reject and remove from connectQueue
            });

            diff.connected.forEach(async descriptor =>
                this.handleConnectedDevice(descriptor, transport),
            );

            diff.acquiredElsewhere.forEach((descriptor: Descriptor) => {
                const path = descriptor.path.toString();
                const device = this.devices[transport.name + '/' + path];

                if (device) {
                    device.featuresNeedsReload = true;
                    device.interruptionFromOutside();
                }
            });

            diff.released.forEach(descriptor => {
                const path = descriptor.path.toString();
                const device = this.devices[transport.name + '/' + path];
                const methodStillRunning = !device?.commands?.disposed;

                if (device && methodStillRunning) {
                    device.keepSession = false;
                }
            });

            diff.releasedElsewhere.forEach(async descriptor => {
                const path = descriptor.path.toString();
                const device = this.devices[transport.name + '/' + path];
                await resolveAfter(1000, null).promise;

                if (device) {
                    // after device was released in another window wait for a while (the other window might
                    // have the intention of acquiring it again)
                    // and if the device is still reelased and has never been acquired before, acquire it here.
                    if (!device.isUsed() && device.isUnacquired() && !device.isInconsistent()) {
                        _log.debug('Create device from unacquired', device.toMessageObject());
                        await this._createAndSaveDevice(descriptor, transport);
                    }
                }
            });

            const events = [
                {
                    d: diff.changedSessions,
                    e: DEVICE.CHANGED,
                },
                {
                    d: diff.acquired,
                    e: DEVICE.ACQUIRED,
                },
                {
                    d: diff.released,
                    e: DEVICE.RELEASED,
                },
            ];

            events.forEach(({ d, e }) => {
                d.forEach(descriptor => {
                    const path = descriptor.path.toString();
                    const device = this.devices[transport.name + '/' + path];
                    if (device) {
                        _log.debug('Event', e, device.toMessageObject());
                        this.emit(e, device.toMessageObject());
                    }
                });
            });

            // whenever descriptors change we need to update them so that we can use them
            // in subsequent transport.acquire calls
            diff.descriptors.forEach(d => {
                this.creatingDevicesDescriptors[d.path] = d;
                const device = this.devices[transport.name + '/' + d.path];
                if (device) {
                    device.originalDescriptor = {
                        session: d.session,
                        path: d.path,
                        product: d.product,
                    };
                }
            });
        });

        // just like transport emits updates, it may also start producing errors, for example bridge process crashes.
        transport.on(TRANSPORT.ERROR, error => {
            this.emit(TRANSPORT.ERROR, error);
        });

        console.warn('first enumerate', transport.name);

        // enumerating for the first time. we intentionally postpone emitting TRANSPORT_START
        // event until we read descriptors for the first time
        const enumerateResult = await transport.enumerate().promise;

        console.warn('first enumerate result', transport.name, enumerateResult);

        if (!enumerateResult.success) {
            this.emit(TRANSPORT.ERROR, enumerateResult.error);

            return;
        }

        const descriptors = enumerateResult.payload;

        if (descriptors.length > 0 && DataManager.getSettings('pendingTransportEvent')) {
            this.transportStartPending = descriptors.length;
            // listen for self emitted events and resolve pending transport event if needed
            // this.on(DEVICE.CONNECT, this.resolveTransportEvent.bind(this));
            // this.on(DEVICE.CONNECT_UNACQUIRED, this.resolveTransportEvent.bind(this));
            // autoResolveTransportEventTimeout = setTimeout(() => {
            //     this.emit(TRANSPORT.START, this.getTransportInfo());
            // }, 10000);

            const connectSequence = promiseAllSequence(
                descriptors.map(descriptor => () => {
                    return this.handleConnectedDevice(descriptor, transport);
                }),
            );

            const fr = await Promise.race([
                connectSequence,
                new Promise(resolve => setTimeout(() => resolve('timeout'), 10000)),
            ]);

            this.emit(TRANSPORT.START, this.getTransportInfo());

            console.warn('--> all devices processed!', fr);

            // descriptors.forEach(async descriptor =>
            //     this.handleConnectedDevice(descriptor, transport).bind(this),
            // );

            // transport.listen();
            // transport.handleDescriptorsChange(descriptors);

            // await this.waitForTransportFirstEvent();
        } else {
            this.emit(TRANSPORT.START, this.getTransportInfo());
            transport.listen();
            transport.handleDescriptorsChange(descriptors);
        }

        console.warn('--- setup end', transport.name);
    }

    // private resolveTransportEvent() {
    //     console.warn(
    //         '---TODO---: clear event listener resolveTransportEvent',
    //         this.transportStartPending,
    //     );
    //     this.transportStartPending--;
    //     if (autoResolveTransportEventTimeout) {
    //         clearTimeout(autoResolveTransportEventTimeout);
    //     }
    //     if (this.transportStartPending === 0) {
    //         this.emit(TRANSPORT.START, this.getTransportInfo());
    //     }
    // }

    async waitForTransportFirstEvent() {
        this.transportFirstEventPromise = new Promise<void>(resolve => {
            const handler = () => {
                this.removeListener(TRANSPORT.START, handler);
                this.removeListener(TRANSPORT.ERROR, handler);
                resolve();
            };
            this.on(TRANSPORT.START, handler);
            this.on(TRANSPORT.ERROR, handler);
        });
        await this.transportFirstEventPromise;
    }

    private async _createAndSaveDevice(descriptor: Descriptor, transport: Transport) {
        _log.debug('Creating Device', descriptor);
        await this.handle(descriptor, transport);
    }

    private _createUnacquiredDevice(descriptor: Descriptor, transport: Transport) {
        _log.debug('Creating Unacquired Device', descriptor);
        const device = Device.createUnacquired(transport, descriptor);
        device.once(DEVICE.ACQUIRED, () => {
            // emit connect evethis.emit(DEVICE.CONNECTnt once device becomes acquired
            this.emit(DEVICE.CONNECT, device.toMessageObject());
        });

        return device;
    }

    private _createUnreadableDevice(
        descriptor: Descriptor,
        unreadableError: string,
        transport: Transport,
    ) {
        _log.debug('Creating Unreadable Device', descriptor, unreadableError);
        return Device.createUnacquired(transport, descriptor, unreadableError);
    }

    getDevice(path: string) {
        return this.devices[path];
    }

    asArray(): DeviceTyped[] {
        return this.allDevices().map(device => device.toMessageObject());
    }

    allDevices(): Device[] {
        return Object.keys(this.devices).map(key => this.devices[key]);
    }

    length() {
        return this.asArray().length;
    }

    transportType() {
        // return this.transport.name;
        const [transport] = this.getActiveTransports();
        return transport.name;
    }

    getTransportInfo(): TransportInfo {
        const [transport] = this.getActiveTransports();
        return {
            type: this.transportType(),
            version: transport.version,
            outdated: transport.isOutdated,
        };
    }

    dispose() {
        this.removeAllListeners();

        // if (autoResolveTransportEventTimeout) {
        //     clearTimeout(autoResolveTransportEventTimeout);
        // }
        // release all devices
        Promise.all(this.allDevices().map(device => device.dispose())).then(() => {
            // now we can be relatively sure that release calls have been dispatched
            // and we can safely kill all async subscriptions in transport layer
            this.getActiveTransports().forEach(transport => transport.stop());
        });
    }

    disconnectDevices() {
        this.allDevices().forEach(device => {
            // device.disconnect();
            this.emit(DEVICE.DISCONNECT, device.toMessageObject());
        });
    }

    async enumerate(transport: Transport) {
        // is this even used?
        const res = await transport.enumerate().promise;

        if (!res.success) {
            return;
        }

        res.payload.forEach(d => {
            if (this.devices[d.path]) {
                this.devices[d.path].originalDescriptor = {
                    session: d.session,
                    path: d.path,
                    product: d.product,
                };
                this.devices[d.path].activitySessionID = d.session;
            }
        });
    }

    addAuthPenalty(device: Device) {
        if (!device.isInitialized() || device.isBootloader() || !device.features.device_id) return;
        const deviceID = device.features.device_id;
        const penalty = this.penalizedDevices[deviceID]
            ? this.penalizedDevices[deviceID] + 500
            : 2000;
        this.penalizedDevices[deviceID] = Math.min(penalty, 5000);
    }

    private getAuthPenalty() {
        const { penalizedDevices } = this;

        return Object.keys(penalizedDevices).reduce(
            (penalty, key) => Math.max(penalty, penalizedDevices[key]),
            0,
        );
    }

    removeAuthPenalty(device: Device) {
        if (!device.isInitialized() || device.isBootloader() || !device.features.device_id) return;
        const deviceID = device.features.device_id;
        delete this.penalizedDevices[deviceID];
    }

    // main logic
    private async handle(descriptor: Descriptor, transport: Transport) {
        const path = transport.name + '/' + descriptor.path.toString();
        console.warn('Handle', path, transport.name);
        try {
            // "regular" device creation
            await this._takeAndCreateDevice(descriptor, transport);
        } catch (error) {
            _log.debug('Cannot create device', error);

            if (
                error.code === 'Device_NotFound' ||
                error.message === TRANSPORT_ERROR.DEVICE_NOT_FOUND ||
                error.message === TRANSPORT_ERROR.DEVICE_DISCONNECTED_DURING_ACTION ||
                error.message === TRANSPORT_ERROR.UNEXPECTED_ERROR ||
                // bridge died during device initialization
                error.message === TRANSPORT_ERROR.HTTP_ERROR
            ) {
                // do nothing
                // For example:
                // 1. connect device
                // 2. _createAndSaveDevice => handle => _takeAndCreateDevice => device.run()
                // 3. disconnect device
                // 4. some of the above mentioned errors is returned.
                delete this.devices[path];
            } else if (error.message === TRANSPORT_ERROR.SESSION_WRONG_PREVIOUS) {
                this.enumerate(transport);
                this._handleUsedElsewhere(descriptor, transport);
            } else if (
                // device was claimed by another application on transport api layer (claimInterface in usb nomenclature) but never released (releaseInterface in usb nomenclature)
                // the only remedy for this is to reconnect device manually
                // or possibly there are 2 applications without common sessions background
                error.message === TRANSPORT_ERROR.INTERFACE_UNABLE_TO_OPEN_DEVICE ||
                // catch one of trezord LIBUSB_ERRORs
                error.message?.indexOf(ERRORS.LIBUSB_ERROR_MESSAGE) >= 0 ||
                // we tried to initialize device (either automatically after enumeration or after user click)
                // but it did not work out. this device is effectively unreadable and user should do something about it
                error.code === 'Device_InitializeFailed'
            ) {
                console.warn('---> wtf here?', error.message);
                const device = this._createUnreadableDevice(
                    this.creatingDevicesDescriptors[path],
                    error.message,
                    transport,
                );
                this.devices[path] = device;
                this.emit(DEVICE.CONNECT_UNACQUIRED, device.toMessageObject());
            } else if (error.code === 'Device_UsedElsewhere') {
                // most common error - someone else took the device at the same time
                this._handleUsedElsewhere(descriptor, transport);
            } else {
                await resolveAfter(501, null).promise;
                await this.handle(descriptor, transport);
            }
        }
        delete this.creatingDevicesDescriptors[path];
    }

    private async _takeAndCreateDevice(descriptor: Descriptor, transport: Transport) {
        const device = Device.fromDescriptor(transport, descriptor);
        const path = transport.name + '/' + descriptor.path.toString();
        this.devices[path] = device;
        const promise = device.run();
        await promise;

        this.emit(DEVICE.CONNECT, device.toMessageObject());
    }

    private _handleUsedElsewhere(descriptor: Descriptor, transport: Transport) {
        const path = transport.name + '/' + descriptor.path.toString();

        const device = this._createUnacquiredDevice(
            this.creatingDevicesDescriptors[path],
            transport,
        );
        this.devices[path] = device;
        this.emit(DEVICE.CONNECT_UNACQUIRED, device.toMessageObject());
    }
}
