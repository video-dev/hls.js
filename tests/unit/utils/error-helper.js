import { shouldRetry } from '../../../src/utils/error-helper';

describe('ErrorHelper', function () {
  it('shouldRetry', function () {
    const retryConfig = {
      maxNumRetry: 3,
    };
    expect(shouldRetry(retryConfig, 3, false, '502')).to.be.false;
    expect(shouldRetry(null, 3, false, '502')).to.be.false;
    expect(shouldRetry(retryConfig, 2, false, '502')).to.be.true;
    expect(shouldRetry(retryConfig, 2, false, '404')).to.be.false;

    retryConfig.shouldRetry = (
      _retryConfig,
      _retryCount,
      _isTimeout,
      httpStatus,
      retry
    ) => {
      if (!retry && httpStatus === '404') {
        return true;
      }

      return false;
    };
    expect(shouldRetry(retryConfig, 5, false, '404', false)).to.be.true;

    retryConfig.shouldRetry = (retryConfig, retryCount) => {
      return retryConfig.maxNumRetry <= retryCount;
    };
    expect(shouldRetry(retryConfig, 2, false, '502', true)).to.be.false;
  });
});
