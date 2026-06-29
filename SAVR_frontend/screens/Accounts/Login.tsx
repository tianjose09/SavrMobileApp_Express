import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ImageBackground,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Dimensions,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ApiService } from '../../services/api';
import { StorageUtils, StorageKeys } from '../../utils/storage';
import { registerForPushNotifications } from '../../services/pushNotifications';

const { width, height } = Dimensions.get('window');

const COLORS = {
  yellow: '#f4b942',
  orange: '#c96a2e',
};

const LOCKOUT_KEY = '@savr_login_lockout';
const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 5 * 60;

const formatCountdown = (secs: number) => {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

export default function Login({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [attemptsLeft, setAttemptsLeft] = useState(MAX_ATTEMPTS);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check persisted lockout on mount
  useEffect(() => {
    checkLockout();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const checkLockout = async () => {
    const stored = await StorageUtils.getItem(LOCKOUT_KEY);
    if (!stored) return;
    const data = JSON.parse(stored);
    const remaining = Math.ceil((data.lockedUntil - Date.now()) / 1000);
    if (remaining > 0) {
      setAttemptsLeft(0);
      startCountdown(remaining);
    } else {
      await StorageUtils.removeItem(LOCKOUT_KEY);
    }
  };

  const startCountdown = (seconds: number) => {
    setCountdown(seconds);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          setAttemptsLeft(MAX_ATTEMPTS);
          StorageUtils.removeItem(LOCKOUT_KEY);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleLogin = async () => {
    if (attemptsLeft === 0 && countdown > 0) return;

    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password.');
      return;
    }

    try {
      setIsLoading(true);
      const response = await ApiService.login({ email, password });

      if (response.data.success) {
        await StorageUtils.removeItem(LOCKOUT_KEY);
        await StorageUtils.setItem(StorageKeys.AUTH_TOKEN, response.data.token);
        await StorageUtils.setItem(StorageKeys.USER_ROLE, response.data.user.role || 'donor');
        await StorageUtils.setItem(StorageKeys.DISPLAY_NAME, response.data.user.display_name || '');
        await StorageUtils.setItem(StorageKeys.USER_INFO, JSON.stringify(response.data.user));
        registerForPushNotifications().catch(() => {}); // non-blocking
        navigation.reset({ index: 0, routes: [{ name: 'MainDrawer' }] });
      }
    } catch (error: any) {
      const data = error.response?.data;
      const status = error.response?.status;

      if (status === 429 || data?.locked) {
        // Server confirmed lockout
        const retryAfter = data?.retry_after ?? LOCKOUT_SECONDS;
        const lockedUntil = Date.now() + retryAfter * 1000;
        await StorageUtils.setItem(LOCKOUT_KEY, JSON.stringify({ lockedUntil }));
        setAttemptsLeft(0);
        startCountdown(retryAfter);
        Alert.alert('Account Temporarily Locked', `Too many failed attempts. Try again in ${formatCountdown(retryAfter)}.`);
      } else {
        const remaining = data?.attempts_remaining ?? attemptsLeft - 1;
        setAttemptsLeft(remaining);

        if (remaining <= 0) {
          const lockedUntil = Date.now() + LOCKOUT_SECONDS * 1000;
          await StorageUtils.setItem(LOCKOUT_KEY, JSON.stringify({ lockedUntil }));
          startCountdown(LOCKOUT_SECONDS);
          Alert.alert('Account Temporarily Locked', `Too many failed attempts. Try again in 15:00.`);
        } else {
          const msg = data?.message || 'Invalid email or password.';
          Alert.alert('Login Failed', `${msg}\n\nAttempts remaining: ${remaining}`);
        }
      }
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
              <Text style={styles.titleWhite}>Welcome </Text>
              <Text style={styles.titleYellow}>back!</Text>
            </View>

            <Text style={styles.subtitle}>Please enter your details</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email or Username</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Enter your email or username"
                placeholderTextColor="rgba(255,255,255,0.55)"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>

              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  placeholder="Enter your password"
                  placeholderTextColor="rgba(255,255,255,0.55)"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeIcon}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={22}
                    color="rgba(255,255,255,0.85)"
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.utilsRow}>
              <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
                <Text style={styles.utilText}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>

            {countdown > 0 && (
              <View style={styles.lockoutBanner}>
                <Ionicons name="lock-closed" size={16} color="#b91c1c" style={{ marginRight: 6 }} />
                <Text style={styles.lockoutText}>
                  Locked — try again in{' '}
                  <Text style={{ fontWeight: '800' }}>{formatCountdown(countdown)}</Text>
                </Text>
              </View>
            )}

            {attemptsLeft > 0 && attemptsLeft < MAX_ATTEMPTS && (
              <Text style={styles.attemptsText}>
                {attemptsLeft} attempt{attemptsLeft !== 1 ? 's' : ''} remaining
              </Text>
            )}

            <TouchableOpacity
              style={[styles.loginBtn, (isLoading || countdown > 0) && { opacity: 0.5 }]}
              onPress={handleLogin}
              disabled={isLoading || countdown > 0}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.loginBtnText}>
                  {countdown > 0 ? `Locked (${formatCountdown(countdown)})` : 'Log In'}
                </Text>
              )}
            </TouchableOpacity>

            <View style={styles.registerRow}>
              <Text style={styles.registerNormal}>Don&apos;t have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Registration')}>
                <Text style={styles.registerHighlight}>Register</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
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
    marginTop: height * 0.05,
  },
  logo: {
    width: 300,
    height: 100,
  },

  glassCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 32,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 24,
    borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.25)',
  },

  titleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  titleWhite: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: -0.5,
  },
  titleYellow: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.yellow,
    letterSpacing: -0.5,
  },
  subtitle: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.92)',
    marginBottom: 28,
    fontSize: 14,
  },

  inputGroup: {
    marginBottom: 20,
  },
  label: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 15,
    marginBottom: 6,
  },
  input: {
    borderBottomWidth: 1.2,
    borderBottomColor: 'rgba(255,255,255,0.85)',
    color: '#FFF',
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: 'transparent',
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

  utilsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 26,
    marginTop: 2,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  utilText: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
  },

  loginBtn: {
    backgroundColor: 'rgba(201, 106, 46, 0.92)',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  loginBtnText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 16,
  },

  lockoutBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(185,28,28,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(185,28,28,0.5)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  lockoutText: {
    color: '#fca5a5',
    fontSize: 13,
    flex: 1,
  },
  attemptsText: {
    color: '#fca5a5',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },

  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  registerNormal: {
    color: '#FFF',
    fontSize: 13,
  },
  registerHighlight: {
    color: COLORS.yellow,
    fontWeight: '800',
    fontSize: 13,
  },

  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 45,
    left: 15,
    padding: 10,
  },
});