import React from 'react';
import { Column, Divider, H2, Icon, Image, Paragraph, Row } from '@trezor/components';
import { UseCoinmarketProps } from 'src/types/coinmarket/coinmarket';
import { withSelectedAccountLoaded } from 'src/components/wallet';
import { CoinmarketLayout } from '../common';
import styled from 'styled-components';
import { borders, colorVariants, palette, spacings } from '@trezor/theme';
import { Translation, TrezorLink } from 'src/components/suite';
import { COINMARKET_DOWNLOAD_INVITY_APP_URL } from '@trezor/urls';
import { useSelector } from 'src/hooks/suite';

const IconWrapper = styled.div`
    display: flex;
    flex-shrink: 0;
    justify-content: center;
    align-items: center;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: ${palette.lightSecondaryLime500};
    margin-right: ${spacings.sm}px;
`;

const Subheading = styled(Paragraph)`
    color: ${palette.lightSecondaryLime500};
`;

const WrappedText = styled(Paragraph)`
    max-width: 200px;
    text-align: center;
`;

const Column1 = styled(Column)`
    flex: 1 0 50%;
    align-items: start;
    gap: ${spacings.xxl}px;
    background-color: ${colorVariants.standard.backgroundPrimaryDefault};
    padding: ${spacings.xxl}px;
    border-radius: ${borders.radii.md};
    color: ${colorVariants.standard.textOnPrimary};
`;

const Column2 = styled(Column)`
    flex: 1 0 50%;
    gap: ${spacings.md}px;
    padding: ${spacings.xxl}px;
`;

const Layout = styled(CoinmarketLayout)`
    & [class^='CoinmarketLayout__Content'] {
        padding: 12px;
    }
`;

const StoreBadge = styled(Image)<{ $isLight: boolean }>`
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

const DCALanding = (props: UseCoinmarketProps) => {
    const currentTheme = useSelector(state => state.suite.settings.theme.variant);

    return (
        <Layout selectedAccount={props.selectedAccount}>
            <Row>
                <Column1>
                    <H2>
                        <Translation id="TR_COINMARKET_DCA_HEADING" />
                    </H2>
                    <Column gap={spacings.xxl} alignItems="start">
                        <Row>
                            <IconWrapper>
                                <Icon
                                    icon="SHIELD_CHECK"
                                    size={20}
                                    color={colorVariants.standard.backgroundPrimaryDefault}
                                />
                            </IconWrapper>
                            <div>
                                <Subheading typographyStyle="highlight">
                                    <Translation id="TR_COINMARKET_DCA_FEATURE_1_SUBHEADING" />
                                </Subheading>
                                <Paragraph>
                                    <Translation id="TR_COINMARKET_DCA_FEATURE_1_DESCRIPTION" />
                                </Paragraph>
                            </div>
                        </Row>
                        <Row>
                            <IconWrapper>
                                <Icon
                                    icon="ARROW_DOWN"
                                    size={20}
                                    color={colorVariants.standard.backgroundPrimaryDefault}
                                />
                            </IconWrapper>
                            <div>
                                <Subheading typographyStyle="highlight">
                                    <Translation id="TR_COINMARKET_DCA_FEATURE_2_SUBHEADING" />
                                </Subheading>
                                <Paragraph>
                                    <Translation id="TR_COINMARKET_DCA_FEATURE_2_DESCRIPTION" />
                                </Paragraph>
                            </div>
                        </Row>
                        <Row>
                            <IconWrapper>
                                <Icon
                                    icon="LIGHTNING"
                                    size={20}
                                    color={colorVariants.standard.backgroundPrimaryDefault}
                                />
                            </IconWrapper>
                            <div>
                                <Subheading typographyStyle="highlight">
                                    <Translation id="TR_COINMARKET_DCA_FEATURE_3_SUBHEADING" />
                                </Subheading>
                                <Paragraph>
                                    <Translation id="TR_COINMARKET_DCA_FEATURE_3_DESCRIPTION" />
                                </Paragraph>
                            </div>
                        </Row>
                        <Row>
                            <IconWrapper>
                                <Icon
                                    icon="EYE"
                                    size={20}
                                    color={colorVariants.standard.backgroundPrimaryDefault}
                                />
                            </IconWrapper>
                            <div>
                                <Subheading typographyStyle="highlight">
                                    <Translation id="TR_COINMARKET_DCA_FEATURE_4_SUBHEADING" />
                                </Subheading>
                                <Paragraph>
                                    <Translation id="TR_COINMARKET_DCA_FEATURE_4_DESCRIPTION" />
                                </Paragraph>
                            </div>
                        </Row>
                    </Column>
                </Column1>
                <Column2>
                    <WrappedText typographyStyle="highlight">
                        <Translation id="TR_COINMARKET_DCA_DOWNLOAD" />
                    </WrappedText>
                    <TrezorLink href={COINMARKET_DOWNLOAD_INVITY_APP_URL}>
                        <Image image="COINMARKET_DCA_INVITY_APP_QR" width={233} height={226} />
                    </TrezorLink>
                    <Row>
                        <TrezorLink href={COINMARKET_DOWNLOAD_INVITY_APP_URL}>
                            <StoreBadge
                                image="PLAY_STORE_TITLE"
                                $isLight={currentTheme === 'light'}
                                height={26}
                            />
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
                            <StoreBadge
                                image="APP_STORE_TITLE"
                                $isLight={currentTheme === 'light'}
                                height={26}
                            />
                        </TrezorLink>
                    </Row>
                </Column2>
            </Row>
        </Layout>
    );
};

export default withSelectedAccountLoaded(DCALanding, {
    title: 'TR_NAV_DCA',
});
