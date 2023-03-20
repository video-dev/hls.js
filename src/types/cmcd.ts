/**
 * CMCD spec version
 */
export const CMCDVersion = 1;

/**
 * CMCD Object Type
 */
export const enum CMCDObjectType {
  MANIFEST = 'm',
  AUDIO = 'a',
  VIDEO = 'v',
  MUXED = 'av',
  INIT = 'i',
  CAPTION = 'c',
  TIMED_TEXT = 'tt',
  KEY = 'k',
  OTHER = 'o',
}

/**
 * CMCD Streaming Format
 */
export const CMCDStreamingFormatHLS = 'h';

/**
 * CMCD Streaming Type
 */
const enum CMCDStreamType {
  VOD = 'v',
  LIVE = 'l',
}

/**
 * CMCD Headers
 */
export interface CMCDHeaders {
  'CMCD-Object': string;
  'CMCD-Request': string;
  'CMCD-Session': string;
  'CMCD-Status': string;
}

/**
 * CMCD
 */
export interface CMCD {
  /////////////////
  // CMCD Object //
  /////////////////

  /**
   * Encoded bitrate
   *
   * The encoded bitrate of the audio or video object being requested. This may not be known precisely by the player; however,
   * it MAY be estimated based upon playlist/manifest declarations. If the playlist declares both peak and average bitrate values,
   * the peak value should be transmitted.
   *
   * Integer kbps
   */
  br?: number;

  /**
   * Object duration
   *
   * The playback duration in milliseconds of the object being requested. If a partial segment is being requested, then this value
   * MUST indicate the playback duration of that part and not that of its parent segment. This value can be an approximation of the
   * estimated duration if the explicit value is not known.
   *
   * Integer milliseconds
   */
  d?: number;

  /**
   * Object type
   *
   * The media type of the current object being requested:
   * - `m` = text file, such as a manifest or playlist
   * - `a` = audio only
   * - `v` = video only
   * - `av` = muxed audio and video
   * - `i` = init segment
   * - `c` = caption or subtitle
   * - `tt` = ISOBMFF timed text track
   * - `k` = cryptographic key, license or certificate.
   * - `o` = other
   *
   * If the object type being requested is unknown, then this key MUST NOT be used.
   */
  ot?: CMCDObjectType;

  /**
   * Top bitrate
   *
   * The highest bitrate rendition in the manifest or playlist that the client is allowed to play, given current codec, licensing and
   * sizing constraints.
   *
   * Integer Kbps
   */
  tb?: number;

  //////////////////
  // CMCD Request //
  //////////////////
  /**
   * Buffer length
   *
   * The buffer length associated with the media object being requested. This value MUST be rounded to the nearest 100 ms. This key SHOULD only be
   * sent with an object type of ‘a’, ‘v’ or ‘av’.
   *
   * Integer milliseconds
   */
  bl?: number;

  /**
   * Deadline
   *
   * Deadline from the request time until the first sample of this Segment/Object needs to be available in order to not create a buffer underrun or
   * any other playback problems. This value MUST be rounded to the nearest 100ms. For a playback rate of 1, this may be equivalent to the player’s
   * remaining buffer length.
   *
   * Integer milliseconds
   */
  dl?: number;

  /**
   * Measured mtp CMCD throughput
   *
   * The throughput between client and server, as measured by the client and MUST be rounded to the nearest 100 kbps. This value, however derived,
   * SHOULD be the value that the client is using to make its next Adaptive Bitrate switching decision. If the client is connected to multiple
   * servers concurrently, it must take care to report only the throughput measured against the receiving server. If the client has multiple concurrent
   * connections to the server, then the intent is that this value communicates the aggregate throughput the client sees across all those connections.
   *
   * Integer kbps
   */
  mtp?: number;

  /**
   * Next object request
   *
   * Relative path of the next object to be requested. This can be used to trigger pre-fetching by the CDN. This MUST be a path relative to the current
   * request. This string MUST be URLEncoded. The client SHOULD NOT depend upon any pre-fetch action being taken - it is merely a request for such a
   * pre-fetch to take place.
   *
   * String
   */
  nor?: string;

