import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert, Linking, ActivityIndicator, SafeAreaView, Image, AppState } from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { ApiService } from '../../services/api';
import ToastBanner from '../../components/ToastBanner';

export default function FinancialDonation({ navigation }: any) {
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingDonationId, setPendingDonationId] = useState<number | null>(null);
  const [toast, setToast] = useState({ visible: false, title: '', message: '' });
  const appStateRef = useRef(AppState.currentState);

  const pollPaymentStatus = async (donationId: number, attemptsLeft = 4) => {
    if (attemptsLeft <= 0) return;
    try {
      const res = await ApiService.checkPaymentStatus(donationId);
      if (res?.data?.status === 'paid') {
        setPendingDonationId(null);
        const donatedAmt = parseFloat(res.data.amount).toLocaleString('en-US');
        setToast({
          visible: true,
          title: 'Donation Confirmed!',
          message: `You successfully donated ₱${donatedAmt}. Thank you for your generosity!`,
        });
        setTimeout(() => navigation.navigate('Home'), 4500);
        return;
      }
      // Still pending — retry after 3 seconds
      setTimeout(() => pollPaymentStatus(donationId, attemptsLeft - 1), 3000);
    } catch {}
  };

  useEffect(() => {
    if (!pendingDonationId) return;

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        pollPaymentStatus(pendingDonationId);
      }
      appStateRef.current = nextState;
    });

    return () => subscription.remove();
  }, [pendingDonationId]);

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
        Linking.openURL(response.data.checkout_url);
        Alert.alert(
          'Payment Page Opened ✅',
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

  // Replaces numeric input with formatted numbers on the fly
  const handleAmountChange = (text: string) => {
    const numericValue = text.replace(/[^0-9]/g, '');
    if (numericValue) {
      const formatted = Number(numericValue).toLocaleString('en-US');
      setAmount(formatted);
    } else {
      setAmount('');
    }
  };

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

        {/* Top Header */}
        <View style={styles.topHeader}>
          <View style={styles.headerRow}>
            {/* Logo Image - Brown Version */}
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

          {/* Title Row */}
          <View style={styles.titleRow}>
            <Image
              source={require('../../assets/images/cards/financialdonationicongreen.png')}
              style={{ width: 40, height: 40, marginRight: 10 }}
              resizeMode="contain"
            />
            <Text style={styles.pageTitle}>Financial Donation</Text>
          </View>

          {/* Green Card Block */}
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

            <Text style={styles.messageLabel}>Message <Text style={styles.optionalText}>(Optional)</Text></Text>
            <TextInput
              style={styles.messageInput}
              placeholder="Add a message with your donation..."
              placeholderTextColor="#B0CFBC"
              value={message}
              onChangeText={setMessage}
              multiline
            />
          </View>

          {/* Payment Method Title */}
          <Text style={styles.paymentMethodTitle}>Payment Method</Text>


          {/* Secure Payment Context - Solely PayMongo */}
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

          {/* Spacer */}
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

          <View style={{ height: 50 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },

  topHeader: {
    paddingHorizontal: 20,
    paddingTop: 10,
    backgroundColor: '#FFFFFF',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  headerIcons: { flexDirection: 'row', alignItems: 'center' },
  headerDivider: { height: 1, backgroundColor: '#E0E0E0', marginHorizontal: -20, marginBottom: 5 },

  scrollContent: { paddingHorizontal: 22, paddingTop: 15 },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    marginTop: 20,
  },
  pageTitle: {
    fontSize: 27,
    fontWeight: '800',
    color: '#00592d',
    letterSpacing: -0.5,
  },

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
  amountInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  currencySymbol: {
    fontSize: 42,
    fontWeight: '700',
    color: '#FFFFFF',
    marginRight: 8,
    marginTop: -5,
  },
  amountInput: {
    fontSize: 48,
    fontWeight: '700',
    color: '#FFFFFF',
    minWidth: 50,
  },
  cardDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.5)',
    marginHorizontal: 15,
    marginBottom: 20,
  },
  dateTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 25,
    paddingHorizontal: 5,
  },
  dateTimeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '400',
  },
  messageLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  optionalText: {
    fontWeight: '400',
    fontSize: 14,
  },
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

  paymentMethodTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#00592d',
    marginBottom: 20,
    paddingHorizontal: 8,
  },


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
  badgesRow: { flexDirection: 'row', gap: 10 },
  miniBadge: { backgroundColor: '#FFF', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: '#E1E9E4', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  miniBadgeText: { fontSize: 10, fontWeight: '700', color: '#222' },

  spacer: {
    flex: 1,
    minHeight: 10,
  },

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
  donateBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.2
  }
});
