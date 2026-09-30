import React, {useRef, useState} from 'react';
import {
  type HostInstance,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {theme} from '../constants';
import {MoreIcon} from './icons';

export interface MenuItem {
  label: string;
  /** Shown in red, for actions like Delete. */
  destructive?: boolean;
  onPress: () => void;
}

interface Props {
  items: MenuItem[];
  accessibilityLabel?: string;
  /** Shown faded, and taps do nothing. */
  disabled?: boolean;
}

/** A ⋯ button that drops a small menu of actions down beneath it. */
export function MoreMenu({
  items,
  accessibilityLabel = 'More actions',
  disabled = false,
}: Props) {
  const {width} = useWindowDimensions();
  const button = useRef<HostInstance>(null);
  // Where the menu hangs (window coordinates); null while it is closed.
  const [anchor, setAnchor] = useState<{top: number; right: number} | null>(
    null,
  );
  // The chosen action runs once the menu has gone: iOS will not show an alert
  // over a modal that is still closing.
  const pending = useRef<(() => void) | null>(null);

  const open = () => {
    button.current?.measureInWindow((x, y, w, h) =>
      setAnchor({top: y + h + 4, right: width - x - w}),
    );
  };

  const runPending = () => {
    const run = pending.current;
    pending.current = null;
    run?.();
  };

  const choose = (item: MenuItem) => {
    pending.current = item.onPress;
    setAnchor(null);
    if (Platform.OS !== 'ios') {
      runPending();
    }
  };

  return (
    <>
      <Pressable
        ref={button}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{disabled}}
        disabled={disabled}
        onPress={open}
        hitSlop={8}
        style={({pressed}) => [
          styles.button,
          (pressed || disabled) && styles.pressed,
        ]}>
        <MoreIcon size={24} color={theme.ink} />
      </Pressable>
      <Modal
        visible={anchor !== null}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => setAnchor(null)}
        onDismiss={runPending}>
        <Pressable
          accessibilityLabel="Close menu"
          onPress={() => setAnchor(null)}
          style={StyleSheet.absoluteFill}
        />
        {anchor ? (
          <View style={[styles.menu, anchor]}>
            {items.map(item => (
              <Pressable
                key={item.label}
                accessibilityRole="menuitem"
                onPress={() => choose(item)}
                style={({pressed}) => [styles.item, pressed && styles.itemPressed]}>
                <Text
                  style={[styles.label, item.destructive && styles.destructive]}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {padding: 4},
  pressed: {opacity: 0.35},
  menu: {
    position: 'absolute',
    minWidth: 160,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: theme.surface,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 4},
    elevation: 8,
  },
  item: {paddingHorizontal: 16, paddingVertical: 12},
  itemPressed: {backgroundColor: theme.line},
  label: {fontSize: 16, color: theme.ink},
  destructive: {color: theme.danger},
});
