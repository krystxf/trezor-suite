import { spacingsPx } from '@trezor/theme';
import { ImgHTMLAttributes, useEffect, useState } from 'react';
import { ReactSVG } from 'react-svg';
import styled from 'styled-components';
import { DefaultCoinLogo } from '../assets/DefaultCoinLogo/DefaultCoinLogo';
import { COINS } from './coins';

export type CoinType = keyof typeof COINS;

const UPDATED_ICONS_LIST_URL_BASE = 'https://data.trezor.io/suite/icons/coins/';

export const QUALITY_SIZE = {
    small: 16,
    medium: 24,
    large: 32,
};

export type Quality = keyof typeof QUALITY_SIZE;

const useCheckUrlAccessibility = (url: string) => {
    const [isAccessible, setIsAccessible] = useState(false);

    useEffect(() => {
        const checkAccessibility = async () => {
            try {
                const response = await fetch(url, { method: 'HEAD' });
                setIsAccessible(response.ok);
            } catch (error) {
                console.error('Error checking URL accessibility:', error);
                setIsAccessible(false);
            }
        };

        if (url) {
            checkAccessibility();
        }
    }, [url]);

    return isAccessible;
};

export const useAssetUrl = (coingeckoId: string, contractAddress?: string) => {
    const fileName = contractAddress ? `${coingeckoId}--${contractAddress}` : coingeckoId;
    const assetUrl = fileName ? `${UPDATED_ICONS_LIST_URL_BASE}${fileName}@2x.webp` : '';
    const isAssetUrlAccessible = useCheckUrlAccessibility(assetUrl);
    const iconUrl = fileName && isAssetUrlAccessible ? assetUrl : undefined;

    return iconUrl;
};

export interface CoinLogoProps extends ImgHTMLAttributes<HTMLImageElement> {
    symbol?: CoinType;
    className?: string;
    size?: number;
    index?: number;
    coingeckoId?: string;
    contractAddress?: string;
    quality?: Quality;
}

const Wrapper = styled.div<{ $size: number }>`
    display: inline-block;
    width: ${({ $size }) => $size}px;
    height: ${({ $size }) => $size}px;
    margin: ${spacingsPx.xxs};

    div {
        width: ${({ $size }) => $size}px;
        height: ${({ $size }) => $size}px;
        line-height: ${({ $size }) => $size}px;
    }
`;

const StyledIconImage = styled.img<{ $size: number }>(
    ({ $size }) => `
        width: ${$size}px;
        height: ${$size}px;
    `,
);

type SVGCoinLogoProps = {
    $symbol: CoinType;
    $size?: number;
};

const SVGCoinLogo = ({ $symbol, $size = 32 }: SVGCoinLogoProps) => (
    <ReactSVG
        src={$symbol}
        beforeInjection={svg => {
            svg.setAttribute('width', `${$size}px`);
            svg.setAttribute('height', `${$size}px`);
        }}
    />
);

export const CoinLogo = ({
    symbol,
    className,
    size = 32,
    coingeckoId = '',
    contractAddress,
    quality = 'medium',
    ...rest
}: CoinLogoProps) => {
    const [isLoading, setIsLoading] = useState(true);

    const iconUrl = useAssetUrl(coingeckoId, contractAddress);
    const firstCharacter = coingeckoId && coingeckoId[0].toUpperCase();
    const logo = iconUrl ? (
        <>
            {isLoading && <span className="loading">Loading...</span>}
            <StyledIconImage
                src={iconUrl}
                $size={size}
                onLoad={() => setIsLoading(false)}
                onError={() => setIsLoading(false)}
                {...rest}
            />
        </>
    ) : (
        <DefaultCoinLogo size={size} coinFirstCharacter={firstCharacter} />
    );

    return (
        <Wrapper className={className} $size={size} {...rest}>
            {symbol ? <SVGCoinLogo $symbol={COINS[symbol]} $size={size} /> : logo}
        </Wrapper>
    );
};
