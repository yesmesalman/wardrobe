import React, {useState} from 'react';
import {FlatList, StyleSheet, Text, useWindowDimensions, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {GarmentCard} from '../components/GarmentCard';
import {GarmentViewerModal} from '../components/GarmentViewerModal';
import {ScreenHeader} from '../components/ScreenHeader';
import {SegmentedControl} from '../components/SegmentedControl';
import {KIND_LABELS, theme} from '../constants';
import {useWardrobeContext} from '../state/WardrobeContext';
import type {Garment} from '../types';

const COLUMNS = 4;
const SIDE_PADDING = 16;
const GAP = 8;

export function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const {width} = useWindowDimensions();
  const cardWidth = Math.floor(
    (width - SIDE_PADDING * 2 - GAP * (COLUMNS - 1)) / COLUMNS,
  );
  const {
    wardrobe: {garments, loaded, remove},
    libraryTab: tab,
    setLibraryTab: setTab,
  } = useWardrobeContext();
  const [viewing, setViewing] = useState<Garment | null>(null);

  const visible = garments.filter(g => g.kind === tab);
  const labels = KIND_LABELS[tab];

  return (
    <View style={[styles.root, {paddingTop: insets.top}]}>
      <ScreenHeader title="Library" subtitle="Your wardrobe" />

      <View style={styles.tabs}>
        <SegmentedControl
          value={tab}
          onChange={setTab}
          options={(['shirt', 'pants'] as const).map(kind => ({
            value: kind,
            label: KIND_LABELS[kind].plural,
          }))}
        />
      </View>

      <FlatList
        data={visible}
        keyExtractor={g => g.id}
        numColumns={COLUMNS}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        renderItem={({item}) => (
          <GarmentCard garment={item} width={cardWidth} onPress={setViewing} />
        )}
        ListEmptyComponent={
          loaded ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>
                No {labels.plural.toLowerCase()} yet
              </Text>
              <Text style={styles.emptyText}>
                Tap “Add item” at the top right to photograph one and see it in 3D.
              </Text>
            </View>
          ) : undefined
        }
      />

      <GarmentViewerModal
        garment={viewing}
        onClose={() => setViewing(null)}
        onDelete={remove}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: theme.background},
  tabs: {paddingHorizontal: 20, paddingBottom: 16},
  list: {paddingHorizontal: SIDE_PADDING, paddingBottom: 24, gap: GAP},
  row: {gap: GAP},
  empty: {alignItems: 'center', paddingTop: 80, paddingHorizontal: 40},
  emptyTitle: {fontSize: 18, fontWeight: '700', color: theme.ink},
  emptyText: {
    fontSize: 15,
    color: theme.muted,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 21,
  },
});
