import styled, { keyframes, css, useTheme } from 'styled-components';

import { Ref, forwardRef, SVGAttributes } from 'react';
import { ReactSVG } from 'react-svg';
import { ICONS } from './icons';

export type IconType = keyof typeof ICONS;

// TODO: make animation of icons better
const rotate180up = keyframes`
    from {
        transform: rotate(0deg);
    }
    to {
        transform: rotate(180deg);
    }
`;

const rotate180down = keyframes`
    from {
        transform: rotate(180deg);
    }
    to {
        transform: rotate(0deg);
    }
`;

const chooseIconAnimationType = (canAnimate?: boolean, isActive?: boolean) => {
    if (canAnimate) {
        if (isActive) {
            return rotate180up;
        }
        return rotate180down;
    }
    return null;
};

const SvgWrapper = styled.div<{
    $canAnimate: WrapperProps['canAnimate'];
    $color: WrapperProps['color'];
    $isActive: WrapperProps['isActive'];
    $hoverColor: WrapperProps['hoverColor'];
    $size: WrapperProps['size'];
    $useCursorPointer: WrapperProps['useCursorPointer'];
}>`
    display: flex;
    align-items: center;
    justify-content: center;
    height: ${({ $size }) => $size}px;
    width: ${({ $size }) => $size}px;
    animation: ${({ $canAnimate, $isActive }) => chooseIconAnimationType($canAnimate, $isActive)}
        0.2s linear 1 forwards;

    div {
        display: flex;
        height: ${({ $size }) => $size}px;
        line-height: ${({ $size }) => $size}px;
        align-items: center;
        justify-content: center;
    }

    span {
        display: flex;
        align-items: center;
        justify-content: center;
    }

    path {
        fill: ${({ $color }) => $color};
        transition: fill 0.14s;
    }

    :hover {
        path {
            fill: ${({ $hoverColor }) => $hoverColor};
        }
    }

    ${({ $useCursorPointer }) =>
        $useCursorPointer &&
        css`
            cursor: pointer;
        `}
`;

type WrapperProps = Omit<IconProps, 'icon'>;
export interface IconProps extends SVGAttributes<HTMLDivElement> {
    className?: string;
    icon: IconType;
    size?: number;
    color?: string;
    isActive?: boolean;
    canAnimate?: boolean;
    hoverColor?: string;
    useCursorPointer?: boolean;
    'data-test'?: string;
}

export const Icon = forwardRef(
    (
        {
            icon,
            size = 24,
            color,
            isActive,
            canAnimate,
            hoverColor,
            useCursorPointer,
            className,
            onClick,
            onMouseEnter,
            onMouseLeave,
            'data-test': dataTest,
        }: IconProps,
        ref?: Ref<HTMLDivElement>,
    ) => {
        const theme = useTheme();
        const defaultColor = color ?? theme.TYPE_LIGHT_GREY;

        return (
            <SvgWrapper
                className={className}
                $canAnimate={canAnimate}
                $hoverColor={hoverColor}
                onClick={onClick}
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
                $isActive={isActive}
                $size={size}
                ref={ref}
                $useCursorPointer={onClick !== undefined || useCursorPointer}
                $color={defaultColor}
                data-test={dataTest}
            >
                <ReactSVG
                    src={ICONS[icon]}
                    beforeInjection={svg => {
                        svg.setAttribute('width', `${size}px`);
                        svg.setAttribute('height', `${size}px`);
                    }}
                    loading={() => <span className="loading" />}
                />
            </SvgWrapper>
        );
    },
);
