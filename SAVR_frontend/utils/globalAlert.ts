import { Alert } from 'react-native';

export type AlertButton = {
  text?: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

export type AlertOptions = {
  cancelable?: boolean;
  onDismiss?: () => void;
};

export type AlertConfig = {
  title: string;
  message?: string;
  buttons?: AlertButton[];
  options?: AlertOptions;
};

type AlertListener = (config: AlertConfig | null) => void;

let alertListener: AlertListener | null = null;
const pendingAlerts: AlertConfig[] = [];

export const setAlertListener = (listener: AlertListener | null) => {
  alertListener = listener;
  // If there are pending alerts that were requested before listener registration
  if (listener && pendingAlerts.length > 0) {
    const nextAlert = pendingAlerts.shift();
    if (nextAlert) {
      listener(nextAlert);
    }
  }
};

export const customAlert = (
  title: string,
  message?: string,
  buttons?: AlertButton[],
  options?: AlertOptions
) => {
  const config: AlertConfig = { title, message, buttons, options };
  if (alertListener) {
    alertListener(config);
  } else {
    pendingAlerts.push(config);
  }
};

// Backup of native Alert.alert in case we need it
export const nativeAlert = Alert.alert;

// Apply monkey patch
Alert.alert = customAlert;
