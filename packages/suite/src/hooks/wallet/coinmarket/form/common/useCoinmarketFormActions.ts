import { selectAccounts, selectDevice } from '@suite-common/wallet-core';
import { amountToSatoshi, isEthereumAccountSymbol, isZero } from '@suite-common/wallet-utils';
import { BigNumber } from '@trezor/utils';
import { useCallback } from 'react';
import { UseFormReturn } from 'react-hook-form';
import {
    FORM_CRYPTO_TOKEN,
    FORM_OUTPUT_ADDRESS,
    FORM_OUTPUT_AMOUNT,
} from 'src/constants/wallet/coinmarket/form';
import { useSelector } from 'src/hooks/suite';
import { useBitcoinAmountUnit } from 'src/hooks/wallet/useBitcoinAmountUnit';
import { CoinmarketAccountOptionsGroupOptionProps } from 'src/types/coinmarket/coinmarket';
import {
    CoinmarketSellExchangeFormProps,
    CoinmarketUseFormActionsProps,
    CoinmarketUseFormActionsReturnProps,
} from 'src/types/coinmarket/coinmarketForm';
import { coinmarketGetSortedAccounts } from 'src/utils/wallet/coinmarket/coinmarketUtils';
import { cryptoToNetworkSymbol } from 'src/utils/wallet/coinmarket/cryptoSymbolUtils';

/**
 * shareable sub-hook used in useCoinmarketSellForm & useCoinmarketExchangeForm
 * @return functions and values to handle form inputs and update fee levels
 */
export const useCoinmarketFormActions = <T extends CoinmarketSellExchangeFormProps>({
    account,
    network,
    methods,
    inputNames,
    setAmountLimits,
    changeFeeLevel,
    composeRequest,
    setAccountOnChange,
}: CoinmarketUseFormActionsProps<T>): CoinmarketUseFormActionsReturnProps => {
    const { symbol } = account;
    const { shouldSendInSats } = useBitcoinAmountUnit(symbol);
    const accounts = useSelector(selectAccounts);
    const device = useSelector(selectDevice);
    const accountsSorted = coinmarketGetSortedAccounts({
        accounts,
        deviceState: device?.state,
    });

    const { getValues, setValue, clearErrors } =
        methods as unknown as UseFormReturn<CoinmarketSellExchangeFormProps>;
    const { outputs } = getValues();
    const tokenAddress = outputs?.[0]?.token;
    const tokenData = account.tokens?.find(t => t.contract === tokenAddress);
    const isBalanceZero = tokenData
        ? isZero(tokenData.balance || '0')
        : isZero(account.formattedBalance);

    // watch change in crypto amount and recalculate fees on change
    const onCryptoAmountChange = useCallback(
        (amount: string) => {
            setValue(FORM_OUTPUT_AMOUNT, amount || '', { shouldDirty: true });
        },
        [setValue],
    );

    // watch change in fiat amount and recalculate fees on change
    const onFiatAmountChange = useCallback(
        (cryptoInput: string) => {
            const cryptoInputValue =
                cryptoInput && shouldSendInSats
                    ? amountToSatoshi(cryptoInput, network.decimals)
                    : cryptoInput;
            setValue(FORM_OUTPUT_AMOUNT, cryptoInputValue || '', {
                shouldDirty: true,
                shouldValidate: false,
            });
        },
        [setValue, shouldSendInSats, network.decimals],
    );

    const onCryptoCurrencyChange = useCallback(
        (selected: CoinmarketAccountOptionsGroupOptionProps) => {
            const networkSymbol = cryptoToNetworkSymbol(selected.value);
            const account = accountsSorted.find(item => item.descriptor === selected.descriptor);

            if (!account) return;

            setValue(FORM_OUTPUT_ADDRESS, '');
            setValue(FORM_OUTPUT_AMOUNT, '');
            setValue(FORM_CRYPTO_TOKEN, selected?.contractAddress ?? null);

            if (networkSymbol && isEthereumAccountSymbol(networkSymbol)) {
                // set token address for ERC20 transaction to estimate the fees more precisely
                setValue(FORM_OUTPUT_ADDRESS, selected?.contractAddress ?? '');
            }

            if (networkSymbol === 'sol') {
                setValue(FORM_OUTPUT_ADDRESS, selected?.descriptor ?? '');
            }

            setValue('setMaxOutputId', undefined);
            setValue(inputNames.cryptoInput, '');
            setValue(inputNames.fiatInput, '');
            setAmountLimits(undefined);

            setAccountOnChange(account);

            changeFeeLevel('normal'); // reset fee level
        },
        [
            accountsSorted,
            inputNames.cryptoInput,
            inputNames.fiatInput,
            setValue,
            setAmountLimits,
            setAccountOnChange,
            changeFeeLevel,
        ],
    );

    const setRatioAmount = useCallback(
        (divisor: number) => {
            const amount = tokenData
                ? new BigNumber(tokenData.balance || '0')
                      .dividedBy(divisor)
                      .decimalPlaces(tokenData.decimals)
                      .toString()
                : new BigNumber(account.formattedBalance)
                      .dividedBy(divisor)
                      .decimalPlaces(network.decimals)
                      .toString();
            const cryptoInputValue = shouldSendInSats
                ? amountToSatoshi(amount, network.decimals)
                : amount;
            setValue(inputNames.cryptoInput, cryptoInputValue, { shouldDirty: true });
            setValue('setMaxOutputId', undefined, { shouldDirty: true });
            onCryptoAmountChange(cryptoInputValue);

            composeRequest(inputNames.cryptoInput);
        },
        [
            tokenData,
            account.formattedBalance,
            network.decimals,
            shouldSendInSats,
            inputNames.cryptoInput,
            setValue,
            onCryptoAmountChange,
            composeRequest,
        ],
    );

    const setAllAmount = useCallback(() => {
        setValue('setMaxOutputId', 0, { shouldDirty: true });
        setValue(inputNames.fiatInput, '', { shouldDirty: true });
        setValue(FORM_OUTPUT_AMOUNT, '', { shouldDirty: true });
        clearErrors([inputNames.fiatInput, inputNames.cryptoInput]);
        composeRequest(inputNames.cryptoInput);
    }, [inputNames.fiatInput, inputNames.cryptoInput, clearErrors, composeRequest, setValue]);

    return {
        isBalanceZero,

        onCryptoAmountChange,
        onFiatAmountChange,
        onCryptoCurrencyChange,
        setRatioAmount,
        setAllAmount,
    };
};
