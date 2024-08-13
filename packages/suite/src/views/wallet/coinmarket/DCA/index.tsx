import React from 'react';
import {
    Column,
    Divider,
    H2,
    Icon,
    IconType,
    Image,
    Paragraph,
    Row,
    Text,
} from '@trezor/components';
import { UseCoinmarketProps } from 'src/types/coinmarket/coinmarket';
import { withSelectedAccountLoaded } from 'src/components/wallet';
import { CoinmarketLayout } from '../common';
import styled from 'styled-components';
import { borders, colorVariants, palette, spacings, spacingsPx } from '@trezor/theme';
import { Translation, TrezorLink } from 'src/components/suite';
import { COINMARKET_DOWNLOAD_INVITY_APP_URL } from '@trezor/urls';
import { useSelector } from 'src/hooks/suite';
import { variables } from '@trezor/components/src/config';

const IconWrapper = styled.div`
    display: flex;
    flex-shrink: 0;
    justify-content: center;
    align-items: center;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: ${palette.lightSecondaryLime500};
    margin-right: ${spacingsPx.sm};
`;

const WrappedText = styled.div`
    max-width: 200px;
    text-align: center;
`;

const ColumnsWrapper = styled.div`
    ${variables.SCREEN_QUERY.ABOVE_MOBILE} {
        display: flex;
    }
`;

const Column1 = styled.div`
    display: flex;
    flex-direction: column;
    flex: 1 0 50%;
    gap: ${spacingsPx.xxl};
    background-color: ${colorVariants.standard.backgroundPrimaryDefault};
    padding: ${spacingsPx.xxl};
    border-radius: ${borders.radii.md};
    color: ${colorVariants.standard.textOnPrimary};
`;

const Column2 = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1 0 50%;
    gap: ${spacingsPx.md};
    padding: ${spacingsPx.xxl};
`;

const Layout = styled(CoinmarketLayout)`
    & [class^='CoinmarketLayout__Content'] {
        padding: 12px;
    }
`;

const StoreBadge = styled.div<{ $isLight: boolean }>`
    ${({ $isLight }) => $isLight && `filter: invert(1);`}
    transition: opacity 0.3s;
    cursor: pointer;

    &:hover {
        opacity: 0.6;
    }
`;

const StoreSeparatorWrapper = styled.div`
    height: 26px;
`;

interface FeatureItemProps {
    icon: IconType;
    featureNumber: 1 | 2 | 3 | 4;
}

const FeatureItem = ({ icon, featureNumber }: FeatureItemProps) => (
    <Row>
        <IconWrapper>
            <Icon icon={icon} size={20} color={colorVariants.standard.backgroundPrimaryDefault} />
        </IconWrapper>
        <div>
            <Text typographyStyle="highlight" color={palette.lightSecondaryLime500}>
                <Translation id={`TR_COINMARKET_DCA_FEATURE_${featureNumber}_SUBHEADING`} />
            </Text>
            <Paragraph>
                <Translation id={`TR_COINMARKET_DCA_FEATURE_${featureNumber}_DESCRIPTION`} />
            </Paragraph>
        </div>
    </Row>
);

const DCALanding = (props: UseCoinmarketProps) => {
    const currentTheme = useSelector(state => state.suite.settings.theme.variant);
    const isLightTheme = currentTheme === 'light';

    return (
        <Layout selectedAccount={props.selectedAccount}>
            <ColumnsWrapper>
                <Column1>
                    <H2>
                        <Translation id="TR_COINMARKET_DCA_HEADING" />
                    </H2>
                    <Column gap={spacings.xxl} alignItems="start">
                        <FeatureItem icon="SHIELD_CHECK" featureNumber={1} />
                        <FeatureItem icon="ARROW_DOWN" featureNumber={2} />
                        <FeatureItem icon="LIGHTNING" featureNumber={3} />
                        <FeatureItem icon="EYE" featureNumber={4} />
                    </Column>
                </Column1>
                <Column2>
                    <WrappedText>
                        <Paragraph typographyStyle="highlight">
                            <Translation id="TR_COINMARKET_DCA_DOWNLOAD" />
                        </Paragraph>
                    </WrappedText>
                    <TrezorLink href={COINMARKET_DOWNLOAD_INVITY_APP_URL}>
                        <Image image="COINMARKET_DCA_INVITY_APP_QR" width={233} height={226} />
                    </TrezorLink>
                    <Row>
                        <TrezorLink href={COINMARKET_DOWNLOAD_INVITY_APP_URL}>
                            <StoreBadge $isLight={isLightTheme}>
                                <Image image="PLAY_STORE_TITLE" height={26} />
                            </StoreBadge>
                        </TrezorLink>
                        <StoreSeparatorWrapper>
                            <Divider
                                orientation="vertical"
                                strokeWidth={1}
                                color="borderElevation1"
                                margin={{ left: spacings.sm, right: spacings.sm }}
                            />
                        </StoreSeparatorWrapper>
                        <TrezorLink href={COINMARKET_DOWNLOAD_INVITY_APP_URL}>
                            <StoreBadge $isLight={isLightTheme}>
                                <Image image="APP_STORE_TITLE" height={26} />
                            </StoreBadge>
                        </TrezorLink>
                    </Row>
                </Column2>
            </ColumnsWrapper>
        </Layout>
    );
};

export default withSelectedAccountLoaded(DCALanding, {
    title: 'TR_NAV_DCA',
});
