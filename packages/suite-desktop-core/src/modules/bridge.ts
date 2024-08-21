/**
 * Bridge runner
 */
import { isDevEnv } from '@suite-common/suite-utils';
import { validateIpcMessage } from '@trezor/ipc-proxy';

import { app, ipcMain } from '../typed-electron';
import { BridgeProcess } from '../libs/processes/BridgeProcess';
import { b2t } from '../libs/utils';
import { ThreadProxy } from '../libs/thread-proxy';
import type { TrezordNodeThread } from '../threads/bridge';

import type { Module, Dependencies } from './index';

const bridgeLegacy = app.commandLine.hasSwitch('bridge-legacy');
const bridgeLegacyDev = app.commandLine.hasSwitch('bridge-legacy-dev');
const bridgeLegacyTest = app.commandLine.hasSwitch('bridge-legacy-test');
// bridge node is intended for internal testing
const bridgeTest = app.commandLine.hasSwitch('bridge-test');
const bridgeDev = app.commandLine.hasSwitch('bridge-dev');

const skipNewBridgeRollout = app.commandLine.hasSwitch('skip-new-bridge-rollout');

export const SERVICE_NAME = 'bridge';

/**
 * Wrapper around TrezordNodeProxy that exposes a friendly API to the emitter
 */
export class TrezordNodeProxyClient {
    private proxy: ThreadProxy<TrezordNodeThread>;

    constructor(proxy: ThreadProxy<TrezordNodeThread>) {
        this.proxy = proxy;
    }

    start() {
        this.proxy.request('start', []);
    }
    startDev() {
        this.proxy.request('startDev', []);
    }
    startTest() {
        this.proxy.request('startTest', []);
    }
    stop() {
        this.proxy.request('stop', []);
    }
    status() {
        return this.proxy.request('status', []);
    }
}

const handleBridgeStatus = async (bridge: BridgeProcess | TrezordNodeProxyClient) => {
    const { logger } = global;

    logger.info('bridge', `Getting status`);
    const status = await bridge.status();
    logger.info('bridge', `Toggling bridge. Status: ${JSON.stringify(status)}`);

    ipcMain.emit('bridge/status', status);

    return status;
};

const start = async (bridge: BridgeProcess | TrezordNodeProxyClient) => {
    if (bridgeLegacy) {
        await bridge.start();
    } else if (bridgeLegacyDev) {
        await bridge.startDev();
    } else if (bridgeLegacyTest) {
        await bridge.startTest();
    } else {
        await bridge.start();
    }
};

const getBridgeInstance = async (store: Dependencies['store']) => {
    const legacyRequestedBySettings = store.getBridgeSettings().legacy;
    const { allowPrerelease } = store.getUpdateSettings();

    const legacyRequestedByArg = bridgeLegacy || bridgeLegacyDev || bridgeLegacyTest;

    // handle rollout
    if (store.getBridgeSettings().newBridgeRollout === undefined) {
        const newBridgeRollout = Math.round(Math.random() * 100) / 100;
        store.setBridgeSettings({ ...store.getBridgeSettings(), newBridgeRollout });
    }
    const newBridgeRollout = store.getBridgeSettings().newBridgeRollout || 0;
    // note that this variable is duplicated with UI
    const NEW_BRIDGE_ROLLOUT_THRESHOLD = 0.2;
    const legacyBridgeReasonRollout =
        !isDevEnv && !skipNewBridgeRollout && newBridgeRollout >= NEW_BRIDGE_ROLLOUT_THRESHOLD;

    if (
        legacyRequestedBySettings ||
        legacyRequestedByArg ||
        legacyBridgeReasonRollout ||
        !allowPrerelease
    ) {
        //return new BridgeProcess();
    }

    const threadProxy = new ThreadProxy<TrezordNodeThread>({
        name: 'bridge',
        keepAlive: true,
    });
    await threadProxy.run({
        port: 21325,
        api: bridgeDev || bridgeTest ? 'udp' : 'usb',
    });

    return new TrezordNodeProxyClient(threadProxy);
};

const load = async ({ store }: Dependencies) => {
    const { logger } = global;
    const bridge = await getBridgeInstance(store);

    app.on('before-quit', () => {
        logger.info(SERVICE_NAME, 'Stopping (app quit)');
        bridge.stop();
    });

    ipcMain.handle('bridge/toggle', async ipcEvent => {
        validateIpcMessage(ipcEvent);

        const status = await handleBridgeStatus(bridge);
        try {
            if (status.service) {
                await bridge.stop();
            } else {
                await start(bridge);
            }

            return { success: true };
        } catch (error) {
            return { success: false, error };
        } finally {
            handleBridgeStatus(bridge);
        }
    });

    ipcMain.handle('bridge/get-status', async ipcEvent => {
        validateIpcMessage(ipcEvent);

        try {
            const status = await bridge.status();

            return { success: true, payload: status };
        } catch (error) {
            return { success: false, error };
        }
    });

    ipcMain.handle(
        'bridge/change-settings',
        (ipcEvent, payload: { doNotStartOnStartup: boolean; legacy?: boolean }) => {
            validateIpcMessage(ipcEvent);

            try {
                store.setBridgeSettings(payload);

                return { success: true };
            } catch (error) {
                return { success: false, error };
            } finally {
                ipcMain.emit('bridge/settings', store.getBridgeSettings());
            }
        },
    );

    ipcMain.handle('bridge/get-settings', ipcEvent => {
        validateIpcMessage(ipcEvent);

        try {
            return { success: true, payload: store.getBridgeSettings() };
        } catch (error) {
            return { success: false, error };
        }
    });

    if (store.getBridgeSettings().doNotStartOnStartup) {
        return;
    }

    try {
        logger.info(
            SERVICE_NAME,
            `Starting (Legacy dev: ${b2t(bridgeLegacyDev)}, Legacy test: ${b2t(bridgeLegacyTest)}, Legacy: ${b2t(bridgeLegacy)}, Test: ${b2t(bridgeTest)})`,
        );
        await start(bridge);
        handleBridgeStatus(bridge);
    } catch (err) {
        logger.error(SERVICE_NAME, `Start failed: ${err.message}`);
    }
};

export const init: Module = dependencies => {
    let loaded = false;

    return () => {
        if (loaded) return;
        loaded = true;
        // TODO intentionally not awaited to mimic previous behavior, resolve later!
        load(dependencies);
    };
};
