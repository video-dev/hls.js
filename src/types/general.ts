/**
 * Make specific properties in T required
 */
export type RequiredProperties<T, K extends keyof T> = T & {
  [P in K]-?: T[P];
};
