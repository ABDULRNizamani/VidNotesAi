import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEVICE_ID_KEY = 'app:device_id';

let _cachedDeviceId: string | null = null;

/**
 * Returns a stable device ID for this installation.
 * Generated once on first call, then persisted in AsyncStorage.
 * Cached in memory so repeated calls don't hit storage.
 */
export async function getOrCreateDeviceId(): Promise<string> {
  if (_cachedDeviceId) return _cachedDeviceId;

  const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (existing) {
    _cachedDeviceId = existing;
    return existing;
  }

  const newId = Crypto.randomUUID();
  await AsyncStorage.setItem(DEVICE_ID_KEY, newId);
  _cachedDeviceId = newId;
  return newId;
}

/**
 * Clears the in-memory cache (e.g. for testing).
 * Does NOT delete from AsyncStorage — device ID should persist across sessions.
 */
export function clearDeviceIdCache() {
  _cachedDeviceId = null;
}
