import { NetworkSymbol } from '@suite-common/wallet-config';
import { TokenAddress } from '@suite-common/wallet-types';
import { typography } from '@trezor/theme';
import { FiatValue, Translation } from 'src/components/suite';
import { useBitcoinAmountUnit } from 'src/hooks/wallet/useBitcoinAmountUnit';
import { coinmarketGetAccountLabel } from 'src/utils/wallet/coinmarket/coinmarketUtils';
import styled from 'styled-components';

const CoinmarketBalanceWrapper = styled.div`
    ${typography.label}
    color: ${({ theme }) => theme.textSubdued};
`;

interface CoinmarketBalanceProps {
    balance: string | undefined;
    cryptoSymbolLabel: string | undefined;
    networkSymbol: NetworkSymbol;
    tokenAddress?: TokenAddress | undefined;
}

export const CoinmarketBalance = ({
    balance,
    cryptoSymbolLabel,
    networkSymbol,
    tokenAddress,
}: CoinmarketBalanceProps) => {
    const { shouldSendInSats } = useBitcoinAmountUnit(networkSymbol);
    const balanceCurrency = coinmarketGetAccountLabel(cryptoSymbolLabel ?? '', shouldSendInSats);

    return (
        <CoinmarketBalanceWrapper>
            <Translation id="TR_BALANCE" />: {balance ?? '0'} {balanceCurrency}
            {balance && networkSymbol && balance !== '0' && (
                <>
                    {' '}
                    (
                    <FiatValue
                        amount={balance}
                        symbol={networkSymbol}
                        tokenAddress={tokenAddress}
                    />
                    )
                </>
            )}
        </CoinmarketBalanceWrapper>
    );
};
