export function sortObject(obj) {
  if(typeof obj !== 'object') {
    return obj;
  }
  let temp = {};
  let keys = [];
  for(let key in obj) {
    keys.push(key);
  }
  keys.sort();
  for(let index in keys) {
    temp[keys[index]] = sortObject(obj[keys[index]]);
  }
  return temp;
}

export function copyTextToClipboard(text) {
  let textArea = document.createElement('textarea');
  textArea.value = text;
  document.body.appendChild(textArea);
  textArea.select();
  try {
    let successful = document.execCommand('copy');
    let msg = successful ? 'successful' : 'unsuccessful';
    console.log('Copying text command was ' + msg);
  } catch (err) {
    console.log('Oops, unable to copy');
  }
  document.body.removeChild(textArea);
}

