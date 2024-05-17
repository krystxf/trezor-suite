import { useSelector } from 'react-redux';
import { ReactNode } from 'react';

import { HStack, Text, Box } from '@suite-native/atoms';
import { Translation } from '@suite-native/intl';
import { prepareNativeStyle, useNativeStyles } from '@trezor/styles';
import { DeviceRootState, selectDeviceByState } from '@suite-common/wallet-core';
import { TypographyStyle } from '@trezor/theme';
import { TrezorDevice } from '@suite-common/suite-types/src/device';

import { ConnectionDot } from './ConnectionDot';

export type WalletDetailDeviceItemContentProps = {
    deviceState: NonNullable<TrezorDevice['state']>;
    headerTextVariant?: TypographyStyle;
    header: ReactNode;
    subHeader?: ReactNode;
    isPortfolioLabelDisplayed?: boolean;
    isPortfolioTrackerDevice: boolean;
};

const headerStyle = prepareNativeStyle(utils => ({
    flexShrink: 1,
    paddingRight: utils.spacings.small,
    alignItems: 'center',
    gap: utils.spacings.small,
}));

const headerTextStyle = prepareNativeStyle(() => ({
    flexShrink: 1,
}));

export const WalletDetailDeviceItemContent = ({
    deviceState,
    headerTextVariant,
    isPortfolioLabelDisplayed,
    header,
    subHeader,
    isPortfolioTrackerDevice,
}: WalletDetailDeviceItemContentProps) => {
    const { applyStyle } = useNativeStyles();
    const device = useSelector((state: DeviceRootState) => selectDeviceByState(state, deviceState));

    if (!device) {
        return null;
    }

    return (
        <>
            <HStack style={applyStyle(headerStyle)}>
                <Text
                    variant={headerTextVariant}
                    ellipsizeMode="tail"
                    numberOfLines={1}
                    style={applyStyle(headerTextStyle)}
                >
                    {header}
                </Text>
                {!isPortfolioTrackerDevice && <ConnectionDot isConnected={device.connected} />}
            </HStack>
            <Box>
                {isPortfolioTrackerDevice && isPortfolioLabelDisplayed && (
                    <Text variant="label" color="textSubdued">
                        <Translation id="deviceManager.status.portfolioTracker" />
                    </Text>
                )}
                {!isPortfolioTrackerDevice && (
                    <HStack alignItems="center" spacing="small">
                        <Text variant="label" color="textSubdued">
                            {subHeader}
                        </Text>
                    </HStack>
                )}
            </Box>
        </>
    );
};