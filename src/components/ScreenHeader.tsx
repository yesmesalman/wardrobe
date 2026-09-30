import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {theme} from '../constants';

interface Props {
  title: string;
  subtitle?: string;
  /** Buttons at the top right, level with the title. */
  right?: React.ReactNode;
}

/** Large title with an optional subtitle. */
export function ScreenHeader({title, subtitle, right}: Props) {
  return (
    <View style={styles.header}>
      <View style={styles.titles}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  titles: {flexShrink: 1},
  title: {fontSize: 32, fontWeight: '800', color: theme.ink},
  subtitle: {fontSize: 15, color: theme.muted, marginTop: 2},
  // As tall as the title's line, so the buttons sit level with it.
  right: {minHeight: 38, justifyContent: 'center'},
});
