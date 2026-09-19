import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {theme} from '../constants';

interface Option<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

interface Props<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: Props<T>) {
  return (
    <View style={styles.track}>
      {options.map(option => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{selected, disabled: option.disabled}}
            disabled={option.disabled}
            onPress={() => onChange(option.value)}
            style={[styles.segment, selected && styles.segmentSelected]}>
            <Text
              style={[
                styles.label,
                selected && styles.labelSelected,
                option.disabled && styles.labelDisabled,
              ]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: '#E9E4DB',
    borderRadius: 14,
    padding: 3,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 11,
  },
  segmentSelected: {
    backgroundColor: theme.surface,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: {width: 0, height: 1},
    elevation: 1,
  },
  label: {fontSize: 15, fontWeight: '600', color: theme.muted},
  labelSelected: {color: theme.ink},
  labelDisabled: {opacity: 0.45},
});
