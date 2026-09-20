import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {theme} from '../constants';
import {AddItemButton} from './AddItemButton';

interface Props {
  title: string;
  subtitle?: string;
  /** Shows the "Add item" button at the top right. */
  showAdd?: boolean;
}

/** Large title with an optional subtitle and the Add item button on the right. */
export function ScreenHeader({title, subtitle, showAdd = false}: Props) {
  return (
    <View style={styles.header}>
      <View style={styles.titles}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {showAdd ? (
        <View style={styles.action}>
          <AddItemButton />
        </View>
      ) : null}
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
  action: {marginTop: 8, marginLeft: 12},
});
