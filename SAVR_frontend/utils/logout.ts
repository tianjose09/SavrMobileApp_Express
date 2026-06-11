import { StorageUtils, StorageKeys } from './storage';
import { api } from '../services/api';
import { clearPushToken } from '../services/pushNotifications';

export const LogoutHelper = {
  async logout(navigation: any): Promise<void> {
    try {
      // 1. Get token
      const token = await StorageUtils.getItem(StorageKeys.AUTH_TOKEN);
      
      // 2. Clear local session immediately
      await StorageUtils.clearAuth();
      
      // 3. Navigate to Login (resetting stack)
      navigation.reset({
        index: 1,
        routes: [{ name: 'LandingPage' }, { name: 'Login' }],
      });
      
      // 4. Clear push token + API logout in background
      if (token) {
        clearPushToken().catch(() => {});
        api.post('/api/logout', null, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => {
          // Silent - local logout already completed
        });
      }
    } catch (e) {
      console.error('Logout error', e);
      // Fallback navigation
      navigation.reset({
        index: 1,
        routes: [{ name: 'LandingPage' }, { name: 'Login' }],
      });
    }
  }
};
