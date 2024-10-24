import { TouchableOpacity, View } from 'react-native';
import { useDispatch } from 'react-redux';

import { CryptoIcon } from '@suite-common/icons';
import { networks, NetworkSymbol } from '@suite-common/wallet-config';
import { Card, HStack, Text, Switch } from '@suite-native/atoms';
import { toggleEnabledDiscoveryNetworkSymbol } from '@suite-native/discovery';
import { prepareNativeStyle, useNativeStyles } from '@trezor/styles';
import { useToast } from '@suite-native/toasts';
import { Translation } from '@suite-native/intl';
import { useAlert } from '@suite-native/alerts';

import { useCoinEnabling } from '../hooks/useCoinEnabling';

type NetworkSymbolProps = {
    networkSymbol: NetworkSymbol;
    isEnabled: boolean;
    isToastEnabled: boolean;
};

const wrapperStyle = prepareNativeStyle<{ isEnabled: boolean }>((utils, { isEnabled }) => ({
    gap: 12,
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 14,
    alignItems: 'center',
    extend: [
        {
            condition: !isEnabled,
            style: {
                borderColor: utils.colors.borderElevation0,
                backgroundColor: utils.colors.backgroundTertiaryDefaultOnElevation0,
                shadowColor: 'transparent',
            },
        },
    ],
}));

const iconWrapperStyle = prepareNativeStyle(utils => ({
    paddingVertical: utils.spacings.small,
}));

export const NetworkSymbolSwitchItem = ({
    networkSymbol,
    isEnabled,
    isToastEnabled,
}: NetworkSymbolProps) => {
    const dispatch = useDispatch();
    const { applyStyle } = useNativeStyles();
    const { showToast } = useToast();
    const { enabledNetworkSymbols } = useCoinEnabling();
    const { showAlert } = useAlert();
    const { name } = networks[networkSymbol];

    const showOneNetworkSymbolAlert = () =>
        showAlert({
            title: <Translation id="moduleSettings.coinEnabling.oneNetworkSymbolAlert.title" />,
            description: (
                <Translation id="moduleSettings.coinEnabling.oneNetworkSymbolAlert.description" />
            ),
            primaryButtonTitle: (
                <Translation id="moduleSettings.coinEnabling.oneNetworkSymbolAlert.action" />
            ),
            primaryButtonVariant: 'redBold',
        });

    const handleEnabledChange = (isChecked: boolean) => {
        if (
            !isChecked &&
            enabledNetworkSymbols.length === 1 &&
            enabledNetworkSymbols.includes(networkSymbol)
        ) {
            showOneNetworkSymbolAlert();

            return;
        }

        if (isToastEnabled) {
            showToast({
                variant: 'default',
                message: isChecked ? (
                    <Translation
                        id="moduleSettings.coinEnabling.toasts.coinEnabled"
                        values={{ coin: _ => name }}
                    />
                ) : (
                    <Translation
                        id="moduleSettings.coinEnabling.toasts.coinDisabled"
                        values={{ coin: _ => name }}
                    />
                ),
                icon: 'check',
            });
        }
        dispatch(toggleEnabledDiscoveryNetworkSymbol(networkSymbol));
    };

    return (
        <TouchableOpacity
            onPress={_ => handleEnabledChange(!isEnabled)}
            accessibilityRole="togglebutton"
            activeOpacity={0.6}
        >
            <Card style={applyStyle(wrapperStyle, { isEnabled })}>
                <View style={applyStyle(iconWrapperStyle)}>
                    <CryptoIcon symbol={networkSymbol} />
                </View>
                <HStack justifyContent="space-between" spacing={12} flex={1} alignItems="center">
                    <Text variant="callout">{name}</Text>
                    <Switch onChange={handleEnabledChange} isChecked={isEnabled} />
                </HStack>
            </Card>
        </TouchableOpacity>
    );
};
