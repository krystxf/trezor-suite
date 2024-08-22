import styled, { useTheme } from 'styled-components';
import {
    borders,
    Elevation,
    mapElevationToBackground,
    nativeTypography,
    spacingsPx,
} from '@trezor/theme';
import { Spinner, Text, useElevation } from '@trezor/components';
import { Translation } from 'src/components/suite';
import { ExchangeTrade } from 'invity-api';
import {
    CoinmarketTradeDetailType,
    CoinmarketUtilsProvidersProps,
} from 'src/types/coinmarket/coinmarket';
import { CoinmarketFormOffersSwitcherItem } from './CoinmarketFormOffersSwitcherItem';
import { CoinmarketExchangeFormContextProps } from 'src/types/coinmarket/coinmarketForm';

const BestOffers = styled.div<{ $elevation: Elevation }>`
    padding: ${spacingsPx.xxs};
    gap: ${spacingsPx.xxs};
    border-radius: ${borders.radii.md};
    background-color: ${mapElevationToBackground};
`;

const ProviderNotFound = styled.div`
    text-align: center;
    padding: ${spacingsPx.md};
    font-size: ${nativeTypography.label.fontSize}px;
    color: ${({ theme }) => theme.textSubdued};
`;

const NoOffers = styled.div`
    height: 116px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: ${spacingsPx.xs};
    padding: ${spacingsPx.md};
    font-size: ${nativeTypography.label.fontSize}px;
`;

interface CoinmarketFormOffersSwitcherProps {
    context: CoinmarketExchangeFormContextProps;
    isFormLoading: boolean;
    isFormInvalid: boolean;
    providers: CoinmarketUtilsProvidersProps | undefined;
    quotes: ExchangeTrade[] | undefined;
    bestRatedQuote: CoinmarketTradeDetailType | undefined;
}

export const CoinmarketFormOffersSwitcher = ({
    context,
    isFormLoading,
    isFormInvalid,
    providers,
    quotes,
    bestRatedQuote,
}: CoinmarketFormOffersSwitcherProps) => {
    const theme = useTheme();
    const { setValue, getValues, dexQuotes } = context;
    const exchangeType = getValues('exchangeType');
    const { elevation } = useElevation();
    const cexQuote = quotes?.[0];
    const dexQuote = dexQuotes?.[0];
    const hasSingleOption = !cexQuote !== !dexQuote;

    if (isFormLoading && !isFormInvalid) {
        return (
            <BestOffers $elevation={elevation}>
                <NoOffers>
                    <Spinner size={32} isGrey={false} />
                    <Text typographyStyle="hint" color={theme.textSubdued}>
                        <Translation id="TR_COINMARKET_OFFER_LOOKING" />
                    </Text>
                </NoOffers>
            </BestOffers>
        );
    }

    if (!cexQuote && !dexQuote) {
        return (
            <BestOffers $elevation={elevation}>
                <NoOffers>
                    <Translation id="TR_COINMARKET_OFFER_NO_FOUND" />
                </NoOffers>
            </BestOffers>
        );
    }

    return (
        <BestOffers $elevation={elevation}>
            {cexQuote ? (
                <CoinmarketFormOffersSwitcherItem
                    selectedExchangeType={exchangeType}
                    isSelectable={!hasSingleOption}
                    onSelect={() => setValue('exchangeType', 'CEX')}
                    providers={providers}
                    quote={cexQuote}
                    isBestRate={bestRatedQuote?.orderId === cexQuote?.orderId}
                />
            ) : (
                <ProviderNotFound>
                    <Translation id="TR_COINMARKET_NO_CEX_PROVIDER_FOUND" />
                </ProviderNotFound>
            )}
            {dexQuote ? (
                <CoinmarketFormOffersSwitcherItem
                    selectedExchangeType={exchangeType}
                    isSelectable={!hasSingleOption}
                    onSelect={() => setValue('exchangeType', 'DEX')}
                    providers={providers}
                    quote={dexQuote}
                    isBestRate={bestRatedQuote?.orderId === dexQuote?.orderId}
                />
            ) : (
                <ProviderNotFound>
                    <Translation id="TR_COINMARKET_NO_DEX_PROVIDER_FOUND" />
                </ProviderNotFound>
            )}
        </BestOffers>
    );
};
