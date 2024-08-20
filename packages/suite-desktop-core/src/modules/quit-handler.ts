import { once } from 'events';

import { createTimeoutPromise } from '@trezor/utils';

import { app } from '../typed-electron';

import type { Dependencies, Module } from './index';

export const SERVICE_NAME = 'quit-handler';

export const init: Module = ({ mainWindow, mainThreadEmitter }: Dependencies) => {
    const { logger } = global;

    let registeredModules = 0;
    let readyToQuit = false;

    return () => {
        mainThreadEmitter.on('module/quit-handler-register', () => {
            registeredModules++;
        });

        app.on('before-quit', async event => {
            if (readyToQuit) return;
            logger.info(SERVICE_NAME, 'Quitting all modules');
            event.preventDefault();
            mainThreadEmitter.emit('module/quit-handler-request');

            await Promise.race([
                // await acks from all registered modules
                Promise.all(
                    Array(registeredModules).fill(() =>
                        once(mainThreadEmitter, 'module/quit-handler-ack'),
                    ),
                ),
                // or timeout after 5s
                createTimeoutPromise(5000),
            ]);

            // global cleanup
            logger.info(SERVICE_NAME, 'All modules quit, exiting');
            mainWindow.removeAllListeners();
            logger.exit();

            readyToQuit = true;
            // little extra delay to let things flush
            await createTimeoutPromise(100);
            app.quit();
        });
    };
};
