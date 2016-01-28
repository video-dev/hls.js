/**
 * Max Level Capping Modes
 */
module.exports = {
  /** max capped level should be the one with the dimensions equal or greater than the stage dimensions (so the video will be downscaled) **/
  DOWNSCALE: 'downscale',
  /** max capped level should be the one with the dimensions equal or lower than the stage dimensions (so the video will be upscaled) **/
  UPSCALE: 'upscale',
};
