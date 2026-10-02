import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {Alert} from 'react-native';
import {AddItemSheet} from '../components/AddItemSheet';
import {AddPantsModal} from '../components/AddPantsModal';
import {AddShirtModal} from '../components/AddShirtModal';
import type {GarmentDraft} from '../components/AddGarmentModal';
import {GuidedCamera} from '../components/GuidedCamera';
import {DEFAULT_BODY_TYPE, KIND_LABELS, MAX_PER_KIND} from '../constants';
import {pickPhoto} from '../hooks/pickPhoto';
import {navigationRef} from '../navigationRef';
import {useWardrobe} from '../hooks/useWardrobe';
import {loadSettings, saveSettings} from '../storage/settingsStorage';
import type {BodyType, Garment, GarmentKind} from '../types';

type Wardrobe = ReturnType<typeof useWardrobe>;

interface WardrobeContextValue {
  wardrobe: Wardrobe;
  /** Which Library tab is showing. */
  libraryTab: GarmentKind;
  setLibraryTab: (kind: GarmentKind) => void;
  /**
   * Starts the add flow: choose shirt/pants, photograph it with the guided
   * camera (or pick a photo), add the item. Pass a kind to skip the
   * shirt/pants chooser.
   */
  startAdd: (kind?: GarmentKind) => void;
  /** Puts a garment on the Outfit figure and shows the Outfit screen. */
  wear: (garment: Garment) => void;
  /** The garment `wear` asked for, until the Outfit screen has put it on. */
  wearRequest: Garment | null;
  clearWearRequest: () => void;
  /** The avatar's body type (Avatar Settings), which the models are cut for. */
  bodyType: BodyType;
  setBodyType: (body: BodyType) => void;
  /** The saved wardrobe and settings have both loaded. */
  loaded: boolean;
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
  const [bodyType, setBody] = useState<BodyType>(DEFAULT_BODY_TYPE);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [libraryTab, setLibraryTab] = useState<GarmentKind>('shirt');
  const [wearRequest, setWearRequest] = useState<Garment | null>(null);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [cameraKind, setCameraKind] = useState<GarmentKind | null>(null);
  const [draft, setDraft] = useState<{kind: GarmentKind; photo: string} | null>(
    null,
  );

  useEffect(() => {
    loadSettings()
      .then(settings => setBody(settings.bodyType))
      .finally(() => setSettingsLoaded(true));
  }, []);

  const setBodyType = useCallback((body: BodyType) => {
    setBody(body);
    saveSettings({bodyType: body}).catch(e =>
      console.warn('Could not save the settings', e),
    );
  }, []);

  const loaded = wardrobe.loaded && settingsLoaded;

  const pickFromLibrary = useCallback(async (kind: GarmentKind) => {
    try {
      const photo = await pickPhoto('library');
      if (photo) {
        setDraft({kind, photo});
      }
    } catch (e) {
      Alert.alert('Could not add photo', errorMessage(e));
    }
  }, []);

  // Let a modal finish dismissing before the next one (or a system dialog)
  // appears.
  const afterModal = (action: () => void) => setTimeout(action, 400);

  const choose = (kind: GarmentKind) => {
    setChooserOpen(false);
    afterModal(() => setCameraKind(kind));
  };

  const retake = () => {
    if (draft) {
      const {kind} = draft;
      setDraft(null);
      afterModal(() => setCameraKind(kind));
    }
  };

  const captured = (photo: string) => {
    if (cameraKind) {
      const kind = cameraKind;
      setCameraKind(null);
      afterModal(() => setDraft({kind, photo}));
    }
  };

  const libraryInstead = () => {
    if (cameraKind) {
      const kind = cameraKind;
      setCameraKind(null);
      afterModal(() => pickFromLibrary(kind));
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
      setCameraKind(kind);
    }
  };

  const wear = useCallback((garment: Garment) => {
    setWearRequest(garment);
    if (navigationRef.isReady()) {
      navigationRef.navigate('Outfit' as never);
    }
  }, []);

  const clearWearRequest = useCallback(() => setWearRequest(null), []);

  const value = useMemo(
    () => ({
      wardrobe,
      libraryTab,
      setLibraryTab,
      startAdd,
      wear,
      wearRequest,
      clearWearRequest,
      bodyType,
      setBodyType,
      loaded,
    }),
    // startAdd only reads the latest wardrobe, which is already a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      wardrobe,
      libraryTab,
      wear,
      wearRequest,
      clearWearRequest,
      bodyType,
      setBodyType,
      loaded,
    ],
  );

  const modalProps = (kind: GarmentKind) => ({
    body: bodyType,
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
      <GuidedCamera
        kind={cameraKind}
        body={bodyType}
        onCapture={captured}
        onLibrary={libraryInstead}
        onCancel={() => setCameraKind(null)}
      />
      <AddShirtModal {...modalProps('shirt')} />
      <AddPantsModal {...modalProps('pants')} />
    </WardrobeContext.Provider>
  );
}