  /**
   * Next range request
   *
   * If the next request will be a partial object request, then this string denotes the byte range to be requested. If the ‘nor’ field is not set, then the
   * object is assumed to match the object currently being requested. The client SHOULD NOT depend upon any pre-fetch action being taken – it is merely a
   * request for such a pre-fetch to take place. Formatting is similar to the HTTP Range header, except that the unit MUST be ‘byte’, the ‘Range:’ prefix is
   * NOT required and specifying multiple ranges is NOT allowed. Valid combinations are:
   *
   * - `"\<range-start\>-"`
   * - `"\<range-start\>-\<range-end\>"`
   * - `"-\<suffix-length\>"`
   *
   * String
   */
  nrr?: string;

  /**
   * Startup
   *
   * Key is included without a value if the object is needed urgently due to startup, seeking or recovery after a buffer-empty event. The media SHOULD not be
   * rendering when this request is made. This key MUST not be sent if it is FALSE.
   *
   * Boolean
   */
  su?: boolean;

  //////////////////
  // CMCD Session //
  //////////////////

  /**
   * Content ID
   *
   * A unique string identifying the current content. Maximum length is 64 characters. This value is consistent across multiple different
   * sessions and devices and is defined and updated at the discretion of the service provider.
   *
   * String
   */
  cid?: string;

  /**
   * Playback rate
   *
   * `1` if real-time, `2` if double speed, `0` if not playing. SHOULD only be sent if not equal to `1`.
   *
   * Decimal
   */
  pr?: number;

  /**
   * Streaming format
   *
   * The streaming format that defines the current request.
   *
   * - `d` = MPEG DASH
   * - `h` = HTTP Live Streaming (HLS)
   * - `s` = Smooth Streaming
   * - `o` = other
   *
   * If the streaming format being requested is unknown, then this key MUST NOT be used.
   */
  sf?: typeof CMCDStreamingFormatHLS;

  /**
   * Session ID
   *
   * A GUID identifying the current playback session. A playback session typically ties together segments belonging to a single media asset.
   * Maximum length is 64 characters. It is RECOMMENDED to conform to the UUID specification.
   *
   * String
   */
  sid?: string;

  /**
   * Stream type
   * - `v` = all segments are available – e.g., VOD
   * - `l` = segments become available over time – e.g., LIVE
   */
  st?: CMCDStreamType;

  /**
   * CMCD version
   *
   * The version of this specification used for interpreting the defined key names and values. If this key is omitted, the client and server MUST
   * interpret the values as being defined by version 1. Client SHOULD omit this field if the version is 1.
   *
   * Integer
   */
  v?: number;

  /////////////////
  // CMCD Status //
  /////////////////

  /**
   * Buffer starvation
   *
   * Key is included without a value if the buffer was starved at some point between the prior request and this object request,
   * resulting in the player being in a rebuffering state and the video or audio playback being stalled. This key MUST NOT be
   * sent if the buffer was not starved since the prior request.
   *
   * If the object type `ot` key is sent along with this key, then the `bs` key refers to the buffer associated with the particular
   * object type. If no object type is communicated, then the buffer state applies to the current session.
   *
   * Boolean
   */
  bs?: boolean;

  /**
   * Requested maximum throughput
   *
   * The requested maximum throughput that the client considers sufficient for delivery of the asset. Values MUST be rounded to the
   * nearest 100kbps. For example, a client would indicate that the current segment, encoded at 2Mbps, is to be delivered at no more
   * than 10Mbps, by using rtp=10000.
   *
   * Note: This can benefit clients by preventing buffer saturation through over-delivery and can also deliver a community benefit
   * through fair-share delivery. The concept is that each client receives the throughput necessary for great performance, but no more.
   * The CDN may not support the rtp feature.
   *
   * Integer kbps
   */
  rtp?: number;
}
