/* eslint-env jest */
// Native-only view libraries: render their children as plain views in tests.
jest.mock('react-native-svg', () => {
  const React = require('react');
  const {View} = require('react-native');
  const passthrough = name => {
    const Component = ({children}) => React.createElement(View, {testID: name}, children);
    Component.displayName = name;
    return Component;
  };
  return {
    __esModule: true,
    default: passthrough('Svg'),
    Svg: passthrough('Svg'),
    Path: passthrough('Path'),
    Rect: passthrough('Rect'),
    Circle: passthrough('Circle'),
    Line: passthrough('Line'),
  };
});

// Ships untranspiled TypeScript and needs a native module; no buzzing in tests.
jest.mock('react-native-haptic-feedback', () => ({trigger: jest.fn()}));

// The launch screen is native; its JS hand-off never animates away in tests.
jest.mock('react-native-bootsplash', () => ({
  __esModule: true,
  default: {
    hide: jest.fn(() => Promise.resolve()),
    isVisible: jest.fn(() => false),
    useHideAnimation: jest.fn(() => ({
      container: {},
      logo: {source: 0},
      brand: {source: 0},
    })),
  },
}));

// The camera is native: no device and no permission in tests.
jest.mock('react-native-vision-camera', () => ({
  Camera: () => null,
  useCameraDevice: jest.fn(() => undefined),
  useCameraPermission: jest.fn(() => ({
    hasPermission: false,
    canRequestPermission: false,
    requestPermission: jest.fn(() => Promise.resolve(false)),
  })),
  usePhotoOutput: jest.fn(() => ({capturePhoto: jest.fn()})),
}));
