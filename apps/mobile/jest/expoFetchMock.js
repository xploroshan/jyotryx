// expo/fetch relies on Expo's native "winter" runtime, absent under Jest. The
// unit suites never exercise streaming, so map it to a stub that rejects (which
// would trigger the ChatScreen non-streaming fallback anyway).
module.exports = {
  fetch: () => Promise.reject(new Error('expo/fetch is not available in tests')),
};
