import {
  DocumentDirectoryPath,
  exists,
  readFile,
  writeFile,
} from '@dr.pogodin/react-native-fs';
import {DEFAULT_BODY_TYPE} from '../constants';
import type {BodyType} from '../types';

/** The app's preferences. Reset Data leaves them alone. */
export interface Settings {
  bodyType: BodyType;
}

export const DEFAULT_SETTINGS: Settings = {bodyType: DEFAULT_BODY_TYPE};

const settingsPath = () => `${DocumentDirectoryPath}/settings.json`;

export async function loadSettings(): Promise<Settings> {
  try {
    if (!(await exists(settingsPath()))) {
      return DEFAULT_SETTINGS;
    }
    const parsed = JSON.parse(await readFile(settingsPath(), 'utf8'));
    return {
      bodyType: parsed?.bodyType === 'woman' ? 'woman' : 'man',
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  await writeFile(settingsPath(), JSON.stringify(settings), 'utf8');
}
