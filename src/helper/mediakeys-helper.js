export function requestMediaKeySystemAccess() {
  if (window.navigato && window.navigator.requestMediaKeySystemAccess) {
    return window.navigator.requestMediaKeySystemAccess.bind(window.navigator);
  }
  else {
    return null;
  }
}
