/* 
 env.js provides helpers for better user agent and feature detection 
 it can be re-used in other portions of hls.js and augmented as needs evolved
 while we can all agree that user agent detection is not ideal hls.js 
 does need to use it to overcome some browser quirks
*/

var _getUserAgent = function () {
	if (typeof window !== 'undefined' && window.navigator && window.navigator.userAgent) {
		return window.navigator.userAgent;
	} else {
		return null;
	}
};

// we check for touch event support on top of UA strings
// e.g. Android may be used not only on mobiles but also in gears, cars, TVs ...
// same for iOS
var _hasTouchEvents = function () {
	if (typeof window !== 'undefined' && (typeof window.ontouchstart !== 'undefined' ||
		(window.DocumentTouch && document instanceof DocumentTouch))) {
		return true;
	}
	return false;
};

// based on https://msdn.microsoft.com/en-us/library/hh869301(v=vs.85).aspx
// we need to detect windows phone not because we want to support it with hls.js 
// but because its ua can present itself as Android or iOS - which it is not
var _isWindowsPhone = function (ua, hasTouchEvents) {
	let pattern = /windows\s+phone\s+\d+\./i;
	if (pattern.test(ua) && hasTouchEvents) {
		return true;
	}
	return false;
};

var _isIos = function (ua, hasTouchEvents, isWindowsPhone) {
	if (isWindowsPhone || !hasTouchEvents) {
		return false;
	}
	let pattern = /(ipad|iphone|ipod)\s+os\s+\d+/i;
	if (pattern.test(ua) && hasTouchEvents) {
		return true;
	}
	return false;
};

var _isAndroid = function (ua, hasTouchEvents, isWindowsPhone, isIos) {
	if (isWindowsPhone || isIos || !hasTouchEvents) {
		return false;
	}
	let pattern = /android\s+\d+\./i;
	if (pattern.test(ua)) {
		return true;
	}
	return false;
};

var _isMacOSX = function (ua, isIos) {
	let pattern = /(macintosh|mac\s+os)/i;
	if (pattern.test(ua) && !isIos) {
		return true;
	}
	return false;
};


// based on https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/User-Agent/Firefox
var _isFirefoxIos = function (ua, isIos) {
	if (isIos) {
		let pattern = /fxios\/\d+\.\d+/i;
		if (pattern.test(ua)) {
			return true;
		}
	}
	return false;
};
var _isFirefox = function (ua, isFirefoxIos) {
	let pattern = /mozilla\/\d+.+rv:.+gecko\/\d+.+firefox\/\d+/i;
	if (isFirefoxIos || pattern.test(ua)) {
		return true;
	}
	return false;
};

// based on https://developer.chrome.com/multidevice/user-agent
var _isCromeIos = function (ua, isIos) {
	if (isIos) {
		let pattern = /crios\/\d+\.\d+/i;
		if (pattern.test(ua)) {
			return true;
		}
	}
	return false;
};
var _isChrome = function (ua, isCromeIos) {
	let pattern = /mozilla\/\d+.+applewebkit\/\d+.+\(KHTML,\s+like\s+Gecko\).+chrome\/\d+.+safari\/\d+/i;
	if (isCromeIos || pattern.test(ua)) {
		return true;
	}
	return false;
};

var _isSafari = function (ua, isMacOSX, isIos, isCromeIos, isFirefoxIos) {
	let pattern1 = /safari/i;
	let pattern2 = /chrome/i;
	let pattern3 = /chromium/i;
	let pattern4 = /android/i;
	// not sure we need to be that thorough (e.g. isCromeIos and isFirefoxIos) but it does not hurt
	if ((isMacOSX || isIos) && !isCromeIos && !isFirefoxIos && pattern1.test(ua) && !pattern2.test(ua) && !pattern3.test(ua) &&
		!pattern4.test(ua)) {
		return true;
	}
	return false;
};


const Env = {};

Env.ua = _getUserAgent();
Env.hasTouchEvents = _hasTouchEvents();

Env.isWindowsPhone = _isWindowsPhone(Env.ua, Env.hasTouchEvents);
Env.isIos = _isIos(Env.ua, Env.hasTouchEvents, Env.isWindowsPhone);
Env.isAndroid = _isAndroid(Env.ua, Env.hasTouchEvents, Env.isWindowsPhone, Env.isIos);
Env.isMacOSX = _isMacOSX(Env.ua, Env.isIos);

Env.isFirefoxIos = _isFirefoxIos(Env.ua, Env.isIos);
Env.isFirefox = _isFirefox(Env.ua, Env.isFirefoxIos);
Env.isCromeIos = _isCromeIos(Env.ua, Env.isIos);
Env.isChrome = _isChrome(Env.ua, Env.isCromeIos);
Env.isSafari = _isSafari(Env.ua, Env.isMacOSX, Env.isIos, Env.isCromeIos, Env.isFirefoxIos);

// logs - uncomment when needed
/*var keys = Object.keys(Env);
for (let i = 0, len = keys.length; i < len; i++) {
	let currentKey = keys[i];
	console.log(currentKey + ' - ' + Env[currentKey]);
}*/

export { Env };
