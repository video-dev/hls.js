import EwmaBandWidthEstimator from '../utils/ewma-bandwidth-estimator';

export interface ComponentAPI {
  destroy(): void;
}

export interface AbrComponentAPI extends ComponentAPI {
  nextAutoLevel: number;
  readonly bwEstimator?: EwmaBandWidthEstimator;
}

export interface NetworkComponentAPI extends ComponentAPI {
  startLoad(startPosition: number): void;
  stopLoad(): void;
}
