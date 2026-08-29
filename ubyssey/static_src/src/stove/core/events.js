// Event listener helper

export function addListener(target, eventName, callback, options) {
  if (!target) return () => {};
  target.addEventListener(eventName, callback, options);
  return () => target.removeEventListener(eventName, callback, options);
}
