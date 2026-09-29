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
import {theme} from '../constants';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Deletes all data; resolves once it is gone. */
  onReset: () => Promise<void>;
}

/** Lets the user erase the whole wardrobe, after confirming. */
export function ResetDataModal({visible, onClose, onReset}: Props) {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);

  const reset = async () => {
    setBusy(true);
    try {
      await onReset();
      onClose();
      Alert.alert('Data reset', 'All your shirts and pants have been removed.');
    } catch (e) {
      Alert.alert(
        'Could not reset data',
        e instanceof Error ? e.message : 'Something went wrong.',
      );
    } finally {
      setBusy(false);
    }
  };

  const confirmReset = () => {
    Alert.alert(
      'Reset complete data?',
      'All your shirts and pants, with their photos, will be permanently deleted. This cannot be undone.',
      [
        {text: 'Cancel', style: 'cancel'},
        {text: 'Reset', style: 'destructive', onPress: reset},
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
          <Text style={styles.title}>Reset Data</Text>
          <View style={styles.headerSpacer} />
        </View>
        <Text style={styles.body}>
          Remove everything stored in the app: every shirt and pair of pants in
          your library, with their photos. The app will be as it was when you
          first opened it.
        </Text>
        <Pressable
          onPress={confirmReset}
          disabled={busy}
          style={({pressed}) => [styles.button, pressed && styles.pressed]}>
          {busy ? (
            <ActivityIndicator color={theme.accentText} />
          ) : (
            <Text style={styles.buttonText}>Reset Complete Data</Text>
          )}
        </Pressable>
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
  body: {fontSize: 15, lineHeight: 21, color: theme.muted, marginTop: 8},
  button: {
    marginTop: 28,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.danger,
  },
  pressed: {opacity: 0.8},
  buttonText: {fontSize: 16, fontWeight: '700', color: theme.accentText},
});
