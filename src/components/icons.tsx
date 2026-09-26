import React from 'react';
import Svg, {Circle, Line, Path, Rect} from 'react-native-svg';

interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

/** Outline icons drawn on a 24x24 grid. */
function Icon({
  size = 24,
  color = '#000',
  strokeWidth = 1.7,
  children,
}: IconProps & {children: React.ReactNode}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {React.Children.map(children, child =>
        React.isValidElement(child)
          ? React.cloneElement(child as React.ReactElement<any>, {
              stroke: color,
              strokeWidth,
              strokeLinejoin: 'round',
              strokeLinecap: 'round',
            })
          : child,
      )}
    </Svg>
  );
}

export const ShirtIcon = (props: IconProps) => (
  <Icon {...props}>
    <Path d="M9 3 L3 6.5 L5.2 10.4 L7.5 9.2 V20.5 H16.5 V9.2 L18.8 10.4 L21 6.5 L15 3 C14.6 4.7 13.4 5.6 12 5.6 C10.6 5.6 9.4 4.7 9 3 Z" />
  </Icon>
);

export const PantsIcon = (props: IconProps) => (
  <Icon {...props}>
    <Path d="M7 3 H17 L18.4 20.5 H13.4 L12 9.5 L10.6 20.5 H5.6 Z" />
    <Path d="M7.2 6.5 H16.8" />
  </Icon>
);

export const OutfitIcon = (props: IconProps) => (
  <Icon {...props}>
    <Path d="M12 8.6 V7.4 A2 2 0 1 0 10 5.4" />
    <Path d="M12 8.6 L3.2 15.1 A1.3 1.3 0 0 0 4 17.5 H20 A1.3 1.3 0 0 0 20.8 15.1 Z" />
  </Icon>
);

export const LibraryIcon = (props: IconProps) => (
  <Icon {...props}>
    <Rect x="4" y="4" width="7" height="7" rx="1.6" />
    <Rect x="13" y="4" width="7" height="7" rx="1.6" />
    <Rect x="4" y="13" width="7" height="7" rx="1.6" />
    <Rect x="13" y="13" width="7" height="7" rx="1.6" />
  </Icon>
);

export const CloseIcon = (props: IconProps) => (
  <Icon {...props}>
    <Path d="M6 6 L18 18" />
    <Path d="M18 6 L6 18" />
  </Icon>
);

export const PlusIcon = (props: IconProps) => (
  <Icon {...props}>
    <Path d="M12 5 V19" />
    <Path d="M5 12 H19" />
  </Icon>
);

export const TrendingIcon = (props: IconProps) => (
  <Icon {...props}>
    <Path d="M3 17 L9 11 L13 15 L21 7" />
    <Path d="M15 7 H21 V13" />
  </Icon>
);

const GEAR_TEETH = Array.from({length: 8}, (_, i) => {
  const a = (i * Math.PI) / 4;
  return {
    x1: 12 + Math.cos(a) * 7,
    y1: 12 + Math.sin(a) * 7,
    x2: 12 + Math.cos(a) * 9.4,
    y2: 12 + Math.sin(a) * 9.4,
  };
});

export const SettingsIcon = (props: IconProps) => (
  <Icon {...props}>
    <Circle cx="12" cy="12" r="6.6" />
    <Circle cx="12" cy="12" r="2.4" />
    {GEAR_TEETH.map((t, i) => (
      <Line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} />
    ))}
  </Icon>
);
