import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { api } from './api';

// Remote push notifications are not supported in Expo Go (SDK 53+).
// Guard all notification setup so the app doesn't error in Expo Go.
const isExpoGo = Constants.appOwnership === 'expo';

if (!isExpoGo) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

export async function registerForPushNotifications() {
  if (isExpoGo || !Device.isDevice) return;

  try {
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId;

    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;

    await api.post('/push-token', { token });
  } catch (e) {
    console.warn('[pushNotifications] registration skipped:', e?.message);
  }
}

export async function clearPushToken() {
  try {
    await api.post('/push-token/clear');
  } catch (e) {
    console.warn('[pushNotifications] clearPushToken failed:', e?.message);
  }
}
