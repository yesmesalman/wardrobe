import React, {useEffect, useRef} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {theme} from '../constants';

interface Props {
  /** Current zoom, as a percentage of "same size as the model". */
  percent: number;
  /** Called with the factor to multiply the zoom by (e.g. 1.08 or 1/1.08). */
  onZoom: (factor: number) => void;
}

/** How much one step zooms, and how often a held button repeats. */
export const ZOOM_STEP = 1.08;
const REPEAT_MS = 110;

interface ButtonProps {
  label: string;
  accessibilityLabel: string;
  factor: number;
  onZoom: (factor: number) => void;
}

/** A button that zooms once when pressed and keeps zooming while held. */
function ZoomButton({label, accessibilityLabel, factor, onZoom}: ButtonProps) {
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stop = () => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  };
  useEffect(() => stop, []);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPressIn={() => {
        onZoom(factor);
        stop();
        timer.current = setInterval(() => onZoom(factor), REPEAT_MS);
      }}
      onPressOut={stop}
      style={({pressed}) => [styles.button, pressed && styles.pressed]}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

/** − 100% + : zooms the photo over the model; hold a button to keep going. */
export function ZoomControl({percent, onZoom}: Props) {
  return (
    <View style={styles.row}>
      <ZoomButton
        label="−"
        accessibilityLabel="Zoom out"
        factor={1 / ZOOM_STEP}
        onZoom={onZoom}
      />
      <Text style={styles.percent}>{percent}%</Text>
      <ZoomButton
        label="+"
        accessibilityLabel="Zoom in"
        factor={ZOOM_STEP}
        onZoom={onZoom}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {flexDirection: 'row', alignItems: 'center', gap: 4},
  button: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {backgroundColor: theme.line},
  buttonText: {
    color: theme.accent,
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 26,
  },
  percent: {
    minWidth: 46,
    textAlign: 'center',
    color: theme.ink,
    fontSize: 14,
    fontWeight: '600',
  },
});
