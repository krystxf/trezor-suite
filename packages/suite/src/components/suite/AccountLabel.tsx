import styled from 'styled-components';
import { getTitleForNetwork, getTitleForCoinjoinAccount } from '@suite-common/wallet-utils';
import { Account } from 'src/types/wallet';
import {
    Badge,
    BadgeProps,
    Row,
    TOOLTIP_DELAY_LONG,
    TruncateWithTooltip,
} from '@trezor/components';
import { ReactNode, useCallback } from 'react';
import { useTranslation } from '../../hooks/suite';
import { Translation } from './Translation';
import { spacings } from '@trezor/theme';
import { AccountType, UppercaseAccountType } from '@suite-common/wallet-types';

const TabularNums = styled.span`
    font-variant-numeric: tabular-nums;
    text-overflow: ellipsis;
    overflow: hidden;
`;

export interface AccountLabelProps {
    accountLabel?: string;
    accountType: AccountType;
    symbol: Account['symbol'];
    index?: number;
    showAccountTypeBadge?: boolean;
    accountTypeBadgeSize?: BadgeProps['size'];
}

export const useAccountLabel = () => {
    const { translationString } = useTranslation();

    const defaultAccountLabelString = useCallback(
        ({
            accountType,
            symbol,
            index = 0,
        }: {
            accountType: Account['accountType'];
            symbol: Account['symbol'];
            index?: number;
        }) => {
            if (accountType === 'coinjoin') {
                return translationString(getTitleForCoinjoinAccount(symbol));
            }

            return translationString('LABELING_ACCOUNT', {
                networkName: translationString(getTitleForNetwork(symbol)), // Bitcoin, Ethereum, ...
                index: index + 1, // this is the number which shows after hash, e.g. Ethereum #3
            });
        },
        [translationString],
    );

    return {
        defaultAccountLabelString,
    };
};

export const AccountLabel = ({
    accountLabel,
    accountType = 'normal',
    showAccountTypeBadge,
    accountTypeBadgeSize = 'medium',
    symbol,
    index = 0,
}: AccountLabelProps) => {
    const { defaultAccountLabelString } = useAccountLabel();

    const accountTypeUppercase: UppercaseAccountType =
        accountType.toUpperCase() as UppercaseAccountType;

    const AccountTypeBadge: ReactNode = (
        <Badge size={accountTypeBadgeSize}>
            <Translation id={`TR_${accountTypeUppercase}`} />
        </Badge>
    );
    if (accountLabel) {
        return (
            <TruncateWithTooltip delayShow={TOOLTIP_DELAY_LONG}>
                <Row gap={spacings.sm}>
                    <TabularNums>{accountLabel}</TabularNums>
                    {showAccountTypeBadge && accountType != 'normal' && <>{AccountTypeBadge}</>}
                </Row>
            </TruncateWithTooltip>
        );
    }

    return (
        <TruncateWithTooltip delayShow={TOOLTIP_DELAY_LONG}>
            <Row gap={spacings.sm}>
                {defaultAccountLabelString({ accountType, symbol, index })}
                {showAccountTypeBadge && accountType != 'normal' && <>{AccountTypeBadge}</>}
            </Row>
        </TruncateWithTooltip>
    );
};
