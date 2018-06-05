'use strict';

const MakeArrayFromArrayLike = typeof Array.from === 'function' ? Array.from : Array.prototype.slice.call;

export default MakeArrayFromArrayLike;
