import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './navigation/AppNavigator';
import { StatusBar } from 'expo-status-bar';
import './utils/globalAlert'; // Import to override Alert.alert globally
import GlobalAlertModal from './components/GlobalAlertModal';

export default function App() {
  return (
    <SafeAreaProvider>
      <AppNavigator />
      <GlobalAlertModal />
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
