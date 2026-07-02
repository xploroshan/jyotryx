module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: [
      // reanimated's plugin MUST be listed last.
      'react-native-reanimated/plugin',
    ],
  };
};
