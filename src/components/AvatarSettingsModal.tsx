import React, {useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {BODY_TYPES, theme} from '../constants';
import type {BodyType} from '../types';
import {SegmentedControl} from './SegmentedControl';

interface Props {
  visible: boolean;
  onClose: () => void;
  bodyType: BodyType;
  onBodyTypeChange: (body: BodyType) => void;
  /** Deletes all data; resolves once it is gone. */
  onReset: () => Promise<void>;
}

/**
 * The avatar's settings: the body type the garments are shown on. Changing
 * it removes all data, after confirming.
 */
export function AvatarSettingsModal({
  visible,
  onClose,
  bodyType,
  onBodyTypeChange,
  onReset,
}: Props) {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);

  const change = async (body: BodyType) => {
    setBusy(true);
    try {
      await onReset();
      onBodyTypeChange(body);
    } catch (e) {
      Alert.alert(
        'Could not change body type',
        e instanceof Error ? e.message : 'Something went wrong.',
      );
    } finally {
      setBusy(false);
    }
  };

  const confirmChange = (body: BodyType) => {
    if (body === bodyType || busy) {
      return;
    }
    Alert.alert(
      'Change body type?',
      'Changing the body type will remove all your data: every shirt and pair of pants in your library, with their photos. This cannot be undone.',
      [
        {text: 'Cancel', style: 'cancel'},
        {text: 'Change', style: 'destructive', onPress: () => change(body)},
      ],
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <View style={[styles.root, {paddingBottom: insets.bottom + 16}]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12} disabled={busy}>
            <Text style={styles.action}>Done</Text>
          </Pressable>
          <Text style={styles.title}>Avatar Settings</Text>
          <View style={styles.headerSpacer} />
        </View>
        <Text style={styles.sectionLabel}>Body Type</Text>
        <SegmentedControl
          value={bodyType}
          onChange={confirmChange}
          options={BODY_TYPES}
        />
        <Text style={styles.body}>
          Your shirts and pants are shown on this body type in the Outfit and
          the Library. Changing it removes all your data.
        </Text>
        {busy ? (
          <ActivityIndicator style={styles.busy} color={theme.muted} />
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: theme.background, paddingHorizontal: 20},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
  },
  headerSpacer: {width: 40},
  title: {fontSize: 17, fontWeight: '700', color: theme.ink},
  action: {fontSize: 16, color: theme.accent, fontWeight: '500'},
  sectionLabel: {
    marginTop: 8,
    marginBottom: 10,
    fontSize: 13,
    fontWeight: '600',
    color: theme.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  body: {fontSize: 14, lineHeight: 20, color: theme.muted, marginTop: 12},
  busy: {marginTop: 20},
});
