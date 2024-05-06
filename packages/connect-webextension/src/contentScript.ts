import { WindowServiceWorkerChannel } from '@trezor/connect-web/src/channels/window-serviceworker';
import { POPUP } from '@trezor/connect/src/events/popup';

/**
 * communication between service worker and both webextension and popup manager
 */
const channel = new WindowServiceWorkerChannel({
    name: 'trezor-connect',
    channel: {
        here: '@trezor/connect-content-script',
        peer: '@trezor/connect-webextension',
    },
});

channel.init().then(() => {
    // once script is loaded. send information about the webextension that injected it into the popup
    window.postMessage(
        {
            type: POPUP.CONTENT_SCRIPT_LOADED,
            payload: { ...chrome.runtime.getManifest(), id: chrome.runtime.id },
        },
        window.location.origin,
    );

    /**
     * Passing messages from service worker to popup
     */
    channel.on('message', message => {
        window.postMessage(message, window.location.origin);
    });

    /*
     * Passing messages from popup to service worker
     */
    window.addEventListener('message', event => {
        if (
            event.data?.channel?.here === '@trezor/connect-webextension' ||
            event.data?.type === POPUP.CONTENT_SCRIPT_LOADED
        ) {
            return;
        }
        if (event.source === window && event.data) {
            channel.postMessage(event.data, { usePromise: false });
        }
    });

    window.addEventListener('beforeunload', () => {
        window.postMessage(
            {
                type: POPUP.CLOSED,
            },
            window.location.origin,
        );
    });
});
