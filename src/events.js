export default {
  // Identifier for a framework ready event, triggered when ready to set DataSource
  FRAMEWORK_READY : 'hlsFrameworkReady',
  // Identifier for a manifest loading event, triggered after a call to hls.attachSource(url)
  MANIFEST_LOADING : 'hlsManifestLoading',
  //Identifier for a manifest loaded event, when this event is received, main manifest and start level has been retrieved
  MANIFEST_LOADED  : 'hlsManifestLoaded',
  // Identifier for a level loading event
  LEVEL_LOADING    : 'hlsLevelLoading',
  // Identifier for a level loaded event
  LEVEL_LOADED :  'hlsLevelLoaded',
  // Identifier for a level switch event
  LEVEL_SWITCH :  'hlsLevelSwitch',
  // Identifier for a level ENDLIST event
  LEVEL_ENDLIST :  'hlsLevelEndList',
  // Identifier for a fragment loading event
  FRAGMENT_LOADING :  'hlsFragmentLoading',
  // Identifier for a fragment loaded event
  FRAGMENT_LOADED :  'hlsFragmentLoaded',
  // Identifier when last fragment of playlist has been loaded
  LAST_FRAGMENT_LOADED :  'hlsLastFragmentLoaded',
  // Identifier for a fragment parsed event
  FRAGMENT_PARSED :  'hlsFragmentParsed',
  // Identifier for a load error event
  LOAD_ERROR :  'hlsLoadError',
  // Identifier for a level switch error
  LEVEL_ERROR :  'hlsLevelError',
  // Identifier for a playback media time change event
  MEDIA_TIME :  'hlsMediaTime',
  // Identifier for a playback state switch event
  PLAYBACK_STATE :  'hlsPlaybackState',
  // Identifier for a seek state switch event
  SEEK_STATE :  'hlsSeekState',
  // Identifier for a playback complete event
  PLAYBACK_COMPLETE :  'hlsPlayBackComplete'
};
