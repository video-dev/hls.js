export interface ComponentAPI {
  destroy(): void;
}

export interface NetworkComponentAPI extends ComponentAPI {
  startLoad(startPosition: number): void;
  stopLoad(): void;
}
