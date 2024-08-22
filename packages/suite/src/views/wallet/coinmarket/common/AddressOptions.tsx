import { useEffect, ReactElement } from 'react';
import { UseFormReturn, Control, Controller } from 'react-hook-form';
import type { MenuPlacement } from 'react-select';
import styled from 'styled-components';

import type { AccountAddress } from '@trezor/connect';
import { Translation } from 'src/components/suite';
import { variables, Select } from '@trezor/components';
import type { Account, NetworkSymbol } from 'src/types/wallet';
import { useAccountAddressDictionary } from 'src/hooks/wallet/useAccounts';
import { selectLabelingDataForAccount } from 'src/reducers/suite/metadataReducer';
import { useSelector } from 'src/hooks/suite';
import { CoinmarketBuyAddressOptionsType } from 'src/types/coinmarket/coinmarketOffers';
import { CoinmarketBalance } from 'src/views/wallet/coinmarket/common/CoinmarketBalance';
import { spacingsPx, typography } from '@trezor/theme';

const AddressWrapper = styled.div`
    display: flex;
    flex-direction: column;
`;

const Amount = styled.div`
    display: flex;
    gap: ${spacingsPx.xxs};
    ${typography.label}
    color: ${({ theme }) => theme.textSubdued};
`;

const Address = styled.div`
    display: flex;
    font-weight: ${variables.FONT_WEIGHT.MEDIUM};
`;

const Option = styled.div`
    display: flex;
    align-items: center;
`;

const buildOptions = (addresses: Account['addresses']) => {
    if (!addresses) return undefined;

    interface Options {
        label: ReactElement;
        options: AccountAddress[];
    }

    const unused: Options = {
        label: <Translation id="RECEIVE_TABLE_NOT_USED" />,
        options: addresses.unused,
    };

    const used: Options = {
        label: <Translation id="RECEIVE_TABLE_USED" />,
        options: addresses.used,
    };

    return [unused, used];
};

interface AddressOptionsProps<TFieldValues extends CoinmarketBuyAddressOptionsType>
    extends Pick<UseFormReturn<TFieldValues>, 'setValue'> {
    control: Control<TFieldValues>;
    receiveSymbol?: string;
    account?: Account;
    address?: string;
    menuPlacement?: MenuPlacement;
}
export const AddressOptions = <TFieldValues extends CoinmarketBuyAddressOptionsType>({
    receiveSymbol,
    address,
    account,
    menuPlacement,
    ...props
}: AddressOptionsProps<TFieldValues>) => {
    // Type assertion allowing to make the component reusable, see https://stackoverflow.com/a/73624072.
    const { control, setValue } =
        props as unknown as UseFormReturn<CoinmarketBuyAddressOptionsType>;

    const addresses = account?.addresses;
    const addressDictionary = useAccountAddressDictionary(account);
    const value = address ? addressDictionary[address] : undefined;
    const accountMetadata = useSelector(state =>
        selectLabelingDataForAccount(state, account?.key || ''),
    );
    const receiveSymbolTyped = receiveSymbol as NetworkSymbol;

    useEffect(() => {
        if (!address && addresses) {
            setValue('address', addresses.unused[0].address);
        }
    }, [address, addresses, setValue]);

    return (
        <Controller
            control={control}
            name="address"
            render={({ field: { onChange } }) => (
                <Select
                    onChange={({ address }) => onChange(address)}
                    isClearable={false}
                    value={value}
                    options={buildOptions(addresses)}
                    minValueWidth="70px"
                    menuPlacement={menuPlacement}
                    formatOptionLabel={(accountAddress: AccountAddress) => {
                        if (!accountAddress) return null;

                        return (
                            <Option>
                                <AddressWrapper>
                                    <Address>
                                        {accountMetadata.addressLabels[accountAddress.address] ||
                                            accountAddress.address}
                                    </Address>
                                    <Amount>
                                        <CoinmarketBalance
                                            balance={accountAddress.balance}
                                            cryptoSymbolLabel={receiveSymbolTyped.toLocaleUpperCase()}
                                            networkSymbol={receiveSymbolTyped}
                                        />
                                        <span>•</span>
                                        <span>{accountAddress.path}</span>
                                    </Amount>
                                </AddressWrapper>
                            </Option>
                        );
                    }}
                />
            )}
        />
    );
};
