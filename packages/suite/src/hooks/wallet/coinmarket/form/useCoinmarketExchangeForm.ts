import { useCallback, useState, useEffect, useRef, useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import type { ExchangeTrade, ExchangeTradeQuoteRequest } from 'invity-api';
import useDebounce from 'react-use/lib/useDebounce';
import {
    amountToSatoshi,
    formatAmount,
    getNetwork,
    toFiatCurrency,
} from '@suite-common/wallet-utils';
import { isChanged } from '@suite-common/suite-utils';
import { useActions, useDispatch, useSelector } from 'src/hooks/suite';
import invityAPI from 'src/services/suite/invityAPI';
import { saveQuoteRequest, saveQuotes } from 'src/actions/wallet/coinmarketExchangeActions';
import {
    addIdsToQuotes,
    getUnusedAddressFromAccount,
} from 'src/utils/wallet/coinmarket/coinmarketUtils';
import {
    getAmountLimits,
    getCexQuotesByRateType,
    getSuccessQuotesOrdered,
} from 'src/utils/wallet/coinmarket/exchangeUtils';
import { useFormDraft } from 'src/hooks/wallet/useFormDraft';
import { useCoinmarketNavigation } from 'src/hooks/wallet/useCoinmarketNavigation';
import { useBitcoinAmountUnit } from 'src/hooks/wallet/useBitcoinAmountUnit';
import { CryptoAmountLimits } from 'src/types/wallet/coinmarketCommonTypes';
import { Account } from '@suite-common/wallet-types';
import {
    CoinmarketTradeExchangeType,
    UseCoinmarketFormProps,
} from 'src/types/coinmarket/coinmarket';
import {
    CoinmarketExchangeFormContextProps,
    CoinmarketExchangeFormProps,
} from 'src/types/coinmarket/coinmarketForm';
import {
    FORM_OUTPUT_AMOUNT,
    FORM_OUTPUT_CURRENCY,
    FORM_OUTPUT_FIAT,
} from 'src/constants/wallet/coinmarket/form';
import { useCoinmarketExchangeFormDefaultValues } from 'src/hooks/wallet/coinmarket/form/useCoinmarketExchangeFormDefaultValues';
import {
    getFilteredSuccessQuotes,
    useCoinmarketCommonOffers,
} from 'src/hooks/wallet/coinmarket/offers/useCoinmarketCommonOffers';
import * as coinmarketExchangeActions from 'src/actions/wallet/coinmarketExchangeActions';
import { notificationsActions } from '@suite-common/toast-notifications';
import { useCoinmarketRecomposeAndSign } from 'src/hooks/wallet/useCoinmarketRecomposeAndSign';
import { Network } from '@suite-common/wallet-config';
import { SET_MODAL_CRYPTO_CURRENCY } from 'src/actions/wallet/constants/coinmarketCommonConstants';
import { useCoinmarketLoadData } from 'src/hooks/wallet/coinmarket/useCoinmarketLoadData';
import { useCoinmarketComposeTransaction } from 'src/hooks/wallet/coinmarket/form/common/useCoinmarketComposeTransaction';
import { useCoinmarketFormActions } from 'src/hooks/wallet/coinmarket/form/common/useCoinmarketFormActions';
import { useCoinmarketCurrencySwitcher } from 'src/hooks/wallet/coinmarket/form/common/useCoinmarketCurrencySwitcher';
import { useCoinmarketFiatValues } from './common/useCoinmarketFiatValues';
import { CoinmarketExchangeStepType } from 'src/types/coinmarket/coinmarketOffers';

export const useCoinmarketExchangeForm = ({
    selectedAccount,
    pageType = 'form',
}: UseCoinmarketFormProps): CoinmarketExchangeFormContextProps => {
    const type = 'exchange';
    const isNotFormPage = pageType !== 'form';
    const {
        exchangeInfo,
        quotesRequest,
        quotes,
        coinmarketAccount,
        selectedQuote,
        addressVerified,
    } = useSelector(state => state.wallet.coinmarket.exchange);
    // selectedAccount is used as initial state if this is form page
    // coinmarketAccount is used on offers page
    const [account, setAccount] = useState<Account>(() => {
        if (coinmarketAccount && isNotFormPage) {
            return coinmarketAccount;
        }

        return selectedAccount.account;
    });
    const { callInProgress, timer, device, setCallInProgress, checkQuotesTimer } =
        useCoinmarketCommonOffers<CoinmarketTradeExchangeType>({ selectedAccount, type });

    const { symbolsInfo } = useSelector(state => state.wallet.coinmarket.info);
    const dispatch = useDispatch();
    const { recomposeAndSign } = useCoinmarketRecomposeAndSign();

    const [amountLimits, setAmountLimits] = useState<CryptoAmountLimits | undefined>(undefined);

    const [innerQuotes, setInnerQuotes] = useState<ExchangeTrade[] | undefined>(
        getFilteredSuccessQuotes<CoinmarketTradeExchangeType>(quotes),
    );
    const [receiveAccount, setReceiveAccount] = useState<Account | undefined>();

    const [isSubmittingHelper, setIsSubmittingHelper] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);

    const [exchangeStep, setExchangeStep] =
        useState<CoinmarketExchangeStepType>('RECEIVING_ADDRESS');
    const {
        navigateToExchangeForm,
        navigateToExchangeDetail,
        navigateToExchangeOffers,
        navigateToExchangeConfirm,
    } = useCoinmarketNavigation(account);

    const {
        saveTrade,
        openCoinmarketExchangeConfirmModal,
        saveTransactionId,
        addNotification,
        verifyAddress,
        saveSelectedQuote,
        setCoinmarketExchangeAccount,
    } = useActions({
        saveTrade: coinmarketExchangeActions.saveTrade,
        openCoinmarketExchangeConfirmModal:
            coinmarketExchangeActions.openCoinmarketExchangeConfirmModal,
        saveTransactionId: coinmarketExchangeActions.saveTransactionId,
        addNotification: notificationsActions.addToast,
        verifyAddress: coinmarketExchangeActions.verifyAddress,
        saveSelectedQuote: coinmarketExchangeActions.saveSelectedQuote,
        setCoinmarketExchangeAccount: coinmarketExchangeActions.setCoinmarketExchangeAccount,
    });

    const { symbol } = account;
    const { shouldSendInSats } = useBitcoinAmountUnit(symbol);
    const network = getNetwork(account.symbol) as Network;

    const { defaultCurrency, defaultValues } = useCoinmarketExchangeFormDefaultValues(account);
    const exchangeDraftKey = 'coinmarket-exchange';
    const { getDraft, saveDraft, removeDraft } =
        useFormDraft<CoinmarketExchangeFormProps>(exchangeDraftKey);
    const draft = getDraft(exchangeDraftKey);
    const isDraft = !!draft;
    // eslint-disable-next-line no-nested-ternary
    const draftUpdated: CoinmarketExchangeFormProps | null = draft
        ? isNotFormPage
            ? {
                  ...draft,
              }
            : {
                  ...defaultValues,
                  amountInCrypto: draft.amountInCrypto,
                  receiveCryptoSelect: draft.receiveCryptoSelect,
                  rateType: draft.rateType,
                  exchangeType: draft.exchangeType,
              }
        : null;
    const methods = useForm({
        mode: 'onChange',
        defaultValues: draftUpdated ? draftUpdated : defaultValues,
    });
    const { reset, register, getValues, setValue, handleSubmit, formState, control } = methods;
    const values = useWatch<CoinmarketExchangeFormProps>({ control });
    const previousValues = useRef<typeof values | null>(isNotFormPage ? draftUpdated : null);
    const { rateType, exchangeType } = getValues();
    const fiatValues = useCoinmarketFiatValues({
        accountBalance: account.formattedBalance,
        cryptoSymbol: values?.sendCryptoSelect?.value,
        tokenAddress: values.outputs?.[0]?.token,
    });
    const fiatOfBestScoredQuote = innerQuotes?.[0]?.sendStringAmount
        ? toFiatCurrency(innerQuotes?.[0]?.sendStringAmount, fiatValues?.fiatRate?.rate, 2)
        : null;

    const formIsValid = Object.keys(formState.errors).length === 0;
    const hasValues =
        (values.outputs?.[0]?.fiat || values.outputs?.[0]?.amount) &&
        !!values.receiveCryptoSelect?.value;
    const isFirstRequest = innerQuotes === undefined;
    const noProviders = exchangeInfo?.exchangeList?.length === 0;
    const isLoading = !exchangeInfo?.exchangeList || !values?.outputs?.[0].address;
    const isFormLoading =
        isLoading || formState.isSubmitting || isSubmittingHelper || isFirstRequest;
    const isFormInvalid = !(formIsValid && hasValues);
    const isLoadingOrInvalid = noProviders || isFormLoading || isFormInvalid;

    const { isComposing, composedLevels, feeInfo, changeFeeLevel, composeRequest } =
        useCoinmarketComposeTransaction<CoinmarketExchangeFormProps>({
            account,
            network,
            values: values as CoinmarketExchangeFormProps,
            methods,
            inputAmountName: FORM_OUTPUT_AMOUNT,
        });

    const helpers = useCoinmarketFormActions({
        account,
        network,
        methods,
        inputNames: {
            currency: FORM_OUTPUT_CURRENCY,
            cryptoInput: FORM_OUTPUT_AMOUNT,
            fiatInput: FORM_OUTPUT_FIAT,
        },
        setAmountLimits,
        changeFeeLevel,
        composeRequest,
        setAccountOnChange: newAccount => {
            dispatch(setCoinmarketExchangeAccount(newAccount));
            setAccount(newAccount);
        },
    });

    const { toggleAmountInCrypto } = useCoinmarketCurrencySwitcher({
        account,
        methods,
        quoteCryptoAmount: innerQuotes?.[0]?.sendStringAmount,
        quoteFiatAmount: fiatOfBestScoredQuote ?? '',
        network,
        inputNames: {
            cryptoInput: FORM_OUTPUT_AMOUNT,
            fiatInput: FORM_OUTPUT_FIAT,
        },
    });

    const getQuotesRequest = useCallback(
        async (request: ExchangeTradeQuoteRequest) => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }

            if (!request.send || !request.receive || !request.sendStringAmount) {
                timer.stop();

                return;
            }

            abortControllerRef.current = new AbortController();
            invityAPI.createInvityAPIKey(account.descriptor);

            try {
                const allQuotes = await invityAPI.getExchangeQuotes(
                    request,
                    abortControllerRef.current.signal,
                );

                return allQuotes;
            } catch (error) {
                console.log('Abort', error);
            }
        },
        [account.descriptor, timer],
    );

    const getQuoteRequestData = useCallback((): ExchangeTradeQuoteRequest | null => {
        const { outputs, receiveCryptoSelect, sendCryptoSelect } = getValues();
        const unformattedOutputAmount = outputs[0].amount || '';
        const sendStringAmount =
            unformattedOutputAmount && shouldSendInSats
                ? formatAmount(unformattedOutputAmount, network.decimals)
                : unformattedOutputAmount;

        if (!receiveCryptoSelect?.value || !sendCryptoSelect?.value) return null;

        const request: ExchangeTradeQuoteRequest = {
            receive: receiveCryptoSelect.value,
            send: sendCryptoSelect.value,
            sendStringAmount,
            dex: 'enable',
        };

        return request;
    }, [getValues, network.decimals, shouldSendInSats]);

    const handleChange = useCallback(
        async (offLoading?: boolean) => {
            setIsSubmittingHelper(!offLoading);
            timer.loading();

            const quotesRequest = getQuoteRequestData();

            if (quotesRequest) {
                const allQuotes = await getQuotesRequest(quotesRequest);

                if (Array.isArray(allQuotes)) {
                    const limits = getAmountLimits(allQuotes);
                    const successQuotes = addIdsToQuotes<CoinmarketTradeExchangeType>(
                        getSuccessQuotesOrdered(allQuotes, exchangeInfo),
                        'exchange',
                    );

                    setAmountLimits(limits);
                    setInnerQuotes(successQuotes);
                    dispatch(saveQuotes(successQuotes));
                    dispatch(saveQuoteRequest(quotesRequest));
                } else {
                    setInnerQuotes([]);
                }
            }

            timer.reset();
            setIsSubmittingHelper(false);
        },
        [timer, getQuoteRequestData, getQuotesRequest, exchangeInfo, dispatch],
    );

    const getQuotes = useCallback(async () => {
        if (!selectedQuote && quotesRequest) {
            timer.loading();
            invityAPI.createInvityAPIKey(account.descriptor);
            const allQuotes = await invityAPI.getExchangeQuotes(quotesRequest);
            if (Array.isArray(allQuotes)) {
                if (allQuotes.length === 0) {
                    timer.stop();

                    return;
                }
                const successQuotes = addIdsToQuotes<CoinmarketTradeExchangeType>(
                    getSuccessQuotesOrdered(allQuotes, exchangeInfo),
                    'exchange',
                );
                setInnerQuotes(successQuotes);
            } else {
                setInnerQuotes(undefined);
            }
            timer.reset();
        }
    }, [account.descriptor, exchangeInfo, quotesRequest, selectedQuote, timer]);

    const selectQuote = async (quote: ExchangeTrade) => {
        const provider =
            exchangeInfo?.providerInfos && quote.exchange
                ? exchangeInfo?.providerInfos[quote.exchange]
                : null;
        if (quotesRequest) {
            const result = await openCoinmarketExchangeConfirmModal(
                provider?.companyName,
                quote.isDex,
                quote.send,
                quote.receive,
            );
            if (result) {
                saveSelectedQuote(quote);
                dispatch({
                    type: SET_MODAL_CRYPTO_CURRENCY,
                    modalCryptoSymbol: quote.receive,
                });

                navigateToExchangeConfirm();
                timer.stop();
            }
        }
    };

    const confirmTrade = async (address: string, extraField?: string, trade?: ExchangeTrade) => {
        let ok = false;
        const { address: refundAddress } = getUnusedAddressFromAccount(account);
        if (!trade) {
            trade = selectedQuote;
        }
        if (!trade || !refundAddress) return false;

        if (trade.isDex && !trade.fromAddress) {
            trade = { ...trade, fromAddress: refundAddress };
        }

        setCallInProgress(true);
        const response = await invityAPI.doExchangeTrade({
            trade,
            receiveAddress: address,
            refundAddress,
            extraField,
        });
        if (!response) {
            addNotification({
                type: 'error',
                error: 'No response from the server',
            });
        } else if (
            response.error ||
            !response.status ||
            !response.orderId ||
            response.status === 'ERROR'
        ) {
            addNotification({
                type: 'error',
                error: response.error || 'Error response from the server',
            });
            saveSelectedQuote(response);
        } else if (response.status === 'APPROVAL_REQ' || response.status === 'APPROVAL_PENDING') {
            saveSelectedQuote(response);
            setExchangeStep('SEND_APPROVAL_TRANSACTION');
            ok = true;
        } else if (response.status === 'CONFIRM') {
            saveSelectedQuote(response);
            if (response.isDex) {
                if (exchangeStep === 'RECEIVING_ADDRESS' || trade.approvalType === 'ZERO') {
                    setExchangeStep('SEND_APPROVAL_TRANSACTION');
                } else {
                    setExchangeStep('SEND_TRANSACTION');
                }
            } else {
                setExchangeStep('SEND_TRANSACTION');
            }
            ok = true;
        } else {
            // CONFIRMING, SUCCESS
            saveTrade(response, account, new Date().toISOString());
            saveTransactionId(response.orderId);
            ok = true;
            navigateToExchangeDetail();
        }
        setCallInProgress(false);

        return ok;
    };

    const sendDexTransaction = async () => {
        if (
            selectedQuote &&
            selectedQuote.dexTx &&
            (selectedQuote.status === 'APPROVAL_REQ' || selectedQuote.status === 'CONFIRM')
        ) {
            // after discussion with 1inch, adjust the gas limit by the factor of 1.25
            // swap can use different swap paths when mining tx than when estimating tx
            // the geth gas estimate may be too low
            const result = await recomposeAndSign(
                selectedAccount.account,
                selectedQuote.dexTx.to,
                selectedQuote.dexTx.value,
                selectedQuote.partnerPaymentExtraId,
                selectedQuote.dexTx.data,
                true,
                selectedQuote.status === 'CONFIRM' ? '1.25' : undefined,
            );

            // in case of not success, recomposeAndSign shows notification
            if (result?.success) {
                const { txid } = result.payload;
                const quote = { ...selectedQuote };
                if (selectedQuote.status === 'CONFIRM' && selectedQuote.approvalType !== 'ZERO') {
                    quote.receiveTxHash = txid;
                    quote.status = 'CONFIRMING';
                    saveTrade(quote, account, new Date().toISOString());
                    confirmTrade(quote.receiveAddress || '', undefined, quote);
                } else {
                    quote.approvalSendTxHash = txid;
                    quote.status = 'APPROVAL_PENDING';
                    confirmTrade(quote.receiveAddress || '', undefined, quote);
                }
            }
        } else {
            addNotification({
                type: 'error',
                error: 'Cannot send transaction, missing data',
            });
        }
    };

    const sendTransaction = async () => {
        if (selectedQuote?.isDex) {
            sendDexTransaction();

            return;
        }
        if (
            selectedQuote &&
            selectedQuote.orderId &&
            selectedQuote.sendAddress &&
            selectedQuote.sendStringAmount
        ) {
            const sendStringAmount = shouldSendInSats
                ? amountToSatoshi(selectedQuote.sendStringAmount, network.decimals)
                : selectedQuote.sendStringAmount;
            const result = await recomposeAndSign(
                selectedAccount.account,
                selectedQuote.sendAddress,
                sendStringAmount,
                selectedQuote.partnerPaymentExtraId,
                undefined,
                undefined,
                undefined,
                ['broadcast'],
            );
            // in case of not success, recomposeAndSign shows notification
            if (result?.success) {
                saveTrade(selectedQuote, account, new Date().toISOString());
                saveTransactionId(selectedQuote.orderId);
                navigateToExchangeDetail();
            }
        } else {
            addNotification({
                type: 'error',
                error: 'Cannot send transaction, missing data',
            });
        }
    };

    const goToOffers = async () => {
        await handleChange(true);

        navigateToExchangeOffers();
    };

    // call change handler on every change of text inputs with debounce
    useDebounce(
        () => {
            const fiatValue = values?.outputs?.[0]?.fiat;
            const cryptoInput = values?.outputs?.[0]?.amount;
            const fiatChanged = isChanged(previousValues.current?.outputs?.[0]?.fiat, fiatValue);
            const cryptoChanged = isChanged(
                previousValues.current?.outputs?.[0]?.amount,
                cryptoInput,
            );

            if (fiatChanged || cryptoChanged) {
                if (cryptoChanged && cryptoInput) {
                    helpers.onCryptoAmountChange(cryptoInput);
                }

                handleSubmit(() => {
                    handleChange();
                })();

                previousValues.current = values;
            }
        },
        500,
        [previousValues, handleChange, handleSubmit],
    );

    // call change handler on every change of select inputs
    useEffect(() => {
        if (
            isChanged(
                previousValues.current?.receiveCryptoSelect?.value,
                values?.receiveCryptoSelect?.value,
            )
        ) {
            handleSubmit(() => {
                handleChange();
            })();

            previousValues.current = values;
        }
    }, [previousValues, values, handleChange, handleSubmit, isNotFormPage]);

    useCoinmarketLoadData();

    useDebounce(
        () => {
            if (
                formState.isDirty &&
                !formState.isValidating &&
                Object.keys(formState.errors).length === 0 &&
                !isComposing
            ) {
                saveDraft(exchangeDraftKey, values as CoinmarketExchangeFormProps);
            }
        },
        200,
        [
            saveDraft,
            values,
            formState.errors,
            formState.isDirty,
            formState.isValidating,
            isComposing,
        ],
    );

    useEffect(() => {
        if (!isChanged(defaultValues, values)) {
            removeDraft(exchangeDraftKey);

            return;
        }

        if (values.sendCryptoSelect && !values.sendCryptoSelect?.value) {
            removeDraft(exchangeDraftKey);

            return;
        }

        if (values.receiveCryptoSelect && !values.receiveCryptoSelect?.value) {
            removeDraft(exchangeDraftKey);
        }
    }, [defaultValues, values, removeDraft]);

    // react-hook-form auto register custom form fields (without HTMLElement)
    useEffect(() => {
        register('options');
        register('setMaxOutputId');
    }, [register]);

    // react-hook-form reset, set default values
    useEffect(() => {
        if (!isDraft && defaultValues) {
            reset(defaultValues);
        }
    }, [reset, isDraft, defaultValues]);

    useEffect(() => {
        if (!quotesRequest && isNotFormPage) {
            navigateToExchangeForm();

            return;
        }

        checkQuotesTimer(getQuotes);
    });

    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    const filteredCexQuotes = useMemo(
        () => getCexQuotesByRateType(rateType, innerQuotes, exchangeInfo),
        [rateType, innerQuotes, exchangeInfo],
    );

    const dexQuotes = useMemo(() => innerQuotes?.filter(q => q.isDex), [innerQuotes]);

    // handle edge case when there are no longer quotes of selected exchange type
    useEffect(() => {
        if (exchangeType === 'DEX' && !dexQuotes?.length && filteredCexQuotes?.length) {
            setValue('exchangeType', 'CEX');
        } else if (exchangeType === 'CEX' && !filteredCexQuotes?.length && dexQuotes?.length) {
            setValue('exchangeType', 'DEX');
        }
    }, [dexQuotes, exchangeType, filteredCexQuotes, setValue]);

    return {
        type,
        ...methods,
        account,

        form: {
            state: {
                isFormLoading,
                isFormInvalid,
                isLoadingOrInvalid,

                toggleAmountInCrypto,
            },
            helpers,
        },

        device,
        timer,
        callInProgress,
        exchangeInfo,
        symbolsInfo,
        quotes: filteredCexQuotes,
        dexQuotes,
        quotesRequest,
        composedLevels,
        defaultCurrency,
        feeInfo,
        amountLimits,
        network,
        exchangeStep,
        receiveAccount,
        selectedQuote,
        addressVerified,
        setReceiveAccount,
        composeRequest,
        changeFeeLevel,
        removeDraft,
        setAmountLimits,
        goToOffers,
        setExchangeStep,
        sendTransaction,
        verifyAddress,
        selectQuote,
        confirmTrade,
    };
};
