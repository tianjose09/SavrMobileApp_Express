import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ActivityIndicator, ImageBackground, Dimensions, Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ApiService } from '../../services/api';

const { width, height } = Dimensions.get('window');

const COLORS = {
  yellow: '#f4b942',
  orange: '#c96a2e',
};

export default function ForgotPassword({ navigation }: any) {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // Form State
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Timer State
  const [timeLeft, setTimeLeft] = useState(600);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const timerRef = useRef<any>(null);

  const startTimer = () => {
    setIsTimerActive(true);
    setTimeLeft(600);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setIsTimerActive(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const formatTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const handleSendCode = async () => {
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      Alert.alert('Error', 'Please enter a valid email address.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await ApiService.forgotPassword({ email });
      if (response.data.success) {
        Alert.alert('Success', `Reset code sent to ${email}`);
        setStep(2);
        startTimer();
      } else {
        Alert.alert('Error', response.data.message || 'Failed to send code.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Connection error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (code.length !== 6) {
      Alert.alert('Error', 'Please enter the 6-digit code.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await ApiService.verifyResetCode({ email, code });
      if (response.data.success) {
        if (timerRef.current) clearInterval(timerRef.current);
        setStep(3);
      } else {
        Alert.alert('Error', response.data.message || 'Invalid code.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Connection error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (newPassword.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await ApiService.resetPassword({
        email,
        password: newPassword,
        password_confirmation: confirmPassword
      });

      if (response.data.success) {
        Alert.alert('Success', 'Password reset successfully! Please log in.');
        navigation.navigate('Login');
      } else {
        const errorValues = Object.values(response.data.errors || {})[0];
        // @ts-ignore
        const errorMessage = (errorValues && errorValues[0]) || response.data.message || 'Failed to reset password.';
        Alert.alert('Error', errorMessage);
      }
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Connection error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ImageBackground
      source={require('../../assets/images/backgrounds/registration_bg.png')}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.overlay} />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
              <Text style={styles.titleWhite}>Reset </Text>
              <Text style={styles.titleYellow}>Password</Text>
            </View>

            {step === 1 && (
              <View>
                <Text style={styles.subtitle}>Enter your registered email address to receive a secure reset code.</Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Email Address</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your email address"
                    placeholderTextColor="rgba(255,255,255,0.55)"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    value={email}
                    onChangeText={setEmail}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.primaryBtn, isLoading && styles.btnDisabled]}
                  onPress={handleSendCode}
                  disabled={isLoading}
                  activeOpacity={0.85}
                >
                  {isLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>Send Reset Code</Text>}
                </TouchableOpacity>
              </View>
            )}

            {step === 2 && (
              <View>
                <Text style={styles.subtitle}>We've sent a 6-digit code to:{"\n"}<Text style={{ fontWeight: 'bold', color: COLORS.yellow }}>{email}</Text></Text>

                <TextInput
                  style={[styles.input, styles.codeInput]}
                  placeholder="000000"
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  keyboardType="number-pad"
                  maxLength={6}
                  value={code}
                  onChangeText={setCode}
                />

                <View style={styles.timerContainer}>
                  {isTimerActive ? (
                    <Text style={styles.timerText}>Code expires in <Text style={{ fontWeight: 'bold', color: COLORS.yellow }}>{formatTime(timeLeft)}</Text></Text>
                  ) : (
                    <Text style={styles.timerExpiredText}>Verification code has expired</Text>
                  )}
                </View>

                <TouchableOpacity
                  style={[styles.primaryBtn, (!isTimerActive || isLoading) && styles.btnDisabled]}
                  onPress={handleVerifyCode}
                  disabled={!isTimerActive || isLoading}
                  activeOpacity={0.85}
                >
                  {isLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>Verify Secure Code</Text>}
                </TouchableOpacity>

                <TouchableOpacity style={styles.resendButton} onPress={handleSendCode} disabled={isTimerActive && timeLeft > 540}>
                  <Text style={[styles.resendText, (isTimerActive && timeLeft > 540) && { color: 'rgba(255,255,255,0.4)' }]}>Resend Code</Text>
                </TouchableOpacity>
              </View>
            )}

            {step === 3 && (
              <View>
                <Text style={styles.subtitle}>Create a new secure password. (min 8 chars)</Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>New Password</Text>
                  <View style={styles.passwordContainer}>
                    <TextInput
                      style={styles.passwordInput}
                      placeholder="Enter new password"
                      placeholderTextColor="rgba(255,255,255,0.55)"
                      secureTextEntry={!showPassword}
                      value={newPassword}
                      onChangeText={setNewPassword}
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      style={styles.eyeIcon}
                    >
                      <Ionicons
                        name={showPassword ? 'eye-off' : 'eye'}
                        size={22}
                        color="rgba(255,255,255,0.85)"
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Confirm Password</Text>
                  <View style={styles.passwordContainer}>
                    <TextInput
                      style={styles.passwordInput}
                      placeholder="Confirm new password"
                      placeholderTextColor="rgba(255,255,255,0.55)"
                      secureTextEntry={!showConfirmPassword}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                    />
                    <TouchableOpacity
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                      style={styles.eyeIcon}
                    >
                      <Ionicons
                        name={showConfirmPassword ? 'eye-off' : 'eye'}
                        size={22}
                        color="rgba(255,255,255,0.85)"
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.primaryBtn, isLoading && styles.btnDisabled, { marginTop: 10 }]}
                  onPress={handleResetPassword}
                  disabled={isLoading}
                  activeOpacity={0.85}
                >
                  {isLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>Confirm New Password</Text>}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.navigate('Login');
            }
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-back" size={26} color="#FFF" />
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
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(22, 105, 58, 0.58)',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 10,
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
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 14,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 1,
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
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1.2,
    borderBottomColor: 'rgba(255,255,255,0.85)',
  },
  passwordInput: {
    flex: 1,
    color: '#FFF',
    paddingVertical: 10,
    fontSize: 15,
  },
  eyeIcon: {
    paddingLeft: 10,
    paddingVertical: 6,
  },
  primaryBtn: {
    backgroundColor: 'rgba(201, 106, 46, 0.92)',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
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
  timerContainer: {
    alignItems: 'center',
    marginBottom: 25,
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
  resendButton: {
    marginTop: 25,
    alignItems: 'center',
  },
  resendText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 45,
    left: 15,
    padding: 10,
    zIndex: 10,
  },
});
