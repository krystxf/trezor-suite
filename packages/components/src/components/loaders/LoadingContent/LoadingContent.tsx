import { ReactNode, useEffect, useState } from 'react';
import styled, { css, useTheme } from 'styled-components';
import { Icon } from '../../assets/Icon/Icon';
import { Spinner } from '../Spinner/Spinner';

const LoadingWrapper = styled.div`
    display: flex;
    align-items: center;
`;

const LoaderCell = styled.div<{ $size: number; $isLoading: boolean }>`
    width: ${({ $size }) => 1.5 * $size}px;
    transition: all 0.25s ease-out 0.5s;

    ${({ $isLoading }) =>
        !$isLoading &&
        css`
            width: 0;
            opacity: 0;
        `}
    svg {
        fill: ${({ theme }) => theme.iconPrimaryDefault};
    }
`;

export type LoadingContentProps = {
    children: ReactNode;
    isLoading?: boolean;
    size?: number;
    isSuccessful?: boolean;
};

export const LoadingContent = ({
    children,
    isLoading = false,
    size = 20,
    isSuccessful = true,
}: LoadingContentProps) => {
    const theme = useTheme();

    // $isLoading should always start as `false`
    const [loading, setLoading] = useState(false);
    useEffect(() => setLoading(isLoading), [isLoading]);

    return (
        <LoadingWrapper>
            <LoaderCell $isLoading={loading} $size={size}>
                {isLoading ? (
                    <Spinner size={size} dataTest="@loading-content/loader" />
                ) : (
                    <Icon
                        icon={isSuccessful ? 'CHECK' : 'CROSS'}
                        size={size}
                        color={isSuccessful ? theme.iconPrimaryDefault : theme.iconAlertRed}
                    />
                )}
            </LoaderCell>

            {children}
        </LoadingWrapper>
    );
};
