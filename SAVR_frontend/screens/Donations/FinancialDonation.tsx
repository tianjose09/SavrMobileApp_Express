import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert, Linking, ActivityIndicator, SafeAreaView, Image, AppState } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ApiService } from '../../services/api';
import ToastBanner from '../../components/ToastBanner';

type PaymentMethod = 'paymongo' | 'qrph';

export default function FinancialDonation({ navigation }: any) {
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('paymongo');
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);
  const [pendingDonationId, setPendingDonationId] = useState<number | null>(null);
  const [paymentLinkOpened, setPaymentLinkOpened] = useState(false);
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [qrCountdown, setQrCountdown] = useState(0);
  const [toast, setToast] = useState({ visible: false, title: '', message: '' });

  const appStateRef = useRef(AppState.currentState);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const qrTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  const stopQrTimer = () => {
    if (qrTimerRef.current) {
      clearInterval(qrTimerRef.current);
      qrTimerRef.current = null;
    }
  };

  const startQrTimer = (seconds: number) => {
    stopQrTimer();
    setQrCountdown(seconds);
    qrTimerRef.current = setInterval(() => {
      setQrCountdown(prev => {
        if (prev <= 1) {
          stopQrTimer();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handlePaymentConfirmed = (confirmedAmount: string) => {
    stopPolling();
    stopQrTimer();
    setPendingDonationId(null);
    setPaymentLinkOpened(false);
    setQrImageUrl(null);
    setQrCountdown(0);
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
    } catch {}
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

  useEffect(() => {
    return () => { stopQrTimer(); };
  }, []);

  const handleManualCheck = async () => {
    if (!pendingDonationId) return;
    setIsCheckingPayment(true);
    const paid = await checkOnce(pendingDonationId);
    if (!paid) {
      Alert.alert(
        'Not Yet Confirmed',
        selectedMethod === 'qrph'
          ? 'QR payment not detected yet. Make sure you scanned and authorized in your GCash or banking app, then try again.'
          : 'Payment not confirmed yet. Please complete it in the browser and try again.'
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
      if (selectedMethod === 'qrph') {
        const response = await ApiService.createQrPhPayment({ amount: amountNum, message });
        if (response.data.success) {
          const donationId = response.data.donation_id;
          const qrImage = response.data.qr_image;
          const expiresIn = response.data.expires_in || 900;

          if (donationId) setPendingDonationId(donationId);
          if (qrImage) setQrImageUrl(qrImage);
          startQrTimer(expiresIn);
          setPaymentLinkOpened(true);
          setAmount('');
          setMessage('');
        } else {
          Alert.alert('Error', 'Failed to generate QR code.');
        }
      } else {
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

  const isPaymentPending = paymentLinkOpened && !!pendingDonationId;
  const buttonLabel = selectedMethod === 'qrph' ? 'Generate QR Code' : 'Proceed via PayMongo';

  return (
    <SafeAreaView style={styles.container}>
      <ToastBanner
        visible={toast.visible}
        title={toast.title}
        message={toast.message}
        type="success"
        onHide={() => setToast(t => ({ ...t, visible: false }))}
      />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>

        {/* Header */}
        <View style={styles.topHeader}>
          <View style={styles.headerRow}>
            <Image source={require('../../assets/images/logo/logobrown.png')} style={{ width: 170, height: 58 }} resizeMode="contain" />
            <View style={styles.headerIcons}>
              <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={{ marginRight: 15 }} onPress={() => navigation.navigate('Notifications')}>
                <Ionicons name="notifications-outline" size={26} color="#4A4A4A" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.openDrawer?.()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="menu-outline" size={34} color="#4A4A4A" />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.headerDivider} />
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
                editable={!isPaymentPending}
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
              editable={!isPaymentPending}
            />
          </View>

          {/* Payment Method Toggle */}
          <Text style={styles.paymentMethodTitle}>Payment Method</Text>
          <View style={styles.methodToggleRow}>
            <TouchableOpacity
              style={[styles.methodToggleBtn, selectedMethod === 'paymongo' && styles.methodToggleBtnActive]}
              onPress={() => { if (!isPaymentPending) setSelectedMethod('paymongo'); }}
              activeOpacity={0.8}
            >
              <Ionicons name="shield-checkmark" size={20} color={selectedMethod === 'paymongo' ? '#FFF' : '#A75D20'} style={{ marginBottom: 4 }} />
              <Text style={[styles.methodToggleLabel, selectedMethod === 'paymongo' && styles.methodToggleLabelActive]}>PayMongo</Text>
              <Text style={[styles.methodToggleSub, selectedMethod === 'paymongo' && { color: 'rgba(255,255,255,0.8)' }]}>GCash · Maya · Card</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.methodToggleBtn, selectedMethod === 'qrph' && styles.methodToggleBtnActive]}
              onPress={() => { if (!isPaymentPending) setSelectedMethod('qrph'); }}
              activeOpacity={0.8}
            >
              <Ionicons name="qr-code-outline" size={20} color={selectedMethod === 'qrph' ? '#FFF' : '#00592d'} style={{ marginBottom: 4 }} />
              <Text style={[styles.methodToggleLabel, selectedMethod === 'qrph' && styles.methodToggleLabelActive]}>QR Ph</Text>
              <Text style={[styles.methodToggleSub, selectedMethod === 'qrph' && { color: 'rgba(255,255,255,0.8)' }]}>Scan with any bank app</Text>
            </TouchableOpacity>
          </View>

          {/* QR Code Display */}
          {qrImageUrl ? (
            <View style={styles.qrCard}>
              <Text style={styles.qrTitle}>Scan to Pay</Text>
              <Text style={styles.qrSubtitle}>Open your GCash, Maya, or bank app and scan this QR code</Text>
              <View style={styles.qrImageWrapper}>
                <Image
                  source={{ uri: qrImageUrl }}
                  style={styles.qrImage}
                  resizeMode="contain"
                />
              </View>
              {qrCountdown > 0 ? (
                <View style={styles.qrCountdownRow}>
                  <Ionicons name="time-outline" size={14} color={qrCountdown < 120 ? '#C62828' : '#666'} />
                  <Text style={[styles.qrCountdownText, qrCountdown < 120 && { color: '#C62828' }]}>
                    Expires in {formatCountdown(qrCountdown)}
                  </Text>
                </View>
              ) : (
                <Text style={[styles.qrCountdownText, { color: '#C62828' }]}>QR code expired. Generate a new one.</Text>
              )}
            </View>
          ) : null}

          <View style={styles.spacer} />

          {/* Authorize Button */}
          {!isPaymentPending || selectedMethod === 'paymongo' ? (
            <TouchableOpacity
              style={[styles.donateButton, (isLoading || (isPaymentPending && selectedMethod === 'paymongo')) && { backgroundColor: '#A7C2B2' }]}
              onPress={handleDonate}
              disabled={isLoading || (isPaymentPending && selectedMethod === 'paymongo')}
            >
              {isLoading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.donateBtnText}>{isPaymentPending ? 'Awaiting Payment...' : buttonLabel}</Text>
              }
            </TouchableOpacity>
          ) : null}

          {/* QR: regenerate button if expired and pending */}
          {selectedMethod === 'qrph' && isPaymentPending && qrCountdown === 0 ? (
            <TouchableOpacity
              style={styles.donateButton}
              onPress={handleDonate}
              disabled={isLoading}
            >
              {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.donateBtnText}>Regenerate QR Code</Text>}
            </TouchableOpacity>
          ) : null}

          {/* Check Payment Status */}
          {isPaymentPending ? (
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

  topHeader: { paddingHorizontal: 20, paddingTop: 10, backgroundColor: '#FFFFFF' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  headerIcons: { flexDirection: 'row', alignItems: 'center' },
  headerDivider: { height: 1, backgroundColor: '#E0E0E0', marginHorizontal: -20, marginBottom: 5 },

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

  paymentMethodTitle: { fontSize: 26, fontWeight: '700', color: '#00592d', marginBottom: 14, paddingHorizontal: 8 },

  methodToggleRow: { flexDirection: 'row', gap: 12, marginHorizontal: 5, marginBottom: 24 },
  methodToggleBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    backgroundColor: '#FAFAFA',
  },
  methodToggleBtnActive: { backgroundColor: '#00592d', borderColor: '#00592d' },
  methodToggleLabel: { fontSize: 14, fontWeight: '700', color: '#333', marginBottom: 2 },
  methodToggleLabelActive: { color: '#FFF' },
  methodToggleSub: { fontSize: 10, fontWeight: '500', color: '#999', textAlign: 'center' },

  qrCard: {
    backgroundColor: '#F6FBF8',
    borderRadius: 20,
    padding: 22,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#00592d',
    marginHorizontal: 5,
    marginBottom: 24,
  },
  qrTitle: { fontSize: 18, fontWeight: '800', color: '#00592d', marginBottom: 6 },
  qrSubtitle: { fontSize: 12, color: '#666', textAlign: 'center', marginBottom: 18, lineHeight: 18 },
  qrImageWrapper: {
    width: 220,
    height: 220,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    marginBottom: 16,
  },
  qrImage: { width: 200, height: 200 },
  qrCountdownRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  qrCountdownText: { fontSize: 12, fontWeight: '600', color: '#666' },

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
