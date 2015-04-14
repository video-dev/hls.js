export default {
  // triggered when MediaSource has been attached to video tag
  MSE_ATTACHED : 'hlsMediaSourceAttached',
  //Identifier for a manifest loaded event
  MANIFEST_LOADED  : 'hlsManifestLoaded',
  //Identifier for a manifest parsed event, when this event is received, main manifest and start level has been retrieved
  MANIFEST_PARSED  : 'hlsManifestParsed',
  // Identifier for a level loading event
  LEVEL_LOADING    : 'hlsLevelLoading',
  // Identifier for a level loaded event
  LEVEL_LOADED :  'hlsLevelLoaded',
  // Identifier for a level switch event
  LEVEL_SWITCH :  'hlsLevelSwitch',
  // Identifier for a fragment loading event
  FRAG_LOADING :  'hlsFragmentLoading',
  // Identifier for a fragment loaded event
  FRAG_LOADED :  'hlsFragmentLoaded',
  // Identifier for a fragment parsing init segment event
  FRAG_PARSING_INIT_SEGMENT :  'hlsFragmentParsingInitSegment',
  // Identifier for a fragment parsing data event
  FRAG_PARSING_DATA :  'hlsFragmentParsingData',
  // Identifier for a fragment parsing error event
  FRAG_PARSING_ERROR :  'hlsFragmentParsingError',
  // Identifier for a fragment parsed event
  FRAG_PARSED :  'hlsFragmentParsed',
  // Identifier for a fragment buffered  event
  FRAG_BUFFERED :  'hlsFragmentBuffered',
  // Identifier for a load error event
  LOAD_ERROR :  'hlsLoadError',
  // Identifier for a level switch error
  LEVEL_ERROR :  'hlsLevelError',
  // Identifier for a video error event
  VIDEO_ERROR :  'hlsVideoError'
};
