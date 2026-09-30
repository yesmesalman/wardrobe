import React, {useEffect, useState} from 'react';
import {
  Alert,
  BackHandler,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {GarmentCard} from '../components/GarmentCard';
import {GarmentViewerModal} from '../components/GarmentViewerModal';
import {CloseIcon} from '../components/icons';
import {MoreMenu} from '../components/MoreMenu';
import {ScreenHeader} from '../components/ScreenHeader';
import {SegmentedControl} from '../components/SegmentedControl';
import {KIND_LABELS, theme, VARIANT_LABELS} from '../constants';
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
    wear,
  } = useWardrobeContext();
  const [viewing, setViewing] = useState<Garment | null>(null);
  // After Select is tapped, taps pick items instead of opening them.
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  const visible = garments.filter(g => g.kind === tab);
  const labels = KIND_LABELS[tab];
  const picked = visible.filter(g => selected.has(g.id));

  const stopSelecting = () => {
    setSelecting(false);
    setSelected(new Set());
  };

  // Picking is per tab: switching tabs starts afresh.
  useEffect(stopSelecting, [tab]);

  // Android's back button ends picking before it leaves the screen.
  useEffect(() => {
    if (!selecting) {
      return;
    }
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      stopSelecting();
      return true;
    });
    return () => sub.remove();
  }, [selecting]);

  const toggle = (garment: Garment) =>
    setSelected(prev => {
      const next = new Set(prev);
      if (!next.delete(garment.id)) {
        next.add(garment.id);
      }
      return next;
    });

  const confirmDelete = () => {
    const items = picked;
    Alert.alert(
      items.length === 1
        ? `Delete this ${VARIANT_LABELS[items[0].variant].toLowerCase()}?`
        : `Delete ${items.length} ${labels.plural.toLowerCase()}?`,
      items.length === 1
        ? 'It will be removed from your library.'
        : 'They will be removed from your library.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            items.forEach(remove);
            stopSelecting();
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.root, {paddingTop: insets.top}]}>
      <ScreenHeader
        title="Library"
        subtitle={
          !selecting
            ? 'Your wardrobe'
            : picked.length > 0
            ? `${picked.length} selected`
            : 'Select items'
        }
        right={
          selecting ? (
            <View style={styles.selectionActions}>
              <MoreMenu
                disabled={picked.length === 0}
                items={[
                  {label: 'Delete', destructive: true, onPress: confirmDelete},
                ]}
              />
              {/* Where Select was: ends picking. */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel selection"
                onPress={stopSelecting}
                hitSlop={8}
                style={({pressed}) => [
                  styles.closeButton,
                  pressed && styles.pressed,
                ]}>
                <CloseIcon size={22} color={theme.ink} strokeWidth={2} />
              </Pressable>
            </View>
          ) : visible.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setSelecting(true)}
              hitSlop={8}>
              <Text style={styles.headerAction}>Select</Text>
            </Pressable>
          ) : undefined
        }
      />

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
        extraData={[selecting, selected]}
        renderItem={({item}) => (
          <GarmentCard
            garment={item}
            width={cardWidth}
            selecting={selecting}
            selected={selected.has(item.id)}
            onPress={selecting ? toggle : setViewing}
          />
        )}
        ListEmptyComponent={
          loaded ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>
                No {labels.plural.toLowerCase()} yet
              </Text>
              <Text style={styles.emptyText}>
                Tap the + button below to photograph one and see it in 3D.
              </Text>
            </View>
          ) : undefined
        }
      />

      <GarmentViewerModal
        garment={viewing}
        onClose={() => setViewing(null)}
        onDelete={remove}
        onUse={garment => {
          setViewing(null);
          wear(garment);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: theme.background},
  selectionActions: {flexDirection: 'row', alignItems: 'center', gap: 16},
  headerAction: {fontSize: 16, color: theme.accent, fontWeight: '500'},
  closeButton: {padding: 4},
  pressed: {opacity: 0.5},
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
