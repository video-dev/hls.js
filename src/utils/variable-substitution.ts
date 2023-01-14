import { logger } from './logger';
import type { AttrList } from './attr-list';
import type { VariableMap } from '../types/level';

const VARIABLE_REPLACEMENT_REGEX = /\{\$([a-zA-Z0-9-_]+)\}/g;

export function substituteVariablesInAttributes(
  variableList: VariableMap | null | undefined,
  attr: AttrList,
  attributeNames: string[]
) {
  if (variableList) {
    for (let i = attributeNames.length; i--; ) {
      const name = attributeNames[i];
      const value = attr[name];
      if (value) {
        attr[name] = substituteVariables(variableList, value);
      }
    }
  }
}

export function substituteVariables(
  variableList: VariableMap | null | undefined,
  value: string
): string {
  if (variableList) {
    return value.replace(
      VARIABLE_REPLACEMENT_REGEX,
      (variableReference: string) => {
        const variableName = variableReference.substring(
          2,
          variableReference.length - 1
        );
        const variableValue = variableList[variableName];
        if (variableValue === undefined) {
          logger.error(
            `Missing preceding EXT-X-DEFINE tag for Variable Reference "${variableName}"`
          );
          return variableReference;
        }
        return variableValue;
      }
    );
  }
  return value;
}
