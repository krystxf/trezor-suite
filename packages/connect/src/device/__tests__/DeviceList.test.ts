import { parseConnectSettings } from '../../data/connectSettings';
import { DataManager } from '../../data/DataManager';
import { DeviceList } from '../DeviceList';

describe('DeviceList.init', () => {
    beforeAll(async () => {
        await DataManager.load(parseConnectSettings({ env: 'node' }));
    });

    it('pendingTransportEvent', () => {
        const list = new DeviceList();
        console.warn('DeviceList!', list);
    });

    it('multi-transport', () => {
        const list = new DeviceList();
        console.warn('DeviceList!', list);
    });
});
