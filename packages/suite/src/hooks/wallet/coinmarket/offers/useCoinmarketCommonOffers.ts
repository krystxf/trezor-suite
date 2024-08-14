import { useTimer } from '@trezor/react-utils';
import { useDevice } from 'src/hooks/suite';
import { InvityAPIReloadQuotesAfterSeconds } from 'src/constants/wallet/coinmarket/metadata';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
    CoinmarketTradeBuyType,
    CoinmarketTradeDetailMapProps,
    CoinmarketTradeExchangeType,
    CoinmarketTradeSellType,
    CoinmarketTradeType,
    UseCoinmarketCommonProps,
    UseCoinmarketCommonReturnProps,
} from 'src/types/coinmarket/coinmarket';
import {
    CoinmarketOffersContextValues,
    CoinmarketOffersMapProps,
} from 'src/types/coinmarket/coinmarketOffers';
import { useDispatch } from 'react-redux';
import { SET_MODAL_CRYPTO_CURRENCY } from 'src/actions/wallet/constants/coinmarketCommonConstants';
import { useServerEnvironment } from 'src/hooks/wallet/coinmarket/useServerEnviroment';
import { CoinmarketFormContextValues } from 'src/types/coinmarket/coinmarketForm';
import { getQuotesByRateType } from 'src/utils/wallet/coinmarket/exchangeUtils';

export const isCoinmarketBuyOffers = (
    offersContext: CoinmarketOffersMapProps[keyof CoinmarketOffersMapProps],
): offersContext is CoinmarketOffersMapProps[CoinmarketTradeBuyType] =>
    offersContext.type === 'buy';

export const isCoinmarketSellOffers = (
    offersContext: CoinmarketOffersMapProps[keyof CoinmarketOffersMapProps],
): offersContext is CoinmarketOffersMapProps[CoinmarketTradeSellType] =>
    offersContext.type === 'sell';

export const isCoinmarketExchangeOffers = (
    offersContext: CoinmarketOffersMapProps[keyof CoinmarketOffersMapProps],
): offersContext is CoinmarketOffersMapProps[CoinmarketTradeExchangeType] =>
    offersContext.type === 'exchange';

export const getFilteredSuccessQuotes = <T extends CoinmarketTradeType>(
    quotes: CoinmarketTradeDetailMapProps[T][] | undefined,
) => (quotes ? quotes.filter(q => q.error === undefined) : undefined);

export const useCoinmarketCommonOffers = <T extends CoinmarketTradeType>({
    type,
    selectedAccount,
}: UseCoinmarketCommonProps): UseCoinmarketCommonReturnProps<T> => {
    const dispatch = useDispatch();
    const timer = useTimer();
    const { account } = selectedAccount;
    const { isLocked, device } = useDevice();
    const [callInProgress, setCallInProgress] = useState<boolean>(
        type !== 'buy' ? isLocked() : false,
    );
    const [selectedQuote, setSelectedQuote] = useState<
        CoinmarketTradeDetailMapProps[T] | undefined
    >();

    const checkQuotesTimer = (callback: () => Promise<void>) => {
        if (!timer.isLoading && !timer.isStopped) {
            if (timer.resetCount >= 40) {
                timer.stop();
            }

            if (timer.timeSpend.seconds === InvityAPIReloadQuotesAfterSeconds) {
                callback();
            }
        }
    };

    useServerEnvironment();

    // after unmount set off CryptoSymbol for modals
    useEffect(() => {
        return () => {
            dispatch({
                type: SET_MODAL_CRYPTO_CURRENCY,
                modalCryptoSymbol: undefined,
            });
        };
    }, [dispatch]);

    return {
        callInProgress,
        account,
        selectedQuote,
        timer,
        device,
        setCallInProgress,
        setSelectedQuote,
        checkQuotesTimer,
    };
};

export const useFilteredQuotesByRateType = (
    context: CoinmarketFormContextValues<CoinmarketTradeType>,
) => {
    const { quotes } = context;
    const isExchange = isCoinmarketExchangeOffers(context);
    const rateType = isExchange ? context.getValues().rateType : undefined;
    const exchangeInfo = isExchange ? context.exchangeInfo : undefined;
    const exchangeQuotes = isExchange ? context.quotes : undefined;

    return useMemo(
        () => (rateType ? getQuotesByRateType(rateType, exchangeQuotes, exchangeInfo) : quotes),
        [quotes, exchangeQuotes, rateType, exchangeInfo],
    );
};

export const CoinmarketOffersContext =
    createContext<CoinmarketOffersContextValues<CoinmarketTradeType> | null>(null);

CoinmarketOffersContext.displayName = 'CoinmarketOffersContext';

export const useCoinmarketOffersContext = <T extends CoinmarketTradeType>() => {
    const context = useContext(CoinmarketOffersContext);
    if (context === null) throw Error('CoinmarketOffersContext used without Context');

    return context as CoinmarketOffersContextValues<T>;
};
