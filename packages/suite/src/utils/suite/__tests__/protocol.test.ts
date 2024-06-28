import { testMocks } from '@suite-common/test-utils';

import { getProtocolInfo, isPaymentRequestProtocolScheme } from 'src/utils/suite/protocol';
import * as fixtures from '../__fixtures__/protocol';

jest.doMock('@trezor/suite-analytics', () => testMocks.getAnalytics());

describe('getProtocolInfo', () => {
    fixtures.getProtocolInfo.forEach(f => {
        it(f.description, () => {
            expect(getProtocolInfo(f.uri as string)).toEqual(f.result);
        });
    });
});

describe('isPaymentRequestProtocolScheme', () => {
    fixtures.isPaymentRequestProtocolScheme.forEach(f => {
        it(f.description, () => {
            expect(isPaymentRequestProtocolScheme(f.scheme)).toEqual(f.result);
        });
    });
});
