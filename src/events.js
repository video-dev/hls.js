export default {
  // fired when MediaSource has been succesfully attached to video element - data: { mediaSource }
  MSE_ATTACHED : 'hlsMediaSourceAttached',
  // fired after manifest has been loaded - data: { levels : [available quality levels] , url : manifestURL, stats : { trequest, tfirst, tload, mtime}}
  MANIFEST_LOADED  : 'hlsManifestLoaded',
  // fired after manifest has been parsed - data: { levels : [available quality levels] , startLevel : playback start level, audiocodecswitch: true if different audio codecs used}
  MANIFEST_PARSED  : 'hlsManifestParsed',
  // fired when a level playlist loading starts - data: { levelId : id of level being loaded}
  LEVEL_LOADING    : 'hlsLevelLoading',
  // fired when a level playlist loading finishes - data: { details : levelDetails object, levelId : id of loaded level, stats : { trequest, tfirst, tload, mtime} }
  LEVEL_LOADED :  'hlsLevelLoaded',
  // fired when a level switch is requested - data: { levelId : id of new level }
  LEVEL_SWITCH :  'hlsLevelSwitch',
  // fired when a fragment loading starts - data: { frag : fragment object}
  FRAG_LOADING :  'hlsFragmentLoading',
  // fired when a fragment loading is completed - data: { frag : fragment object, payload : fragment payload, stats : { trequest, tfirst, tload, length}}
  FRAG_LOADED :  'hlsFragmentLoaded',
  // fired when Init Segment has been extracted from fragment - data: { moov : moov MP4 box, codecs : codecs found while parsing fragment}
  FRAG_PARSING_INIT_SEGMENT :  'hlsFragmentParsingInitSegment',
  // fired when moof/mdat have been extracted from fragment - data: { moof : moof MP4 box, mdat : mdat MP4 box}
  FRAG_PARSING_DATA :  'hlsFragmentParsingData',
  // fired when fragment parsing is completed - data: undefined
  FRAG_PARSED :  'hlsFragmentParsed',
  // fired when fragment remuxed MP4 boxes have all been appended into SourceBuffer - data: { frag : fragment object, stats : { trequest, tfirst, tload, tparsed, tbuffered, length} }
  FRAG_BUFFERED :  'hlsFragmentBuffered',
  // fired when fragment matching with current video position is changing - data : { frag : fragment object }
  FRAG_CHANGED :  'hlsFragmentChanged',
  // Identifier for fragment/playlist load error - data: { url : faulty URL, response : XHR response}
  LOAD_ERROR :  'hlsLoadError',
  // Identifier for fragment/playlist load timeout - data: { url : faulty URL, response : XHR response}
  LOAD_TIMEOUT :  'hlsLoadTimeOut',
  // Identifier for a level switch error - data: { level : faulty level Id, event : error description}
  LEVEL_ERROR :  'hlsLevelError',
  // Identifier for a fragment parsing error event - data: parsing error description
  FRAG_PARSING_ERROR :  'hlsFragmentParsingError',
    // Identifier for a fragment appending error event - data: appending error description
  FRAG_APPENDING_ERROR :  'hlsFragmentAppendingError'
};
