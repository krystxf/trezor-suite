import { NetworkSymbol } from '@suite-common/wallet-config';
import { selectFiatRatesByFiatRateKey } from '@suite-common/wallet-core';
import { Rate, TokenAddress } from '@suite-common/wallet-types';
import {
    amountToSatoshi,
    getFiatRateKey,
    getNetwork,
    toFiatCurrency,
} from '@suite-common/wallet-utils';
import { CryptoSymbol } from 'invity-api';
import { useSelector } from 'src/hooks/suite';
import { useBitcoinAmountUnit } from 'src/hooks/wallet/useBitcoinAmountUnit';
import { selectLocalCurrency } from 'src/reducers/wallet/settingsReducer';
import { mapTestnetSymbol } from 'src/utils/wallet/coinmarket/coinmarketUtils';
import { cryptoToNetworkSymbol } from 'src/utils/wallet/coinmarket/cryptoSymbolUtils';

interface CoinmarketBalanceProps {
    cryptoSymbol: CryptoSymbol | undefined;
    tokenAddress?: string | null;
    accountBalance?: string;
}

interface CoinmarketBalanceReturnProps {
    fiatValue: string | null;
    fiatRate: Rate | undefined;
    balance: string;
    networkSymbol: NetworkSymbol;
    tokenAddress: TokenAddress | undefined;
}

export const useCoinmarketFiatValues = ({
    accountBalance,
    cryptoSymbol,
    tokenAddress,
}: CoinmarketBalanceProps): CoinmarketBalanceReturnProps | null => {
    const defaultCryptoSymbol = 'btc';
    const networkSymbol = cryptoSymbol
        ? cryptoToNetworkSymbol(cryptoSymbol) ?? defaultCryptoSymbol
        : defaultCryptoSymbol;

    const symbolForFiat = mapTestnetSymbol(networkSymbol);
    const localCurrency = useSelector(selectLocalCurrency);
    const fiatRateKey = getFiatRateKey(symbolForFiat, localCurrency, tokenAddress as TokenAddress);
    const fiatRate = useSelector(state => selectFiatRatesByFiatRateKey(state, fiatRateKey));

    const network = getNetwork(networkSymbol);
    const { shouldSendInSats } = useBitcoinAmountUnit(networkSymbol);

    if (!network || !accountBalance || !localCurrency) return null;

    const balance = shouldSendInSats
        ? amountToSatoshi(accountBalance, network?.decimals ?? 8)
        : accountBalance;
    const fiatValue = toFiatCurrency(accountBalance, fiatRate?.rate, 2);

    return {
        fiatValue,
        fiatRate,
        balance,
        networkSymbol,
        tokenAddress: (tokenAddress ?? undefined) as TokenAddress | undefined,
    };
};
