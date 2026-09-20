const preset = require('@react-native/jest-preset/jest-preset');

module.exports = {
  ...preset,
  // React Navigation ships untranspiled ES modules.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation)/)',
  ],
  setupFiles: [...preset.setupFiles, require.resolve('./jest.setup.js')],
};
