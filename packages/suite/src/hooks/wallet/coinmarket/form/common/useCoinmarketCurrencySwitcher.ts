import { Account } from '@suite-common/wallet-types';
import { amountToSatoshi, formatAmount } from '@suite-common/wallet-utils';
import { useDidUpdate } from '@trezor/react-utils';
import { UseFormReturn } from 'react-hook-form';
import {
    FORM_CRYPTO_INPUT,
    FORM_FIAT_INPUT,
    FORM_OUTPUT_AMOUNT,
    FORM_OUTPUT_FIAT,
} from 'src/constants/wallet/coinmarket/form';
import { useBitcoinAmountUnit } from 'src/hooks/wallet/useBitcoinAmountUnit';
import { CoinmarketAllFormProps } from 'src/types/coinmarket/coinmarketForm';
import { Network } from 'src/types/wallet';
import { coinmarketGetRoundedFiatAmount } from 'src/utils/wallet/coinmarket/coinmarketUtils';

interface CoinmarketUseCurrencySwitcherProps<T extends CoinmarketAllFormProps> {
    account: Account;
    methods: UseFormReturn<T>;
    quoteCryptoAmount: string | undefined;
    quoteFiatAmount: string | undefined;
    network: Network | null;
    inputNames: {
        cryptoInput: typeof FORM_CRYPTO_INPUT | typeof FORM_OUTPUT_AMOUNT;
        fiatInput: typeof FORM_FIAT_INPUT | typeof FORM_OUTPUT_FIAT;
    };
}

/**
 * Hook for switching between crypto and fiat amount in coinmarket Sell and Buy form
 */
export const useCoinmarketCurrencySwitcher = <T extends CoinmarketAllFormProps>({
    account,
    methods,
    quoteCryptoAmount,
    quoteFiatAmount,
    network,
    inputNames,
}: CoinmarketUseCurrencySwitcherProps<T>) => {
    const { setValue, getValues, watch } =
        methods as unknown as UseFormReturn<CoinmarketAllFormProps>;
    const { shouldSendInSats } = useBitcoinAmountUnit(account.symbol);
    const networkDecimals = network?.decimals ?? 8;
    const cryptoInputValue = watch(inputNames.cryptoInput);

    const toggleAmountInCrypto = () => {
        const { amountInCrypto } = getValues();

        if (!amountInCrypto) {
            const amount = shouldSendInSats
                ? amountToSatoshi(quoteCryptoAmount ?? '', networkDecimals)
                : quoteCryptoAmount;

            setValue(inputNames.cryptoInput, amount);
        } else {
            setValue(inputNames.fiatInput, coinmarketGetRoundedFiatAmount(quoteFiatAmount));
        }

        setValue('amountInCrypto', !amountInCrypto);
    };

    useDidUpdate(() => {
        const conversion = shouldSendInSats ? amountToSatoshi : formatAmount;

        if (!cryptoInputValue) {
            return;
        }

        setValue(inputNames.cryptoInput, conversion(cryptoInputValue, networkDecimals), {
            shouldValidate: true,
            shouldDirty: true,
        });
    }, [shouldSendInSats]);

    return {
        toggleAmountInCrypto,
    };
};
