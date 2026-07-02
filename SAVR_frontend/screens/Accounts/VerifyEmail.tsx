import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ActivityIndicator, ImageBackground, Dimensions, Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ApiService } from '../../services/api';
import { StorageUtils, StorageKeys } from '../../utils/storage';

const { width, height } = Dimensions.get('window');

const COLORS = {
  yellow: '#f4b942',
  orange: '#c96a2e',
};

export default function VerifyEmail({ route, navigation }: any) {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [isTimerActive, setIsTimerActive] = useState(true);

  const timerRef = useRef<any>(null);

  const params = route.params || {};
  const { email, name, registrationType } = params;

  useEffect(() => {
    startTimer();
    return () => stopTimer();
  }, []);

  const startTimer = () => {
    setIsTimerActive(true);
    setTimeLeft(60);
    stopTimer();
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          stopTimer();
          setIsTimerActive(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const formatTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const handleVerify = async () => {
    if (code.length !== 6) {
      Alert.alert('Error', 'Please enter the 6-digit code');
      return;
    }

    setIsLoading(true);
    try {
      // Step 1: Verify code
      const verifyRes = await ApiService.verifyCode({ email, code });

      if (!verifyRes.data.success) {
        Alert.alert('Error', verifyRes.data.message || 'Invalid code. Please try again.');
        setIsLoading(false);
        return;
      }

      // Step 2: Register
      let registerRes;
      if (registrationType === 'donor') {
        registerRes = await ApiService.registerDonor(params);
      } else if (registrationType === 'organization') {
        registerRes = await ApiService.registerOrganization(params);
      } else if (registrationType === 'partner_kitchen') {
        registerRes = await ApiService.registerPartnerKitchen(params);
      } else if (registrationType === 'beneficiary') {
        registerRes = await ApiService.registerBeneficiary(params);
      } else {
        throw new Error('Unknown registration type: ' + registrationType);
      }

      if (registerRes.data.success) {
        stopTimer();

        Alert.alert('Success', 'Account created successfully!');

        if (registrationType === 'beneficiary') {
          navigation.reset({
            index: 0,
            routes: [{ name: 'Login' }]
          });
        } else {
          navigation.reset({
            index: 0,
            routes: [{ name: 'Login' }]
          });
        }
      } else {
        const errorValues = Object.values(registerRes.data.errors || {})[0];
        // @ts-ignore
        const errorMessage = (errorValues && errorValues[0]) || registerRes.data.message || 'Registration failed';
        Alert.alert('Error', errorMessage);
      }
    } catch (e: any) {
      console.log('Verify Validation Error:', e.response?.data);
      const errors = e.response?.data?.errors;
      let specificError = null;
      if (errors && Object.values(errors).length > 0) {
        specificError = (Object.values(errors)[0] as string[])[0];
      }
      Alert.alert('Error', specificError || e.response?.data?.message || 'Connection error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setIsLoading(true);
    try {
      const response = await ApiService.resendCode({ email, name });
      if (response.data.success) {
        Alert.alert('Success', `New code sent to ${email}`);
        startTimer();
      } else {
        Alert.alert('Error', response.data.message || 'Failed to resend code.');
      }
    } catch (e: any) {
      Alert.alert('Error', 'Connection error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ImageBackground
      source={require('../../assets/images/backgrounds/register_bg.png')}
      style={styles.background}
      resizeMode="cover"
    >
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.container}
        >
          <View style={styles.logoContainer}>
            <Image
              source={require('../../assets/images/logo/logowhite.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <View style={styles.glassCard}>
            <View style={styles.titleRow}>
              <Text style={styles.titleWhite}>Verify </Text>
              <Text style={styles.titleYellow}>Email</Text>
            </View>

            <Text style={styles.subtitle}>
              We sent a 6-digit verification code to:{"\n"}
              <Text style={{ fontWeight: 'bold', color: COLORS.yellow }}>{email}</Text>
            </Text>

            <TextInput
              style={[styles.input, styles.codeInput]}
              placeholder="000000"
              placeholderTextColor="rgba(255,255,255,0.35)"
              keyboardType="number-pad"
              maxLength={6}
              value={code}
              onChangeText={setCode}
              selectionColor={COLORS.yellow}
            />

            <View style={[styles.footer, { marginTop: 10, marginBottom: 20, minHeight: 25 }]}>
              <Text style={styles.footerText}>Didn't receive the email? </Text>
              <TouchableOpacity onPress={handleResend} disabled={isTimerActive}>
                <Text style={[styles.resendText, isTimerActive && styles.resendTextDisabled]}>
                  Resend Code {isTimerActive && `(${formatTime(timeLeft)})`}
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, isLoading && styles.btnDisabled]}
              onPress={handleVerify}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              {isLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>Verify Email</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.loginLinkContainer}
              onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Login' }] })}
            >
              <Text style={styles.loginLinkText}>Go to Login</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

        <TouchableOpacity
          style={styles.backGlobalButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={32} color="#FFF" />
        </TouchableOpacity>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: width * 0.08,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 22,
    marginTop: height * 0.02,
  },
  logo: {
    width: 280,
    height: 90,
  },
  glassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 32,
    paddingHorizontal: 25,
    paddingTop: 30,
    paddingBottom: 30,
    borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.35)',
    overflow: 'hidden',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleWhite: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: -0.5,
  },
  titleYellow: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.yellow,
    letterSpacing: -0.5,
  },
  subtitle: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.92)',
    marginBottom: 28,
    fontSize: 14,
    lineHeight: 22,
  },
  input: {
    borderBottomWidth: 1.2,
    borderBottomColor: 'rgba(255,255,255,0.85)',
    color: '#FFF',
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: 'transparent',
  },
  codeInput: {
    textAlign: 'center',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 12,
    height: 60,
    marginBottom: 15,
  },
  timerContainer: {
    alignItems: 'center',
    marginBottom: 25,
    marginTop: 5,
  },
  timerText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
  },
  timerExpiredText: {
    fontSize: 14,
    color: '#ff6b6b',
    fontWeight: 'bold',
  },
  primaryBtn: {
    backgroundColor: 'rgba(201, 106, 46, 0.92)',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 24,
  },
  btnDisabled: {
    backgroundColor: 'rgba(201, 106, 46, 0.5)',
    shadowOpacity: 0,
  },
  primaryBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center'
  },
  footerText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
  },
  resendText: {
    color: COLORS.yellow,
    fontSize: 14,
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
  resendTextDisabled: {
    color: 'rgba(255,255,255,0.4)',
    textDecorationLine: 'none',
  },
  backGlobalButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    left: 20,
    padding: 10,
    zIndex: 10,
  },
  loginLinkContainer: {
    alignItems: 'center',
    marginTop: 5,
  },
  loginLinkText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
});
