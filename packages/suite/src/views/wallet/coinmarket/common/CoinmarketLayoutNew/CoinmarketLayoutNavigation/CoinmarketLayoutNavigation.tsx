import styled from 'styled-components';
import { useDevice, useSelector } from 'src/hooks/suite';
import { FirmwareType } from '@trezor/connect';
import CoinmarketLayoutNavigationItem from './CoinmarketLayoutNavigationItem';
import { Divider } from '@trezor/components';
import { spacings } from '@trezor/theme';
import { useMemo } from 'react';
import { EEACountryCodes } from 'src/constants/wallet/coinmarket/EEA';

const List = styled.div`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
`;

const SeparatorWrapper = styled.div`
    height: 42px;
`;

const CoinmarketLayoutNavigation = () => {
    const { device } = useDevice();
    const isBitcoinOnly = device?.firmwareType === FirmwareType.BitcoinOnly;
    const country = useSelector(
        state =>
            state.wallet.coinmarket.buy.buyInfo?.buyInfo?.country ??
            state.wallet.coinmarket.sell.sellInfo?.sellList?.country,
    );
    const isInEEA = useMemo(() => Boolean(country && EEACountryCodes.includes(country)), [country]);

    return (
        <List>
            <CoinmarketLayoutNavigationItem
                route="wallet-coinmarket-buy"
                title="TR_NAV_BUY"
                icon="plus"
            />
            <CoinmarketLayoutNavigationItem
                route="wallet-coinmarket-sell"
                title="TR_NAV_SELL"
                icon="minus"
            />

            {!isBitcoinOnly ? (
                <CoinmarketLayoutNavigationItem
                    route="wallet-coinmarket-exchange"
                    title="TR_NAV_EXCHANGE"
                    icon="trade"
                />
            ) : null}

            {isInEEA ? (
                <>
                    <SeparatorWrapper>
                        <Divider
                            orientation="vertical"
                            strokeWidth={1}
                            color="borderElevation0"
                            margin={{ left: spacings.sm, right: spacings.sm }}
                        />
                    </SeparatorWrapper>
                    <CoinmarketLayoutNavigationItem
                        route="wallet-coinmarket-dca"
                        title="TR_NAV_DCA"
                        icon="clock"
                    />
                </>
            ) : null}

            <CoinmarketLayoutNavigationItem
                route="wallet-coinmarket-transactions"
                title="TR_COINMARKET_LAST_TRANSACTIONS"
            />
        </List>
    );
};

export default CoinmarketLayoutNavigation;
