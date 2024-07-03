export function getConfig(editor) {
  return new Promise((resolve, reject) => {
    try {
      const config = eval(
        iife(editor.getValue().replace(/^[\s\w]+=[^{]*/, ''))
      );
      if (Object(config) === config && !Array.isArray(config)) {
        resolve(config);
      } else {
        throw new Error('Config must be an object');
      }
    } catch (error) {
      setTimeout(function () {
        reject(error);
      });
    }
  });
}

export const iife = (js) =>
  `(function(){\nreturn ${js.replace(/^\s+/, '')}}());\n`;
