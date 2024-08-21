import { TrezordNode } from '@trezor/transport-bridge';
import { TypedEmitter } from '@trezor/utils';

import { createThread } from '../libs/thread';
import { Logger } from '../libs/logger';
import { convertILoggerToLog } from '../utils/IloggerToLog';

export interface TrezordNodeSettings {
    port: number;
    api: 'usb' | 'udp';
}

/**
 * Wrapper around TrezordNode that can be used with createThread
 */
export class TrezordNodeThread extends TypedEmitter<Record<string, never>> {
    private trezordNode: TrezordNode;

    constructor(settings: TrezordNodeSettings) {
        super();

        /**
         * We need a different instance from the global logger instance. Because we want to save bridge logs to memory
         * to make them available from bridge status page.
         */
        const logger = convertILoggerToLog(
            new Logger('debug', {
                writeToDisk: false,
                writeToMemory: true,
                // by default, bridge logs are not printed to console to avoid too much noise. The other reason why this is set to false
                // is that global logger has logic of turning it on and off depending on 'debug' mode (see logger/config message) and we don't have this implemented here
                // it would require putting bridgeLogger to the global scope which might be perceived as controversial
                writeToConsole: false,
                dedupeTimeout: 0,
            }),
            { serviceName: 'trezord-node' },
        );

        this.trezordNode = new TrezordNode({
            ...settings,
            assetPrefix: '../../build/node-bridge',
            logger,
        });
    }

    start() {
        this.trezordNode.start();
    }
    startDev() {
        this.trezordNode.startDev();
    }
    startTest() {
        this.trezordNode.startTest();
    }
    stop() {
        this.trezordNode.startTest();
    }
    statusReq() {
        return this.trezordNode.status();
    }
}

const init = (settings: TrezordNodeSettings) => {
    return new TrezordNodeThread(settings);
};

createThread(init);
