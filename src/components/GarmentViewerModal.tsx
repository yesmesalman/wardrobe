import React, {useEffect, useState} from 'react';
import {Alert, Modal, Pressable, StyleSheet, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {theme, VARIANT_LABELS} from '../constants';
import {readFileBase64} from '../storage/wardrobeStorage';
import type {Garment} from '../types';
import {GarmentView, Photo} from './GarmentView';

interface Props {
  garment: Garment | null;
  onClose: () => void;
  onDelete: (garment: Garment) => void;
}

export function GarmentViewerModal({garment, onClose, onDelete}: Props) {
  const insets = useSafeAreaInsets();
  const [photo, setPhoto] = useState<Photo | null>(null);

  // The image lives in a file; read it when a garment is opened. Fit mode
  // shows the cut-out (PNG), print mode the photo (JPEG).
  useEffect(() => {
    setPhoto(null);
    if (!garment) {
      return;
    }
    let cancelled = false;
    const fit = garment.mode === 'fit' && garment.cutoutFile;
    readFileBase64(fit ? garment.cutoutFile! : garment.photoFile).then(
      base64 =>
        !cancelled &&
        setPhoto({base64, mime: fit ? 'image/png' : 'image/jpeg'}),
      () => !cancelled && setPhoto(null),
    );
    return () => {
      cancelled = true;
    };
  }, [garment]);

  const confirmDelete = () => {
    if (!garment) {
      return;
    }
    Alert.alert(
      `Delete this ${VARIANT_LABELS[garment.variant].toLowerCase()}?`,
      'It will be removed from your library.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            onDelete(garment);
            onClose();
          },
        },
      ],
    );
  };

  return (
    <Modal
      visible={garment !== null}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={onClose}>
      <View style={[styles.root, {paddingTop: insets.top}]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.action}>Done</Text>
          </Pressable>
          <Text style={styles.title}>
            {garment ? VARIANT_LABELS[garment.variant] : ''}
          </Text>
          <Pressable onPress={confirmDelete} hitSlop={12}>
            <Text style={[styles.action, styles.danger]}>Delete</Text>
          </Pressable>
        </View>
        {garment ? (
          <GarmentView
            key={garment.id}
            variant={garment.variant}
            color={garment.color}
            photo={photo}
            mode={garment.mode}
            align={garment.align}
            style={styles.scene}
          />
        ) : null}
        <Text style={[styles.hint, {paddingBottom: insets.bottom + 16}]}>
          Drag to spin 360°
        </Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: theme.background},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  title: {fontSize: 17, fontWeight: '700', color: theme.ink},
  action: {fontSize: 16, color: theme.accent, fontWeight: '500'},
  danger: {color: theme.danger},
  scene: {flex: 1, marginHorizontal: 16, borderRadius: 24},
  hint: {
    textAlign: 'center',
    color: theme.muted,
    fontSize: 13,
    paddingTop: 12,
  },
});
