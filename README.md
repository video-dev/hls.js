# mse-hls
[MSE](http://w3c.github.io/media-source/)-based [HLS](http://en.wikipedia.org/wiki/HTTP_Live_Streaming) library.

this lib allows to playback HLS streams on browsers supporting media source extensions.
 
the lib is written in EcmaScript 6, and transpiled in ES5.

# Getting Started

```html
<script src="dist/hls.js"></script>

<script>
  if(Hls.isSupported()) {
    var video = document.getElementById('video');
    var hls = new Hls(video);
    hls.on(hls.Events.FRAMEWORK_READY,function() {
      hls.attachSource(manifest);
  });
 }
</script>
```

playback is then controlled through video tag, as usual.


# compatibility
 mse-hls is compatible with browsers supporting MSE with 'video/MP4' inputs.
as of today, supported on:

 * Chrome for Desktop 34+
 * Safari for Mac 8+
 * IE for Windows 11+
 * Chrome for Android 34+
 * IE for Winphone 8.1+
