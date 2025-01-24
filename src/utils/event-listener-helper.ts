export function addEventListener(
  el: HTMLElement,
  type: string,
  listener: EventListenerOrEventListenerObject,
) {
  removeEventListener(el, type, listener);
  el.addEventListener(type, listener);
}

export function removeEventListener(
  el: HTMLElement,
  type: string,
  listener: EventListenerOrEventListenerObject,
) {
  el.removeEventListener(type, listener);
}
