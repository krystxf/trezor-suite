import { useEffect } from 'react';
import { useDispatch } from 'react-redux';

import { VStack, Text } from '@suite-native/atoms';
import { NetworkSymbol } from '@suite-common/wallet-config';
import { Translation } from '@suite-native/intl';
import { Icon } from '@suite-common/icons';

import { useCoinEnabling } from '../hooks/useCoinEnabling';
import { NetworkSymbolSwitchItem } from './NetworkSymbolSwitchItem';

type DiscoveryCoinsFilterProps = {
    isValidationAndFeedbackEnabled?: boolean;
};

export const DiscoveryCoinsFilter = ({
    isValidationAndFeedbackEnabled = true,
}: DiscoveryCoinsFilterProps) => {
    const dispatch = useDispatch();
    const { enabledNetworkSymbols, availableNetworks, applyDiscoveryChanges } = useCoinEnabling();

    useEffect(() => {
        // This will run when the component is unmounted (leaving the screen) and trigger the applyDiscoveryChanges function
        return () => applyDiscoveryChanges();
    }, [applyDiscoveryChanges, dispatch, enabledNetworkSymbols]);

    const uniqueNetworkSymbols = [...new Set(availableNetworks.map(n => n.symbol))];

    return (
        <VStack spacing={12}>
            {uniqueNetworkSymbols.map((networkSymbol: NetworkSymbol) => (
                <NetworkSymbolSwitchItem
                    key={networkSymbol}
                    networkSymbol={networkSymbol}
                    isEnabled={enabledNetworkSymbols.includes(networkSymbol)}
                    isValidationAndFeedbackEnabled={isValidationAndFeedbackEnabled}
                />
            ))}
            <VStack paddingTop="small" paddingBottom="extraLarge" alignItems="center">
                <Icon name="questionLight" color="textSubdued" size="large" />
                <Text color="textSubdued" textAlign="center">
                    <Translation id="moduleSettings.coinEnabling.bottomNote" />
                </Text>
            </VStack>
        </VStack>
    );
};
