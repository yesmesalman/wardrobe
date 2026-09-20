import React, {useState} from 'react';
import {Alert, FlatList, Pressable, StyleSheet, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {AddGarmentModal, GarmentDraft} from '../components/AddGarmentModal';
import {GarmentCard} from '../components/GarmentCard';
import {GarmentViewerModal} from '../components/GarmentViewerModal';
import {SegmentedControl} from '../components/SegmentedControl';
import {KIND_LABELS, MAX_PER_KIND, theme} from '../constants';
import {PhotoSource, pickPhoto} from '../hooks/pickPhoto';
import {useWardrobe} from '../hooks/useWardrobe';
import type {Garment, GarmentKind} from '../types';

const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : 'Something went wrong.';

export function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const {garments, loaded, counts, isFull, add, remove} = useWardrobe();
  const [tab, setTab] = useState<GarmentKind>('shirt');
  const [viewing, setViewing] = useState<Garment | null>(null);
  const [draftPhoto, setDraftPhoto] = useState<string | null>(null);

  const visible = garments.filter(g => g.kind === tab);
  const labels = KIND_LABELS[tab];

  const capture = async (source: PhotoSource) => {
    try {
      const photo = await pickPhoto(source);
      if (photo) {
        setDraftPhoto(photo);
      }
    } catch (e) {
      Alert.alert('Could not add photo', errorMessage(e));
    }
  };

  const choosePhotoSource = () => {
    Alert.alert(`Add ${labels.singular.toLowerCase()}`, 'Photograph it or pick a photo.', [
      {text: 'Take photo', onPress: () => capture('camera')},
      {text: 'Choose from library', onPress: () => capture('library')},
      {text: 'Cancel', style: 'cancel'},
    ]);
  };

  const startAdd = () => {
    if (isFull(tab)) {
      Alert.alert(
        'Library is full',
        `You can keep up to ${MAX_PER_KIND} ${labels.plural.toLowerCase()}. Delete one to add another.`,
      );
      return;
    }
    choosePhotoSource();
  };

  const retake = () => {
    setDraftPhoto(null);
    // Let the modal finish dismissing before the next system dialog appears.
    setTimeout(choosePhotoSource, 400);
  };

  const save = async (draft: GarmentDraft) => {
    if (!draftPhoto) {
      return;
    }
    await add({...draft, photoBase64: draftPhoto});
    setDraftPhoto(null);
    setTab(draft.kind);
  };

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
        contentContainerStyle={[
          styles.list,
          {paddingBottom: insets.bottom + 110},
        ]}
        // Every card owns a GL context, so only keep the visible ones mounted.
        initialNumToRender={4}
        windowSize={2}
        renderItem={({item}) => <GarmentCard garment={item} onPress={setViewing} />}
        ListEmptyComponent={
          loaded ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>
                No {labels.plural.toLowerCase()} yet
              </Text>
              <Text style={styles.emptyText}>
                Tap “Add {labels.singular.toLowerCase()}” to photograph one and
                see it in 3D.
              </Text>
            </View>
          ) : undefined
        }
      />

      <View style={[styles.fabWrap, {bottom: insets.bottom + 20}]}>
        <Pressable
          accessibilityRole="button"
          onPress={startAdd}
          style={[styles.fab, isFull(tab) && styles.fabDisabled]}>
          <Text style={styles.fabText}>
            {isFull(tab)
              ? `${labels.plural} full`
              : `+  Add ${labels.singular.toLowerCase()}`}
          </Text>
        </Pressable>
      </View>

      <GarmentViewerModal
        garment={viewing}
        onClose={() => setViewing(null)}
        onDelete={remove}
      />
      <AddGarmentModal
        photoBase64={draftPhoto}
        initialKind={tab}
        isFull={isFull}
        onSave={save}
        onRetake={retake}
        onCancel={() => setDraftPhoto(null)}
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
  fabWrap: {position: 'absolute', left: 0, right: 0, alignItems: 'center'},
  fab: {
    backgroundColor: theme.accent,
    paddingHorizontal: 28,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: {width: 0, height: 4},
    elevation: 4,
  },
  fabDisabled: {opacity: 0.55},
  fabText: {color: theme.accentText, fontSize: 17, fontWeight: '700'},
});
