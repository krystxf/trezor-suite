import { Network } from '@suite-common/wallet-config';
import React from 'react';
import styled, { useTheme } from 'styled-components';
import { CoinLogo, Icon } from '@trezor/components';
import { useSelector } from 'react-redux';

import { SkeletonCircle, SkeletonRectangle } from 'src/components/suite';
import { spacingsPx, typography } from '@trezor/theme';
import { selectDeviceAccountsByNetworkSymbol } from '@suite-common/wallet-core';

type Props = {
    network: Network;
    onClick: () => void;
};

type AssetInfoSkeletonProps = {
    animate?: boolean;
};

const ArrowIcon = styled(Icon)`
    visibility: hidden;
    margin-top: ${spacingsPx.xxs};
    margin-left: ${spacingsPx.xs};
`;
const Flex = styled.div`
    display: flex;
`;

const Container = styled.div`
    display: flex;

    :hover {
        cursor: pointer;
        ${ArrowIcon} {
            visibility: visible;
        }
    }
`;
const WalletContent = styled.div`
    flex: 1;
`;

const CoinName = styled.div`
    ${typography.body};
`;
const Wallets = styled.div`
    display: flex;
    align-items: center;
    gap: ${spacingsPx.xxs};
    margin-top: ${spacingsPx.xxs};
`;
const WalletNumber = styled.div`
    color: ${({ theme }) => theme.textSubdued};
    font-variant-numeric: tabular-nums;
    ${typography.hint};
`;

const LogoWrapper = styled.div`
    padding-right: ${spacingsPx.sm};

    align-items: center;
`;

export const AssetInfo = ({ network, onClick }: Props) => {
    const { symbol, name } = network;
    const selectedAccounts = useSelector((state: any) =>
        selectDeviceAccountsByNetworkSymbol(state, symbol),
    );
    const theme = useTheme();

    return (
        <Container onClick={onClick}>
            <LogoWrapper>
                <CoinLogo symbol={symbol} size={24} hasBorder />
            </LogoWrapper>
            <WalletContent>
                <CoinName>{name}</CoinName>
                <Wallets>
                    <Icon icon="WALLET" />
                    <WalletNumber>{selectedAccounts.length}</WalletNumber>
                </Wallets>
            </WalletContent>
            <ArrowIcon size={16} icon="ARROW_RIGHT_LONG" color={theme.iconPrimaryDefault} />
        </Container>
    );
};

export const AssetInfoSkeleton = ({ animate }: AssetInfoSkeletonProps) => (
    <Flex>
        <LogoWrapper>
            <SkeletonCircle size={44} />
        </LogoWrapper>
        <div>
            <CoinName>
                {' '}
                <SkeletonRectangle animate={animate} width={100} />
            </CoinName>
            <Wallets>
                <WalletNumber>
                    {' '}
                    <SkeletonRectangle animate={animate} width={60} />
                </WalletNumber>
            </Wallets>
        </div>
    </Flex>
);
