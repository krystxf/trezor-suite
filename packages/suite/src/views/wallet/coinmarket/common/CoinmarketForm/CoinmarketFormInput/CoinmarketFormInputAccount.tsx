import { Control, Controller } from 'react-hook-form';
import { Select } from '@trezor/components';
import { useCoinmarketFormContext } from 'src/hooks/wallet/coinmarket/form/useCoinmarketCommonForm';
import {
    CoinmarketAccountOptionsGroupOptionProps,
    CoinmarketCryptoListProps,
    CoinmarketTradeSellExchangeType,
} from 'src/types/coinmarket/coinmarket';
import { CoinmarketFormOptionGroupLabel } from 'src/views/wallet/coinmarket';
import CoinmarketFormInputLabel from 'src/views/wallet/coinmarket/common/CoinmarketForm/CoinmarketFormInput/CoinmarketFormInputLabel';
import {
    CoinmarketExchangeFormProps,
    CoinmarketFormInputAccountProps,
    CoinmarketSellExchangeFormProps,
    CoinmarketSellFormProps,
} from 'src/types/coinmarket/coinmarketForm';
import { createFilter } from 'react-select';
import { useCoinmarketBuildAccountGroups } from 'src/hooks/wallet/coinmarket/form/useCoinmarketSellFormDefaultValues';
import { CoinmarketFormInputAccountOption } from 'src/views/wallet/coinmarket/common/CoinmarketForm/CoinmarketFormInput/CoinmarketFormInputAccountOption';

const CoinmarketFormInputAccount = <
    TFieldValues extends CoinmarketSellFormProps | CoinmarketExchangeFormProps,
>({
    label,
    accountSelectName,
}: CoinmarketFormInputAccountProps<TFieldValues>) => {
    const {
        type,
        form: {
            helpers: { onCryptoCurrencyChange },
        },
    } = useCoinmarketFormContext<CoinmarketTradeSellExchangeType>();
    const { control } = useCoinmarketFormContext();
    const optionGroups = useCoinmarketBuildAccountGroups(type);

    return (
        <>
            <CoinmarketFormInputLabel label={label} />
            <Controller
                name={accountSelectName}
                control={control as Control<CoinmarketSellExchangeFormProps>}
                render={({ field: { onChange, value } }) => (
                    <Select
                        value={value}
                        options={optionGroups}
                        onChange={(selected: CoinmarketAccountOptionsGroupOptionProps) => {
                            onChange(selected);
                            onCryptoCurrencyChange(selected);
                        }}
                        filterOption={createFilter<CoinmarketCryptoListProps>({
                            stringify: option => `${option.value} ${option.data.cryptoName}`,
                        })}
                        formatGroupLabel={group => (
                            <CoinmarketFormOptionGroupLabel>
                                {group.label}
                            </CoinmarketFormOptionGroupLabel>
                        )}
                        formatOptionLabel={option => (
                            <CoinmarketFormInputAccountOption option={option} />
                        )}
                        data-testid="@coinmarket/form/select-account"
                        isClearable={false}
                        isSearchable
                    />
                )}
            />
        </>
    );
};

export default CoinmarketFormInputAccount;
