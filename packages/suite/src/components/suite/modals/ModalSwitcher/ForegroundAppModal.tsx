import { FirmwareUpdate } from 'src/views/firmware/FirmwareUpdate';
import { FirmwareCustom } from 'src/views/firmware/FirmwareCustom';
import { Recovery } from 'src/views/recovery';
import { Backup } from 'src/views/backup';
import { useDispatch, useSelector } from 'src/hooks/suite';
import { closeModalApp } from 'src/actions/suite/routerActions';
import { InstallBridge } from 'src/views/suite/bridge';
import { UdevRules } from 'src/views/suite/udev';
import { Version } from 'src/views/suite/version';
import { SwitchDeviceLegacy } from 'src/views/suite/SwitchDevice/SwitchDeviceLegacy';
import { SwitchDevice } from 'src/views/suite/SwitchDevice/SwitchDevice';
import type { ForegroundAppRoute } from 'src/types/suite';
import { selectSuiteFlags } from 'src/reducers/suite/suiteReducer';
import { FunctionComponent } from 'react';
import { MultiShareBackupModal } from '../ReduxModal/UserContextModal/MultiShareBackupModal/MultiShareBackupModal';
import { BridgeRequested } from 'src/views/suite/bridge-requested';

// would not work if defined directly in the switch
const FirmwareType = () => <FirmwareUpdate shouldSwitchFirmwareType />;

const getForegroundApp = (app: ForegroundAppRoute['app'], isViewOnlyModeVisible: boolean) => {
    const map: Record<ForegroundAppRoute['app'], FunctionComponent<any>> = {
        firmware: FirmwareUpdate,
        'firmware-type': FirmwareType,
        'firmware-custom': FirmwareCustom,
        version: Version,
        // todo rename
        bridge: InstallBridge,
        'bridge-requested': BridgeRequested,
        udev: UdevRules,
        'switch-device': isViewOnlyModeVisible ? SwitchDevice : SwitchDeviceLegacy,
        recovery: Recovery,
        backup: Backup,
        'create-multi-share-backup': MultiShareBackupModal,
    };

    return map[app];
};

type ForegroundAppModalProps = {
    app: ForegroundAppRoute['app'];
    cancelable: boolean;
};

/** Modals (foreground applications) initiated by redux state.router.route */
export const ForegroundAppModal = ({ app, cancelable }: ForegroundAppModalProps) => {
    const { isViewOnlyModeVisible } = useSelector(selectSuiteFlags);
    const dispatch = useDispatch();

    const onCancel = () => dispatch(closeModalApp());

    // check if current route is a "foreground application" marked as isForegroundApp in router config
    // display it above requested physical route (route in url) or as fullscreen app
    // pass common params to "foreground application"
    // every app is dealing with "prerequisites" and other params (like action modals) on they own.
    const ForegroundApp = getForegroundApp(app, isViewOnlyModeVisible);

    return ForegroundApp && <ForegroundApp cancelable={cancelable} onCancel={onCancel} />;
};
