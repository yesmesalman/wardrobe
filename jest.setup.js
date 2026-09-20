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
