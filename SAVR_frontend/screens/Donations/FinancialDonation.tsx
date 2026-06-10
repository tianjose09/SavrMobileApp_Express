import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert, Linking, ActivityIndicator, SafeAreaView, Image, AppState, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { ApiService } from '../../services/api';
import ToastBanner from '../../components/ToastBanner';
import NotificationBell from '../../components/NotificationBell';

export default function FinancialDonation({ navigation }: any) {
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);
  const [pendingDonationId, setPendingDonationId] = useState<number | null>(null);
  const [paymentLinkOpened, setPaymentLinkOpened] = useState(false);
  const [toast, setToast] = useState({ visible: false, title: '', message: '' });

  const appStateRef = useRef(AppState.currentState);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  const handlePaymentConfirmed = (confirmedAmount: string) => {
    stopPolling();
    setPendingDonationId(null);
    setPaymentLinkOpened(false);
    const donatedAmt = parseFloat(confirmedAmount).toLocaleString('en-US');
    setToast({
      visible: true,
      title: 'Donation Confirmed!',
      message: `You successfully donated ₱${donatedAmt}. Thank you for your generosity!`,
    });
    setTimeout(() => navigation.navigate('Home'), 4500);
  };

  const checkOnce = async (donationId: number): Promise<boolean> => {
    try {
      const res = await ApiService.checkPaymentStatus(donationId);
      if (res?.data?.status === 'paid') {
        handlePaymentConfirmed(res.data.amount);
        return true;
      }
    } catch { }
    return false;
  };

  const startPolling = (donationId: number) => {
    stopPolling();
    let attempts = 0;
    const MAX_ATTEMPTS = 60;
    pollIntervalRef.current = setInterval(async () => {
      attempts++;
      const paid = await checkOnce(donationId);
      if (paid || attempts >= MAX_ATTEMPTS) stopPolling();
    }, 5000);
  };

  useEffect(() => {
    if (!pendingDonationId) return;

    startPolling(pendingDonationId);

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        checkOnce(pendingDonationId).then(paid => {
          if (!paid) startPolling(pendingDonationId);
        });
      }
      appStateRef.current = nextState;
    });

    return () => {
      stopPolling();
      subscription.remove();
    };
  }, [pendingDonationId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { stopPolling(); };
  }, []);

  const handleManualCheck = async () => {
    if (!pendingDonationId) return;
    setIsCheckingPayment(true);
    const paid = await checkOnce(pendingDonationId);
    if (!paid) {
      Alert.alert(
        'Not Yet Confirmed',
        'Payment not confirmed yet. Please complete it in the browser and try again.'
      );
    }
    setIsCheckingPayment(false);
  };

  const handleDonate = async () => {
    const amountNum = parseFloat(amount.replace(/,/g, ''));
    if (!amountNum || amountNum <= 0) {
      Alert.alert('Error', 'Please enter a valid amount.');
      return;
    }

    setIsLoading(true);

    try {
      const isExpoGo = Constants.appOwnership === 'expo';
      const response = await ApiService.createPaymongoCheckout({
        amount: amountNum,
        remarks: message,
        is_expo_go: isExpoGo,
      });
      if (response.data.success && response.data.checkout_url) {
        const donationId = response.data.donation_id;
        if (donationId) setPendingDonationId(donationId);
        setAmount('');
        setMessage('');
        setPaymentLinkOpened(true);
        Linking.openURL(response.data.checkout_url);
        Alert.alert(
          'Payment Page Opened',
          'Complete your payment in the browser. Your dashboard will update automatically when you return.',
          [{ text: 'Got it' }]
        );
      } else {
        Alert.alert('Error', 'Failed to generate payment link.');
      }
    } catch (e: any) {
      const errors = e.response?.data?.errors;
      let specificError = null;
      if (errors && Object.values(errors).length > 0) {
        specificError = (Object.values(errors)[0] as string[])[0];
      }
      Alert.alert('Error', specificError || e.response?.data?.message || 'Connection error.');
    } finally {
      setIsLoading(false);
    }
  };

  const getTodayDate = () => {
    const options: any = { month: 'long', day: 'numeric', year: 'numeric' };
    return new Date().toLocaleDateString('en-US', options);
  };

  const getCurrentTime = () => {
    const options: any = { hour: 'numeric', minute: 'numeric', hour12: true };
    return new Date().toLocaleTimeString('en-US', options);
  };

  const handleAmountChange = (text: string) => {
    const numericValue = text.replace(/[^0-9]/g, '');
    if (numericValue) {
      setAmount(Number(numericValue).toLocaleString('en-US'));
    } else {
      setAmount('');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />
      <ToastBanner
        visible={toast.visible}
        title={toast.title}
        message={toast.message}
        type="success"
        onHide={() => setToast(t => ({ ...t, visible: false }))}
      />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>

        {/* TOP BAR HEADER */}
        <View style={styles.topHeader}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={30} color="#00592d" />
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <NotificationBell navigation={navigation} color="#544434" size={28} style={{ marginRight: 5 }} />
            <TouchableOpacity onPress={() => navigation.openDrawer?.()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="menu-outline" size={32} color="#544434" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

          {/* Title */}
          <View style={styles.titleRow}>
            <Image
              source={require('../../assets/images/cards/financialdonationicongreen.png')}
              style={{ width: 55, height: 55, marginRight: 10, tintColor: '#000000' }}
              resizeMode="contain"
            />
            <Text style={styles.pageTitle}>Financial Donation</Text>
          </View>

          {/* Green Card */}
          <View style={styles.greenCard}>

            {/* Select Amount */}
            <Text style={styles.sectionLabel}>Select Amount</Text>
            <View style={styles.amountGrid}>
              {[500, 1000, 2000, 5000].map((preset) => (
                <TouchableOpacity
                  key={preset}
                  style={[
                    styles.presetBtn,
                    amount === preset.toLocaleString('en-US') && styles.presetBtnActive
                  ]}
                  onPress={() => setAmount(preset.toLocaleString('en-US'))}
                  activeOpacity={0.8}
                >
                  <Text style={[
                    styles.presetBtnText,
                    amount === preset.toLocaleString('en-US') && styles.presetBtnTextActive
                  ]}>
                    ₱ {preset.toLocaleString('en-US')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Custom Amount */}
            <Text style={styles.sectionLabel}>Or enter custom amount (₱)</Text>
            <View style={styles.customAmountBox}>
              <Text style={styles.pesoPrefix}>₱</Text>
              <TextInput
                style={styles.customAmountInput}
                value={amount}
                onChangeText={handleAmountChange}
                keyboardType="decimal-pad"
                selectionColor="#FFF"
                placeholder="0.00"
                placeholderTextColor="rgba(255,255,255,0.5)"
              />
            </View>

            {/* Payment Method */}
            <Text style={styles.sectionLabel}>Payment Method</Text>
            <View style={styles.paymentMethodCard}>
              <View style={styles.paymentMethodLeft}>
                <View style={styles.paymentMethodIcon}>
                  <Ionicons name="card-outline" size={24} color="#FFF" />
                </View>
                <View>
                  <Text style={styles.paymentMethodName}>PayMongo</Text>
                  <Text style={styles.paymentMethodSub}>GCash, Maya, Cards</Text>
                </View>
              </View>
              <Ionicons name="checkmark-circle-outline" size={24} color="#FFF" />
            </View>

            {/* Description / Extra Notes */}
            <Text style={styles.sectionLabel}>
              Service Description / Extra Notes <Text style={{ fontWeight: '400' }}>(optional)</Text>
            </Text>
            <View style={{ position: 'relative' }}>
              <TextInput
                style={styles.notesInput}
                placeholder="Leave a message for the food bank..."
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={message}
                onChangeText={setMessage}
                multiline
                numberOfLines={4}
              />
              <View style={styles.resizeGrip}>
                <View style={styles.gripLine1} />
                <View style={styles.gripLine2} />
              </View>
            </View>
          </View>

          <View style={styles.spacer} />

          {/* Button Row */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => navigation.goBack()}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.donateButton, isLoading && { backgroundColor: '#A7C2B2' }]}
              onPress={handleDonate}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? <ActivityIndicator color="#fff" /> : (
                <Text style={styles.donateBtnText}>Submit</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Extra bottom spacing for Android navigation bar overlap prevention */}
          <View style={{ height: 120 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },

  topHeader: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
    elevation: 5,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoImage: {
    width: 170,
    height: 58,
    marginBottom: 6,
  },

  scrollContent: { paddingHorizontal: 22, paddingBottom: 60, paddingTop: 15 },

  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20, marginTop: 20 },
  pageTitle: { fontSize: 27, fontWeight: '800', color: '#000000', letterSpacing: -0.5 },

  greenCard: {
    backgroundColor: '#00592d',
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 25,
    paddingBottom: 30,
    marginBottom: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },

  sectionLabel: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
    marginTop: 15,
  },

  amountGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 18,
    gap: 10,
  },
  presetBtn: {
    width: '48%',
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
    backgroundColor: 'rgba(255,255,255,0.22)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  presetBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.38)',
    borderColor: '#FFFFFF',
  },
  presetBtnText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  presetBtnTextActive: {
    color: '#FFF',
  },

  customAmountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.22)',
    height: 52,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  pesoPrefix: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
    marginRight: 8,
  },
  customAmountInput: {
    flex: 1,
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },

  paymentMethodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 20,
  },
  paymentMethodLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentMethodIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  paymentMethodName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  paymentMethodSub: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },

  notesInput: {
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.22)',
    minHeight: 120,
    paddingHorizontal: 16,
    paddingTop: 14,
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    textAlignVertical: 'top',
  },
  resizeGrip: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 12,
    height: 12,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    opacity: 0.5,
  },
  gripLine1: {
    width: 10,
    height: 1.5,
    backgroundColor: '#FFF',
    transform: [{ rotate: '-45deg' }],
    marginBottom: 2,
  },
  gripLine2: {
    width: 6,
    height: 1.5,
    backgroundColor: '#FFF',
    transform: [{ rotate: '-45deg' }],
  },

  spacer: { flex: 1, minHeight: 10 },

  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginHorizontal: 15,
    marginTop: 10,
    marginBottom: 10,
  },
  cancelBtn: {
    width: 90,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#CCCCCC',
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cancelBtnText: {
    color: '#777777',
    fontSize: 16,
    fontWeight: '700',
  },
  donateButton: {
    backgroundColor: '#CA6F2E',
    width: 130,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#CA6F2E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 4,
  },
  donateBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700', letterSpacing: -0.2 },

  checkPaymentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    marginHorizontal: 15,
    height: 48,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#00592d',
    backgroundColor: '#FFFFFF',
  },
  checkPaymentText: { color: '#00592d', fontSize: 13, fontWeight: '700', letterSpacing: -0.2 },
});
