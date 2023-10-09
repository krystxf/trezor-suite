import { useEffect } from 'react';
import styled from 'styled-components';
import { Textarea, Icon } from '@trezor/components';
import { QuestionTooltip } from 'src/components/suite';
import { useSendFormContext } from 'src/hooks/wallet';
import { isHexValid } from '@suite-common/wallet-utils';
import { MAX_LENGTH } from 'src/constants/suite/inputs';
import { useTranslation } from 'src/hooks/suite';

const inputAsciiName = 'ethereumDataAscii';
const inputHexName = 'ethereumDataHex';
const inputAmountName = 'outputs.0.amount';

const Wrapper = styled.div`
    display: flex;
    width: 100%;
    justify-content: space-between;
    align-items: center;
`;

const Space = styled.div`
    display: flex;
    justify-content: center;
    min-width: 65px;
`;

interface DataProps {
    close: () => void;
}

export const Data = ({ close }: DataProps) => {
    const {
        register,
        formState: { errors },
        setValue,
        setAmount,
        composeTransaction,
        resetDefaultValue,
        trigger,
        watch,
    } = useSendFormContext();
    const { translationString } = useTranslation();

    const [asciiValue, hexValue, amount] = watch([inputAsciiName, inputHexName, inputAmountName]);

    const asciiError = errors.ethereumDataAscii;
    const hexError = errors.ethereumDataHex;

    const handleClose = () => {
        resetDefaultValue(inputAsciiName);
        resetDefaultValue(inputHexName);
        if (amount === '0') {
            setAmount(0, '');
        }
        close();
    };

    const getChangeHandler =
        (isHex: boolean) => (event: React.ChangeEvent<HTMLTextAreaElement>) => {
            setValue(
                isHex ? inputAsciiName : inputHexName,
                Buffer.from(event.target.value, isHex ? 'hex' : 'ascii').toString(
                    isHex ? 'ascii' : 'hex',
                ),
                { shouldValidate: true },
            );
            if (!event.target.value && amount === '0') {
                setAmount(0, '');
            } else if (event.target.value && amount === '') {
                setAmount(0, '0');
            }
            composeTransaction(isHex ? inputHexName : inputAsciiName);
        };

    const { ref: asciiRef, ...asciiField } = register(inputAsciiName, {
        onChange: getChangeHandler(false),
    });
    const { ref: hexRef, ...hexField } = register(inputHexName, {
        onChange: getChangeHandler(true),
        validate: value => {
            if (value && !isHexValid(value, '0x')) {
                return translationString('DATA_NOT_VALID_HEX');
            }
            if (value && value.length > 8192 * 2) {
                return translationString('DATA_HEX_TOO_BIG'); // 8192 bytes limit for protobuf single message encoding in FW
            }
        },
    });

    // Trigger amount validation after data is set. This removes the validation message if amount is 0.
    // A transaction with 0 amount is valid as long as it has data - this type of transaction can be used to interact with contract.
    useEffect(() => {
        if (amount === '0' && hexValue) {
            trigger(inputAmountName);
        }
    }, [amount, hexValue, trigger]);

    return (
        <Wrapper>
            <Textarea
                inputState={asciiError && 'error'}
                data-test={inputAsciiName}
                defaultValue={asciiValue}
                maxLength={MAX_LENGTH.ETH_DATA}
                bottomText={asciiError?.message || null}
                label={<QuestionTooltip label="DATA_ETH" tooltip="DATA_ETH_TOOLTIP" />}
                innerRef={asciiRef}
                {...asciiField}
            />
            <Space> = </Space>
            <Textarea
                inputState={hexError && 'error'}
                data-test={inputHexName}
                defaultValue={hexValue}
                maxLength={MAX_LENGTH.ETH_DATA}
                bottomText={hexError?.message || null}
                labelRight={
                    <Icon
                        size={20}
                        icon="CROSS"
                        data-test="send/close-ethereum-data"
                        onClick={handleClose}
                    />
                }
                innerRef={hexRef}
                {...hexField}
            />
        </Wrapper>
    );
};
