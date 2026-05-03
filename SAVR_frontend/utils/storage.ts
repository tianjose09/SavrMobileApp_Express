import AsyncStorage from '@react-native-async-storage/async-storage';

export const StorageKeys = {
  AUTH_TOKEN: 'auth_token',
  USER_ROLE: 'user_role',
  DISPLAY_NAME: 'display_name',
  USER_EMAIL: 'user_email',
  USER_INFO: 'user_info', // Fixes <null> crash on Login
};

export const StorageUtils = {
  async setItem(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (e) {
      console.error(`Error string ${key} in AsyncStorage`, e);
    }
  },

  async getItem(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key);
    } catch (e) {
      console.error(`Error reading ${key} from AsyncStorage`, e);
      return null;
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (e) {
      console.error(`Error removing ${key} from AsyncStorage`, e);
    }
  },

  async clearAuth(): Promise<void> {
    try {
      const keys = [
        StorageKeys.AUTH_TOKEN,
        StorageKeys.USER_ROLE,
        StorageKeys.DISPLAY_NAME,
        StorageKeys.USER_EMAIL,
      ];
      await AsyncStorage.multiRemove(keys);
    } catch (e) {
      console.error('Error clearing auth data from AsyncStorage', e);
    }
  },
};
