import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert, Linking, ActivityIndicator, SafeAreaView, Image, AppState, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
      const response = await ApiService.createPaymongoCheckout({ amount: amountNum, remarks: message });
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
          <Image source={require('../../assets/images/logo/logobrown.png')} style={styles.logoImage} resizeMode="contain" />
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
              style={{ width: 40, height: 40, marginRight: 10 }}
              resizeMode="contain"
            />
            <Text style={styles.pageTitle}>Financial Donation</Text>
          </View>

          {/* Amount Card */}
          <View style={styles.greenCard}>
            <View style={styles.amountInputWrapper}>
              <Text style={styles.currencySymbol}>₱</Text>
              <TextInput
                style={[styles.amountInput, { fontSize: amount ? 48 : 20, textAlign: 'center' }]}
                value={amount}
                onChangeText={handleAmountChange}
                keyboardType="decimal-pad"
                selectionColor="#FFF"
                placeholder="Enter amount to donate"
                placeholderTextColor="rgba(255,255,255,0.7)"
              />
            </View>

            <View style={styles.cardDivider} />

            <View style={styles.dateTimeRow}>
              <Text style={styles.dateTimeText}>Date : {getTodayDate()}</Text>
              <Text style={styles.dateTimeText}>Time : {getCurrentTime()}</Text>
            </View>

            <Text style={styles.messageLabel}>Name of Drive</Text>
            <TextInput
              style={styles.messageInput}
              placeholder="e.g. Kapatiran Fire Tondo Relief"
              placeholderTextColor="#B0CFBC"
              value={message}
              onChangeText={setMessage}
              multiline
            />
          </View>

          {/* Payment Method */}
          <Text style={styles.paymentMethodTitle}>Payment Method</Text>
          <View style={styles.secureMethodCard}>
            <Ionicons name="shield-checkmark" size={28} color="#A75D20" style={{ marginBottom: 8 }} />
            <Text style={styles.secureMethodTitle}>Secured via PayMongo</Text>
            <Text style={styles.secureMethodDesc}>Accepts GCash, Maya, Credit & Debit Cards</Text>
            <View style={styles.badgesRow}>
              <View style={styles.miniBadge}><Text style={styles.miniBadgeText}>GCash</Text></View>
              <View style={styles.miniBadge}><Text style={styles.miniBadgeText}>Maya</Text></View>
              <View style={styles.miniBadge}><Text style={styles.miniBadgeText}>Visa/MC</Text></View>
            </View>
          </View>

          <View style={styles.spacer} />

          {/* Proceed Button */}
          <TouchableOpacity
            style={[styles.donateButton, isLoading && { backgroundColor: '#A7C2B2' }]}
            onPress={handleDonate}
            disabled={isLoading}
          >
            {isLoading ? <ActivityIndicator color="#fff" /> : (
              <Text style={styles.donateBtnText}>Proceed details via PayMongo</Text>
            )}
          </TouchableOpacity>

          {paymentLinkOpened && pendingDonationId ? (
            <TouchableOpacity
              style={[styles.checkPaymentButton, isCheckingPayment && { opacity: 0.6 }]}
              onPress={handleManualCheck}
              disabled={isCheckingPayment}
            >
              {isCheckingPayment ? <ActivityIndicator color="#00592d" size="small" /> : (
                <>
                  <Ionicons name="refresh-circle-outline" size={18} color="#00592d" style={{ marginRight: 6 }} />
                  <Text style={styles.checkPaymentText}>Check Payment Status</Text>
                </>
              )}
            </TouchableOpacity>
          ) : null}

          <View style={{ height: 50 }} />
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
  logoImage: {
    width: 170,
    height: 58,
    marginBottom: 6,
  },

  scrollContent: { paddingHorizontal: 22, paddingTop: 15 },

  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20, marginTop: 20 },
  pageTitle: { fontSize: 27, fontWeight: '800', color: '#00592d', letterSpacing: -0.5 },

  greenCard: {
    backgroundColor: '#00592d',
    borderRadius: 24,
    paddingHorizontal: 25,
    paddingTop: 35,
    paddingBottom: 35,
    marginBottom: 35,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  amountInputWrapper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  currencySymbol: { fontSize: 42, fontWeight: '700', color: '#FFFFFF', marginRight: 8, marginTop: -5 },
  amountInput: { fontSize: 48, fontWeight: '700', color: '#FFFFFF', minWidth: 50 },
  cardDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.5)', marginHorizontal: 15, marginBottom: 20 },
  dateTimeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25, paddingHorizontal: 5 },
  dateTimeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '400' },
  messageLabel: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  messageInput: {
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    borderRadius: 16,
    height: 80,
    paddingHorizontal: 15,
    paddingTop: 15,
    color: '#FFFFFF',
    fontSize: 13,
    textAlignVertical: 'top',
  },

  paymentMethodTitle: { fontSize: 26, fontWeight: '700', color: '#00592d', marginBottom: 20, paddingHorizontal: 8 },

  secureMethodCard: {
    backgroundColor: '#Faf6F2',
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#A75D20',
    marginHorizontal: 5,
    marginBottom: 35,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  secureMethodTitle: { fontSize: 16, fontWeight: '700', color: '#A75D20', marginBottom: 2 },
  secureMethodDesc: { fontSize: 12, color: '#6A6A6A', textAlign: 'center', fontWeight: '700', marginBottom: 15 },
  badgesRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  miniBadge: { backgroundColor: '#FFF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: '#E1E9E4', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  miniBadgeText: { fontSize: 10, fontWeight: '700', color: '#222' },

  spacer: { flex: 1, minHeight: 10 },

  donateButton: {
    backgroundColor: '#00592d',
    height: 55,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 15,
    shadowColor: '#000',
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
