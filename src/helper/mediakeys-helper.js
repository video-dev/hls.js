const requestMediaKeySystemAccess = (function() {
    if (window.navigator && window.navigator.requestMediaKeySystemAccess) {
        return window.navigator.requestMediaKeySystemAccess.bind(
            window.navigator
        );
    } else {
        return null;
    }
})();

export { requestMediaKeySystemAccess };
