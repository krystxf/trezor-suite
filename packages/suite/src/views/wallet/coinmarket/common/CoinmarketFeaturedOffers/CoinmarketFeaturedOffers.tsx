import CoinmarketFeaturedOffersItem from './CoinmarketFeaturedOffersItem';
import { getBestRatedQuote } from 'src/utils/wallet/coinmarket/coinmarketUtils';
import { WalletSubpageHeading } from 'src/components/wallet';
import { ExchangeTrade } from 'invity-api';
import { useCoinmarketFormContext } from 'src/hooks/wallet/coinmarket/form/useCoinmarketCommonForm';
import { useFilteredQuotesByRateType } from 'src/hooks/wallet/coinmarket/offers/useCoinmarketCommonOffers';

const CoinmarketFeaturedOffers = () => {
    const context = useCoinmarketFormContext();
    const {
        type,
        form: { state },
    } = context;
    const quotes = useFilteredQuotesByRateType(context);
    const featuredQuotes = quotes?.filter(quote => quote.infoNote);
    const noFeaturedOffers = !featuredQuotes || featuredQuotes.length === 0;
    if (state.isFormLoading || state.isFormInvalid || noFeaturedOffers) return null;

    const bestRatedQuote = getBestRatedQuote(quotes, type);

    return (
        <>
            <WalletSubpageHeading title="TR_COINMARKET_FEATURED_OFFERS_HEADING" />
            {featuredQuotes.map(_quote => {
                const quote = _quote as Exclude<typeof _quote, ExchangeTrade>; // for now only on sell and buy

                return (
                    <CoinmarketFeaturedOffersItem
                        key={quote?.orderId}
                        context={context}
                        quote={quote}
                        isBestRate={bestRatedQuote?.orderId === quote?.orderId}
                    />
                );
            })}
        </>
    );
};

export default CoinmarketFeaturedOffers;
