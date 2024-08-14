import { CoinmarketSelectedOfferInfo } from 'src/views/wallet/coinmarket/common/CoinmarketSelectedOffer/CoinmarketSelectedOfferInfo';
import { CoinmarketVerify } from 'src/views/wallet/coinmarket/common/CoinmarketSelectedOffer/CoinmarketVerify/CoinmarketVerify';
import { CoinmarketLeftWrapper, CoinmarketRightWrapper } from 'src/views/wallet/coinmarket';
import { CoinmarketOfferBuyProps } from 'src/types/coinmarket/coinmarketForm';
import useCoinmarketVerifyAccount from 'src/hooks/wallet/coinmarket/form/useCoinmarketVerifyAccount';

export const CoinmarketOfferBuy = ({
    account,
    selectedQuote,
    providers,
    type,
    quoteAmounts,
    paymentMethod,
    paymentMethodName,
}: CoinmarketOfferBuyProps) => {
    const currency = selectedQuote?.receiveCurrency;
    const coinmarketVerifyAccount = useCoinmarketVerifyAccount({ currency });

    return (
        <>
            <CoinmarketLeftWrapper>
                {currency && (
                    <CoinmarketVerify
                        coinmarketVerifyAccount={coinmarketVerifyAccount}
                        currency={currency}
                    />
                )}
            </CoinmarketLeftWrapper>
            <CoinmarketRightWrapper>
                <CoinmarketSelectedOfferInfo
                    account={account}
                    selectedAccount={coinmarketVerifyAccount.selectedAccountOption?.account}
                    selectedQuote={selectedQuote}
                    providers={providers}
                    type={type}
                    quoteAmounts={quoteAmounts}
                    paymentMethod={paymentMethod}
                    paymentMethodName={paymentMethodName}
                />
            </CoinmarketRightWrapper>
        </>
    );
};
