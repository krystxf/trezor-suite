import { Alert } from 'react-native';

import * as Sentry from '@sentry/react-native';

import { getEnv, isDebugEnv, isDevelopOrDebugEnv } from '@suite-native/config';
import { Button, Card, ListItem, VStack, Text } from '@suite-native/atoms';
import {
    Screen,
    StackProps,
    DevUtilsStackParamList,
    DevUtilsStackRoutes,
    ScreenSubHeader,
} from '@suite-native/navigation';
import { clearStorage } from '@suite-native/storage';
import { getCommitHash, getSuiteVersion } from '@trezor/env-utils';
import { isBluetoothBuild, isBluetoothEnabled } from '@suite-native/bluetooth';
import { useCopyToClipboard } from '@suite-native/helpers';
import { logs, nativeBleManager } from '@trezor/transport-native-ble';

import { RenderingUtils } from '../components/RenderingUtils';
import { FeatureFlags } from '../components/FeatureFlags';
import { TestnetsToggle } from '../components/TestnetsToggle';
import { DiscoveryCoinsFilter } from '../components/DiscoveryCoinsFilter';
import { DevicePassphraseSwitch } from '../components/DevicePassphraseSwitch';
import { BluetoothToggle } from '../components/BluetoothToggle';

export const DevUtilsScreen = ({
    navigation,
}: StackProps<DevUtilsStackParamList, DevUtilsStackRoutes.DevUtils>) => {
    const copyToClipboard = useCopyToClipboard();

    return (
        <Screen screenHeader={<ScreenSubHeader content="DEV utils" />}>
            <VStack>
                <Card>
                    <VStack spacing="medium">
                        {!isDebugEnv() && (
                            <ListItem
                                subtitle={`${getEnv()}-${getSuiteVersion()}, commit ${getCommitHash()}`}
                                title="Build version"
                            />
                        )}
                        {isDebugEnv() && (
                            <Button onPress={() => navigation.navigate(DevUtilsStackRoutes.Demo)}>
                                See Component Demo
                            </Button>
                        )}
                        <FeatureFlags />
                        {isDevelopOrDebugEnv() && (
                            <>
                                <RenderingUtils />
                                <DevicePassphraseSwitch />
                                <DiscoveryCoinsFilter />
                                <Text>
                                    EXPO_PUBLIC_BLUETOOTH_ENABLED:{' '}
                                    {process.env.EXPO_PUBLIC_BLUETOOTH_ENABLED} {'\n'}
                                    EXPO_PUBLIC_ENVIRONMENT: {
                                        process.env.EXPO_PUBLIC_ENVIRONMENT
                                    }{' '}
                                    {'\n'}
                                    isBluetoothBuild: {isBluetoothBuild} {'\n'}
                                    isBluetoothEnabled: {isBluetoothEnabled}
                                </Text>
                                {isBluetoothBuild && <BluetoothToggle />}
                            </>
                        )}
                        <Button
                            onPress={() => {
                                nativeBleManager.eraseBondsForAllDevices();
                                Alert.alert(
                                    'BT bonds erased',
                                    "Don't forget to remove the device from system BT settings or it won't be able to pair again.",
                                );
                            }}
                            colorScheme="redBold"
                        >
                            🔵🗑️ Erase BT bonds
                        </Button>
                        <Button
                            onPress={() => {
                                copyToClipboard(logs.join('\n'));
                            }}
                        >
                            Copy BT logs
                        </Button>
                        <Button
                            onPress={() => {
                                const errorMessage = `Sentry test error - ${Date.now()}`;
                                Sentry.captureException(new Error(errorMessage));
                                Alert.alert('Sentry error thrown', errorMessage);
                            }}
                        >
                            Throw Sentry error
                        </Button>
                        <Button colorScheme="redBold" onPress={clearStorage}>
                            💥 Wipe all data
                        </Button>
                    </VStack>
                </Card>
                <Card>
                    <TestnetsToggle />
                </Card>
            </VStack>
        </Screen>
    );
};
