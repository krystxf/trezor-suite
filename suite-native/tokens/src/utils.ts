import { G, S } from '@mobily/ts-belt';

import { NetworkSymbol } from '@suite-common/wallet-config';

export const getEthereumTokenName = (tokenName?: string) => {
    if (G.isNullable(tokenName) || S.isEmpty(tokenName)) return 'Unknown token';

    return tokenName;
};

export const NETWORKS_WITH_TOKENS = ['eth'] satisfies Array<NetworkSymbol>;
export type NetworkWithTokens = (typeof NETWORKS_WITH_TOKENS)[number];

export const isCoinWithTokens = (symbol: NetworkSymbol): symbol is NetworkWithTokens => {
    // We typecast because TS does complain that other coins like btc are not included in NETWORKS_WITH_TOKENS which is whole point of this function to check it
    return NETWORKS_WITH_TOKENS.includes(symbol as NetworkWithTokens);
};
