import styled from 'styled-components';

import { H1, variables } from '@trezor/components';
import { TREZOR_SUPPORT_URL } from '@trezor/urls';

import { Translation, TrezorLink } from 'src/components/suite';
import { SecurityChecklist } from './SecurityChecklist';
import { SecurityCheckButton } from './SecurityCheckButton';

const TopSection = styled.div`
    border-bottom: 1px solid ${({ theme }) => theme.STROKE_GREY};
    margin-top: 8px;
    padding-bottom: 24px;
    width: 100%;
`;

const StyledH1 = styled(H1)`
    font-size: 28px;
    font-weight: ${variables.FONT_WEIGHT.DEMI_BOLD};
    max-width: 300px;
`;

const Text = styled.div`
    color: ${({ theme }) => theme.TYPE_LIGHT_GREY};
    font-size: ${variables.FONT_SIZE.NORMAL};
    font-weight: ${variables.FONT_WEIGHT.MEDIUM};
`;

const Buttons = styled.div`
    display: flex;
    gap: 24px;
    width: 100%;
`;

const StyledTrezorLink = styled(TrezorLink)`
    /* flex-grow has no effect on a link, display is set to contents so that it can be read from the child */
    display: contents;
`;

const StyledSecurityCheckButton = styled(SecurityCheckButton)`
    flex-grow: 1;
`;

const checklistItems = [
    {
        icon: 'PLUGS',
        content: <Translation id="TR_DISCONNECT_DEVICE" />,
    },
    {
        icon: 'HAND',
        content: <Translation id="TR_AVOID_USING_DEVICE" />,
    },
    {
        icon: 'CHAT',
        content: <Translation id="TR_USE_CHAT" values={{ b: chunks => <b>{chunks}</b> }} />,
    },
] as const;

const supportChatUrl = `${TREZOR_SUPPORT_URL}#open-chat`;

interface SecurityCheckFailProps {
    goBack?: () => void;
}

export const SecurityCheckFail = ({ goBack }: SecurityCheckFailProps) => (
    <>
        <TopSection>
            <StyledH1>
                <Translation id="TR_DEVICE_COMPROMISED_HEADING" />
            </StyledH1>
            <Text>
                <Translation id="TR_DEVICE_COMPROMISED_TEXT" />
            </Text>
        </TopSection>
        <SecurityChecklist items={checklistItems} />
        <Buttons>
            {goBack && (
                <SecurityCheckButton variant="secondary" onClick={goBack}>
                    <Translation id="TR_BACK" />
                </SecurityCheckButton>
            )}
            <StyledTrezorLink variant="nostyle" href={supportChatUrl}>
                <StyledSecurityCheckButton>
                    <Translation id="TR_CONTACT_TREZOR_SUPPORT" />
                </StyledSecurityCheckButton>
            </StyledTrezorLink>
        </Buttons>
    </>
);
