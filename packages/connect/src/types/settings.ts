import type { BlockchainSettings } from '@trezor/blockchain-link';
import type { ThpDeviceProperties, ThpMessageType } from '@trezor/protocol';
import type { Transport } from '@trezor/transport';

export type { SystemInfo } from '@trezor/connect-common';
export interface Manifest {
    appUrl: string;
    email: string;
}

export type Proxy = BlockchainSettings['proxy'];

export type ThpSettings = {
    hostName?: string;
    staticKeys: string;
    knownCredentials?: ThpMessageType['ThpCredentialResponse'][]; // TODO type
    pairingMethods: ThpDeviceProperties['pairing_methods'];
};

export interface ConnectSettingsPublic {
    manifest?: Manifest;
    connectSrc?: string;
    debug?: boolean;
    hostLabel?: string;
    hostIcon?: string;
    popup?: boolean;
    transportReconnect?: boolean;
    webusb?: boolean; // deprecated
    transports?: (Transport['name'] | Transport | (new (...args: any[]) => Transport))[];
    pendingTransportEvent?: boolean;
    lazyLoad?: boolean;
    interactionTimeout?: number;
    trustedHost: boolean;
    coreMode?: 'auto' | 'popup' | 'iframe';
    /* _extendWebextensionLifetime features makes the service worker in @trezor/connect-webextension stay alive longer */
    _extendWebextensionLifetime?: boolean;
    thp?: ThpSettings;
}

// internal part, not to be accepted from .init()
export interface ConnectSettingsInternal {
    origin?: string;
    configSrc: string;
    iframeSrc: string;
    popupSrc: string;
    webusbSrc: string;
    version: string;
    priority: number;
    extension?: string;
    env: 'node' | 'web' | 'webextension' | 'electron' | 'react-native';
    timestamp: number;
    proxy?: Proxy;
    sharedLogger?: boolean;
    useCoreInPopup?: boolean;
}

export type ConnectSettings = ConnectSettingsPublic & ConnectSettingsInternal;
