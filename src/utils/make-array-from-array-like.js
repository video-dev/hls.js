export const makeArrayFromArrayLike = typeof Array.from === 'function' ? Array.from : Array.prototype.slice.call;
