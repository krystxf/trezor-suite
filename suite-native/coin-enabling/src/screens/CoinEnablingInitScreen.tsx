import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch } from 'react-redux';
import { useEffect } from 'react';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';

import { A } from '@mobily/ts-belt';
import { useNavigation } from '@react-navigation/native';

import { Screen } from '@suite-native/navigation';
import { Box, Button, Text, VStack } from '@suite-native/atoms';
import { setIsCoinEnablingInitFinished } from '@suite-native/discovery';
import { Translation } from '@suite-native/intl';
import { prepareNativeStyle, useNativeStyles } from '@trezor/styles';

import { DiscoveryCoinsFilter } from '../components/DiscoveryCoinsFilter';
import { useCoinEnabling } from '../hooks/useCoinEnabling';

const buttonStyle = prepareNativeStyle<{ bottomInset: number }>((utils, { bottomInset }) => ({
    bottom: bottomInset,
    left: 0,
    right: 0,
    paddingHorizontal: utils.spacings.medium,
}));

export const CoinEnablingInitScreen = () => {
    const dispatch = useDispatch();
    const navigation = useNavigation();

    const { applyStyle } = useNativeStyles();
    const { bottom: bottomInset } = useSafeAreaInsets();
    const { enabledNetworkSymbols, applyDiscoveryChanges } = useCoinEnabling();

    const handleSaveTap = () => {
        dispatch(setIsCoinEnablingInitFinished(true));
        navigation.goBack();
    };

    useEffect(() => {
        return () => applyDiscoveryChanges();
    }, [applyDiscoveryChanges]);

    return (
        <>
            <Screen>
                <VStack paddingHorizontal="small">
                    <VStack paddingBottom="extraLarge">
                        <Text variant="titleSmall" color="textSubdued">
                            <Translation id="moduleHome.coinEnabling.title" />
                        </Text>
                        <Text color="textSubdued">
                            <Translation id="moduleHome.coinEnabling.subtitle" />
                        </Text>
                    </VStack>
                    <Box flex={1}>
                        <DiscoveryCoinsFilter isValidationAndFeedbackEnabled={false} />
                    </Box>
                </VStack>
            </Screen>
            <Box style={applyStyle(buttonStyle, { bottomInset })}>
                {A.isNotEmpty(enabledNetworkSymbols) && (
                    <Animated.View entering={SlideInDown} exiting={SlideOutDown}>
                        <Button onPress={handleSaveTap}>
                            <Translation id="moduleHome.coinEnabling.button" />
                        </Button>
                    </Animated.View>
                )}
            </Box>
        </>
    );
};
