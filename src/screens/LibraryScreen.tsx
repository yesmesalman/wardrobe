import React, {useState} from 'react';
import {FlatList, StyleSheet, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {AddItemFab, FAB_CLEARANCE} from '../components/AddItemFab';
import {GarmentCard} from '../components/GarmentCard';
import {GarmentViewerModal} from '../components/GarmentViewerModal';
import {SegmentedControl} from '../components/SegmentedControl';
import {KIND_LABELS, MAX_PER_KIND, theme} from '../constants';
import {useWardrobeContext} from '../state/WardrobeContext';
import type {Garment} from '../types';

export function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const {
    wardrobe: {garments, loaded, counts, remove},
    libraryTab: tab,
    setLibraryTab: setTab,
  } = useWardrobeContext();
  const [viewing, setViewing] = useState<Garment | null>(null);

  const visible = garments.filter(g => g.kind === tab);
  const labels = KIND_LABELS[tab];

  return (
    <View style={[styles.root, {paddingTop: insets.top}]}>
      <View style={styles.header}>
        <Text style={styles.title}>Library</Text>
        <Text style={styles.subtitle}>Your wardrobe in 3D</Text>
      </View>

      <View style={styles.tabs}>
        <SegmentedControl
          value={tab}
          onChange={setTab}
          options={(['shirt', 'pants'] as const).map(kind => ({
            value: kind,
            label: `${KIND_LABELS[kind].plural} ${counts[kind]}/${MAX_PER_KIND}`,
          }))}
        />
      </View>

      <FlatList
        data={visible}
        keyExtractor={g => g.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={[styles.list, {paddingBottom: FAB_CLEARANCE}]}
        renderItem={({item}) => (
          <GarmentCard garment={item} onPress={setViewing} />
        )}
        ListEmptyComponent={
          loaded ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>
                No {labels.plural.toLowerCase()} yet
              </Text>
              <Text style={styles.emptyText}>
                Tap “Add item” to photograph one and see it in 3D.
              </Text>
            </View>
          ) : undefined
        }
      />

      <AddItemFab />

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
  header: {paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16},
  title: {fontSize: 32, fontWeight: '800', color: theme.ink},
  subtitle: {fontSize: 15, color: theme.muted, marginTop: 2},
  tabs: {paddingHorizontal: 20, paddingBottom: 16},
  list: {paddingHorizontal: 16, gap: 12},
  row: {gap: 12},
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
