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
    isFormLoading: boolean;
    isFormInvalid: boolean;
    providers: CoinmarketUtilsProvidersProps | undefined;
    quotes: ExchangeTrade[] | undefined;
    selectedQuote: ExchangeTrade | undefined;
    setSelectedQuote: (quote: ExchangeTrade | undefined) => void;
    bestRatedQuote: CoinmarketTradeDetailType | undefined;
}

export const CoinmarketFormOffersSwitcher = ({
    isFormLoading,
    isFormInvalid,
    providers,
    quotes,
    selectedQuote,
    setSelectedQuote,
    bestRatedQuote,
}: CoinmarketFormOffersSwitcherProps) => {
    const theme = useTheme();
    const { elevation } = useElevation();
    const cexQuote = quotes?.find(quote => !quote.isDex);
    const dexQuote = quotes?.find(quote => quote.isDex);
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
                    selectedQuote={selectedQuote}
                    isSelectable={!hasSingleOption}
                    onSelect={() => setSelectedQuote(cexQuote)}
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
                    selectedQuote={selectedQuote}
                    isSelectable={!hasSingleOption}
                    onSelect={() => setSelectedQuote(dexQuote)}
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
