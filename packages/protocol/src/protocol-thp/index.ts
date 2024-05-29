export * from './decode';
export * from './encode';
export * from './messages';
export { getCpaceHostKeys, getShareSecret, handleHandshakeInitResponse } from './crypto/pairing';
export { ThpProtocolState } from './ThpProtocolState';
export { getCurve25519KeyPair } from './crypto/curve25519';

export type { ThpMessageType, ThpDeviceProperties } from './messages';
export const name = 'thp';
