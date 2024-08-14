import { Fragment } from 'react';
import { useCoinmarketFormContext } from 'src/hooks/wallet/coinmarket/form/useCoinmarketCommonForm';
import { CoinmarketTradeSellType } from 'src/types/coinmarket/coinmarket';
import { CoinmarketOfferCommonProps } from 'src/types/coinmarket/coinmarketForm';
import { CoinmarketLeftWrapper, CoinmarketRightWrapper } from 'src/views/wallet/coinmarket';
import { CoinmarketOfferSellBankAccount } from 'src/views/wallet/coinmarket/common/CoinmarketSelectedOffer/CoinmarketOfferSell/CoinmarketOfferSellBankAccount';
import { CoinmarketSelectedOfferSellTransaction } from 'src/views/wallet/coinmarket/common/CoinmarketSelectedOffer/CoinmarketOfferSell/CoinmarketOfferSellTransaction';
import { CoinmarketSelectedOfferInfo } from 'src/views/wallet/coinmarket/common/CoinmarketSelectedOffer/CoinmarketSelectedOfferInfo';
import {
    CoinmarketSelectedOfferStepper,
    CoinmarketSelectedOfferStepperItemProps,
} from 'src/views/wallet/coinmarket/common/CoinmarketSelectedOffer/CoinmarketSelectedOfferStepper';

export const CoinmarketOfferSell = (props: CoinmarketOfferCommonProps) => {
    const { sellStep } = useCoinmarketFormContext<CoinmarketTradeSellType>();

    const steps: (CoinmarketSelectedOfferStepperItemProps & {
        component: JSX.Element | null;
    })[] = [
        {
            step: 'BANK_ACCOUNT',
            translationId: 'TR_SELL_BANK_ACCOUNT_STEP',
            isActive: sellStep === 'BANK_ACCOUNT',
            component: <CoinmarketOfferSellBankAccount />,
        },
        {
            step: 'SEND_TRANSACTION',
            translationId: 'TR_SELL_CONFIRM_SEND_STEP',
            isActive: sellStep === 'SEND_TRANSACTION',
            component: <CoinmarketSelectedOfferSellTransaction />,
        },
    ];

    return (
        <>
            <CoinmarketLeftWrapper>
                <CoinmarketSelectedOfferStepper steps={steps} />
                {steps.map((step, index) => (
                    <Fragment key={index}>{step.isActive && step.component}</Fragment>
                ))}
            </CoinmarketLeftWrapper>
            <CoinmarketRightWrapper>
                <CoinmarketSelectedOfferInfo {...props} />
            </CoinmarketRightWrapper>
        </>
    );
};
