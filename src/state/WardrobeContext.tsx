import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import {Alert} from 'react-native';
import {AddItemSheet} from '../components/AddItemSheet';
import {AddPantsModal} from '../components/AddPantsModal';
import {AddShirtModal} from '../components/AddShirtModal';
import type {GarmentDraft} from '../components/AddGarmentModal';
import {KIND_LABELS, MAX_PER_KIND} from '../constants';
import {PhotoSource, pickPhoto} from '../hooks/pickPhoto';
import {navigationRef} from '../navigationRef';
import {useWardrobe} from '../hooks/useWardrobe';
import type {GarmentKind} from '../types';

type Wardrobe = ReturnType<typeof useWardrobe>;

interface WardrobeContextValue {
  wardrobe: Wardrobe;
  /** Which Library tab is showing. */
  libraryTab: GarmentKind;
  setLibraryTab: (kind: GarmentKind) => void;
  /**
   * Starts the add flow: choose shirt/pants, pick a photo, add the item.
   * Pass a kind to skip the shirt/pants chooser.
   */
  startAdd: (kind?: GarmentKind) => void;
}

const WardrobeContext = createContext<WardrobeContextValue | null>(null);

export function useWardrobeContext(): WardrobeContextValue {
  const value = useContext(WardrobeContext);
  if (!value) {
    throw new Error('useWardrobeContext must be used inside WardrobeProvider');
  }
  return value;
}

const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : 'Something went wrong.';

/**
 * Holds the wardrobe and runs the add flow, so the Add Item button can live
 * on any screen.
 */
export function WardrobeProvider({children}: {children: ReactNode}) {
  const wardrobe = useWardrobe();
  const [libraryTab, setLibraryTab] = useState<GarmentKind>('shirt');
  const [chooserOpen, setChooserOpen] = useState(false);
  const [draft, setDraft] = useState<{kind: GarmentKind; photo: string} | null>(
    null,
  );

  const capture = useCallback(async (kind: GarmentKind, source: PhotoSource) => {
    try {
      const photo = await pickPhoto(source);
      if (photo) {
        setDraft({kind, photo});
      }
    } catch (e) {
      Alert.alert('Could not add photo', errorMessage(e));
    }
  }, []);

  const chooseSource = useCallback(
    (kind: GarmentKind) => {
      Alert.alert(
        `Add ${KIND_LABELS[kind].singular.toLowerCase()}`,
        'Photograph it or pick a photo.',
        [
          {text: 'Take photo', onPress: () => capture(kind, 'camera')},
          {text: 'Choose from library', onPress: () => capture(kind, 'library')},
          {text: 'Cancel', style: 'cancel'},
        ],
      );
    },
    [capture],
  );

  // Let a modal finish dismissing before the next system dialog appears.
  const afterModal = (action: () => void) => setTimeout(action, 400);

  const choose = (kind: GarmentKind) => {
    setChooserOpen(false);
    afterModal(() => chooseSource(kind));
  };

  const retake = () => {
    if (draft) {
      const {kind} = draft;
      setDraft(null);
      afterModal(() => chooseSource(kind));
    }
  };

  const save = async (result: GarmentDraft) => {
    if (!draft) {
      return;
    }
    await wardrobe.add({...result, mode: 'fit', photoBase64: draft.photo});
    setDraft(null);
    setLibraryTab(result.kind);
    if (navigationRef.isReady()) {
      navigationRef.navigate('Library' as never);
    }
  };

  const startAdd = (kind?: GarmentKind) => {
    if (!kind) {
      setChooserOpen(true);
    } else if (wardrobe.isFull(kind)) {
      Alert.alert(
        'Library is full',
        `You can keep up to ${MAX_PER_KIND} ${KIND_LABELS[kind].plural.toLowerCase()}.`,
      );
    } else {
      chooseSource(kind);
    }
  };

  const value = useMemo(
    () => ({wardrobe, libraryTab, setLibraryTab, startAdd}),
    // startAdd only reads the latest wardrobe, which is already a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [wardrobe, libraryTab],
  );

  const modalProps = (kind: GarmentKind) => ({
    photoBase64: draft?.kind === kind ? draft.photo : null,
    full: wardrobe.isFull(kind),
    onSave: save,
    onRetake: retake,
    onCancel: () => setDraft(null),
  });

  return (
    <WardrobeContext.Provider value={value}>
      {children}
      <AddItemSheet
        visible={chooserOpen}
        counts={wardrobe.counts}
        onChoose={choose}
        onClose={() => setChooserOpen(false)}
      />
      <AddShirtModal {...modalProps('shirt')} />
      <AddPantsModal {...modalProps('pants')} />
    </WardrobeContext.Provider>
  );
}
