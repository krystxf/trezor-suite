// @ts-expect-error (js-only dependency)
import checkForPhishing from 'eth-phishing-detect';

export const isPhishingDomain = (domain: string): boolean => checkForPhishing(domain);
