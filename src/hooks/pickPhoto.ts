import {
  ImagePickerResponse,
  launchCamera,
  launchImageLibrary,
  Asset,
  CameraOptions,
} from 'react-native-image-picker';

export type PhotoSource = 'camera' | 'library';

/** Longest side, in pixels, of a stored photo (keeps the texture small). */
const MAX_PHOTO_SIZE = 1024;

const OPTIONS: CameraOptions = {
  mediaType: 'photo',
  maxWidth: MAX_PHOTO_SIZE,
  maxHeight: MAX_PHOTO_SIZE,
  quality: 0.8,
  includeBase64: true,
};

/**
 * Opens the camera or photo library. Resolves to the photo as base64 JPEG, or
 * `null` if the user cancelled. Throws an Error with a user-facing message.
 */
export async function pickPhoto(source: PhotoSource): Promise<string | null> {
  const response: ImagePickerResponse =
    source === 'camera'
      ? await launchCamera(OPTIONS)
      : await launchImageLibrary({...OPTIONS, selectionLimit: 1});

  if (response.didCancel) {
    return null;
  }
  if (response.errorCode === 'camera_unavailable') {
    throw new Error('The camera is not available on this device.');
  }
  if (response.errorCode === 'permission') {
    throw new Error(
      'Allow camera and photo access in Settings to add a garment.',
    );
  }
  const asset: Asset | undefined = response.assets?.[0];
  if (response.errorCode || !asset?.base64) {
    throw new Error(response.errorMessage ?? 'Could not read that photo.');
  }
  return asset.base64;
}
