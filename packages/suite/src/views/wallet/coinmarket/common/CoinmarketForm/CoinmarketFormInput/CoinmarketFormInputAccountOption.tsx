import { networks } from '@suite-common/wallet-config';
import { amountToSatoshi, getNetwork } from '@suite-common/wallet-utils';
import { useElevation } from '@trezor/components';
import { HiddenPlaceholder } from 'src/components/suite';
import { useBitcoinAmountUnit } from 'src/hooks/wallet/useBitcoinAmountUnit';
import { CoinmarketAccountOptionsGroupOptionProps } from 'src/types/coinmarket/coinmarket';
import { coinmarketGetAccountLabel } from 'src/utils/wallet/coinmarket/coinmarketUtils';
import {
    cryptoToNetworkSymbol,
    isCryptoSymbolToken,
} from 'src/utils/wallet/coinmarket/cryptoSymbolUtils';
import {
    CoinmarketFormOption,
    CoinmarketFormOptionLabel,
    CoinmarketFormOptionLabelLong,
    CoinmarketFormOptionNetwork,
} from 'src/views/wallet/coinmarket';
import { CoinmarketFormOptionIcon } from 'src/views/wallet/coinmarket/common/CoinmarketCoinImage';

interface CoinmarketFormInputAccountOptionProps {
    option: CoinmarketAccountOptionsGroupOptionProps;
}

export const CoinmarketFormInputAccountOption = ({
    option,
}: CoinmarketFormInputAccountOptionProps) => {
    const networkSymbol = cryptoToNetworkSymbol(option.value);
    const network = getNetwork(networkSymbol ?? 'btc');
    const { shouldSendInSats } = useBitcoinAmountUnit(network?.symbol);
    const { elevation } = useElevation();

    const balanceLabel = coinmarketGetAccountLabel(option.label, shouldSendInSats);
    const balance = shouldSendInSats
        ? amountToSatoshi(option.balance, network?.decimals ?? 8)
        : option.balance;

    return (
        <CoinmarketFormOption>
            <CoinmarketFormOptionIcon symbol={option.label} />
            <CoinmarketFormOptionLabel>{option.label}</CoinmarketFormOptionLabel>
            <CoinmarketFormOptionLabelLong>{option.cryptoName}</CoinmarketFormOptionLabelLong>
            <CoinmarketFormOptionLabelLong>
                <HiddenPlaceholder>
                    ({balance} {balanceLabel})
                </HiddenPlaceholder>
            </CoinmarketFormOptionLabelLong>
            {option.value && isCryptoSymbolToken(option.value) && networkSymbol && (
                <CoinmarketFormOptionNetwork $elevation={elevation}>
                    {networks[networkSymbol].name}
                </CoinmarketFormOptionNetwork>
            )}
        </CoinmarketFormOption>
    );
};
