import { getSelfScope } from '../utils/get-self-scope';

const self = getSelfScope();
const Number: NumberConstructor = (self as any).Number;

export const isFiniteNumber: NumberConstructor['isFinite'] =
  Number.isFinite ||
  ((value) => typeof value === 'number' && isFinite(value));
