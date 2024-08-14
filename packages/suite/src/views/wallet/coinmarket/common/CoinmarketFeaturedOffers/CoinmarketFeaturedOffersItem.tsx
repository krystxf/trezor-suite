import styled, { useTheme } from 'styled-components';
import { Badge, Button, Card, Text } from '@trezor/components';
import { Translation } from 'src/components/suite';
import { spacingsPx } from '@trezor/theme';
import { CoinmarketUtilsProvider } from '../CoinmarketUtils/CoinmarketUtilsProvider';
import { SCREEN_QUERY } from '@trezor/components/src/config/variables';
import {
    isCoinmarketBuyOffers,
    isCoinmarketExchangeOffers,
    isCoinmarketSellOffers,
} from 'src/hooks/wallet/coinmarket/offers/useCoinmarketCommonOffers';
import {
    getCryptoQuoteAmountProps,
    getProvidersInfoProps,
    getSelectQuoteTyped,
} from 'src/utils/wallet/coinmarket/coinmarketTypingUtils';
import { getTagAndInfoNote } from 'src/utils/wallet/coinmarket/coinmarketUtils';
import { SellFiatTrade } from 'invity-api';
import { CoinmarketFormContextValues } from 'src/types/coinmarket/coinmarketForm';
import CoinmarketFeaturedOffersAmounts from './CoinmarketFeaturedOffersAmounts';
import CoinmarketFeaturedOffersPaymentInfo from './CoinmarketFeaturedOffersPaymentInfo';
import { CoinmarketTradeDetailType, CoinmarketTradeType } from 'src/types/coinmarket/coinmarket';

const OfferWrap = styled.div`
    min-height: 100px;
    margin-top: ${spacingsPx.md};
`;

const Offer = styled.div`
    display: flex;
    min-height: 100px;
    gap: ${spacingsPx.md};

    ${SCREEN_QUERY.BELOW_DESKTOP} {
        flex-wrap: wrap;
    }
`;

const OfferColumn = styled.div`
    display: flex;
    flex-direction: column;
    flex: none;

    ${SCREEN_QUERY.BELOW_LAPTOP} {
        width: 100%;
    }
`;

const OfferColumn1 = styled(OfferColumn)`
    width: 50%;
    justify-content: space-between;
    gap: ${spacingsPx.sm};

    ${SCREEN_QUERY.BELOW_LAPTOP} {
        width: 100%;
    }
`;

const OfferColumn2 = styled(OfferColumn)`
    flex-grow: 1;
    justify-content: center;
    gap: ${spacingsPx.xs};
`;

const OfferColumn3 = styled(OfferColumn)`
    margin-left: auto;
    justify-content: center;
`;

const OfferBadgeWrap = styled.div`
    display: flex;
    align-items: center;
    width: 100%;
    flex-wrap: wrap;
    gap: ${spacingsPx.xs};
`;

const ButtonWrapper = styled.div`
    width: 168px;

    ${SCREEN_QUERY.BELOW_LAPTOP} {
        width: 100%;
    }
`;

interface CoinmarketOffersItemProps {
    quote: CoinmarketTradeDetailType;
    context: CoinmarketFormContextValues<CoinmarketTradeType>;
    isBestRate: boolean;
}

const actionButtonText = (
    context: CoinmarketFormContextValues<CoinmarketTradeType>,
    quote: CoinmarketTradeDetailType,
) => {
    if (isCoinmarketBuyOffers(context)) {
        return <Translation id="TR_COINMARKET_FEATURED_OFFER_BUY" />;
    }
    if (isCoinmarketSellOffers(context)) {
        if (context.needToRegisterOrVerifyBankAccount(quote as SellFiatTrade))
            return <Translation id="TR_SELL_REGISTER" />;

        return <Translation id="TR_COINMARKET_FEATURED_OFFER_SELL" />;
    }
    if (isCoinmarketExchangeOffers(context)) {
        return <Translation id="TR_COINMARKET_FEATURED_OFFER_EXCHANGE" />;
    }
};

const CoinmarketFeaturedOffersItem = ({
    context,
    quote,
    isBestRate,
}: CoinmarketOffersItemProps) => {
    const theme = useTheme();
    const { callInProgress, type } = context;
    const providers = getProvidersInfoProps(context);
    const cryptoAmountProps = getCryptoQuoteAmountProps(quote, context);
    const { tag, infoNote } = getTagAndInfoNote(quote);
    const selectQuote = getSelectQuoteTyped(context);

    if (!cryptoAmountProps) return null;

    return (
        <OfferWrap>
            <Card>
                <Offer>
                    <OfferColumn1>
                        <OfferBadgeWrap>
                            {isBestRate && (
                                <Badge variant="primary">
                                    <Translation id="TR_COINMARKET_BEST_RATE" />
                                </Badge>
                            )}
                            {tag && <Badge variant="tertiary">{tag}</Badge>}
                            {infoNote && (
                                <Text typographyStyle="label" color={theme.textSubdued}>
                                    {infoNote}
                                </Text>
                            )}
                        </OfferBadgeWrap>
                        <CoinmarketFeaturedOffersAmounts quote={quote} />
                    </OfferColumn1>
                    <OfferColumn2>
                        <CoinmarketUtilsProvider exchange={quote.exchange} providers={providers} />
                        <CoinmarketFeaturedOffersPaymentInfo quote={quote} type={type} />
                    </OfferColumn2>
                    <OfferColumn3>
                        <ButtonWrapper>
                            {quote.status === 'LOGIN_REQUEST' ? (
                                <Button
                                    variant="tertiary"
                                    isFullWidth
                                    onClick={() => selectQuote(quote)}
                                >
                                    <Translation id="TR_LOGIN_PROCEED" />
                                </Button>
                            ) : (
                                <Button
                                    variant="tertiary"
                                    isFullWidth
                                    isLoading={callInProgress}
                                    isDisabled={!!quote.error || callInProgress}
                                    onClick={() => selectQuote(quote)}
                                    data-testid="@coinmarket/featured-offers/get-this-deal-button"
                                >
                                    {actionButtonText(context, quote)}
                                </Button>
                            )}
                        </ButtonWrapper>
                    </OfferColumn3>
                </Offer>
            </Card>
        </OfferWrap>
    );
};

export default CoinmarketFeaturedOffersItem;
