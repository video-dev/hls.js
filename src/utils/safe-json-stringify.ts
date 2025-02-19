const replacer = () => {
  const known = new WeakSet();
  return (_, value) => {
    if (typeof value === 'object' && value !== null) {
      if (known.has(value)) {
        return;
      }
      known.add(value);
    }
    return value;
  };
};

export const stringify = <T>(object: T): string =>
  JSON.stringify(object, replacer());
