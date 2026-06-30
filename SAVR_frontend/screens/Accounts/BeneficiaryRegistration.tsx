import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ImageBackground, Platform, ScrollView, KeyboardAvoidingView, Dimensions, Modal, Image, StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { Picker } from '@react-native-picker/picker';
import CustomDropdown from '../../components/CustomDropdown';
import { ApiService } from '../../services/api';
import { Alert } from 'react-native';
import { StorageUtils, StorageKeys } from '../../utils/storage';
import { usePhilippineAddress } from '../../hooks/usePhilippineAddress';
import { checkEmailTypo } from '../../utils/emailTypoChecker';
import { evaluatePasswordStrength } from '../../utils/passwordStrength';
import { useFocusEffect } from '@react-navigation/native';

const { width, height } = Dimensions.get('window');

const COLORS = {
  overlay: '#00592d',
  glass: 'rgba(255,255,255,0.08)',
  glassBorder: 'rgba(255,255,255,0.45)',
  white: '#FFFFFF',
  yellow: '#E4B63F',
  orange: '#C97B37',
};

export default function BeneficiaryRegistration({ navigation }: any) {
  const [selectedRole, setSelectedRole] = useState<'individual' | 'organization'>('individual');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);


  const {
    provinces,
    cities,
    barangays,
    handleProvinceChange,
    handleCityChange,
    isLoadingProvinces,
    isLoadingCities,
    isLoadingBarangays
  } = usePhilippineAddress();

  const [emailSuggestion, setEmailSuggestion] = useState<string | null>(null);

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    middle_name: '',
    suffix: '',
    date_of_birth: '',
    gender: '',
    house_no: '',
    street: '',
    barangay: '',
    city_municipality: '',
    province_region: '',
    postal_zip_code: '',
    email: '',
    contact_number: '',
    password: '',
    password_confirmation: '',
    organization_name: '',
    website_url: '',
    industry_sector: '',
    organization_type: '',
    contact_person: '',
    position_role: '',
  });

  useFocusEffect(
    useCallback(() => {
      setForm({
        first_name: '',
        last_name: '',
        middle_name: '',
        suffix: '',
        date_of_birth: '',
        gender: '',
        house_no: '',
        street: '',
        barangay: '',
        city_municipality: '',
        province_region: '',
        postal_zip_code: '',
        email: '',
        contact_number: '',
        password: '',
        password_confirmation: '',
        organization_name: '',
        website_url: '',
        industry_sector: '',
        organization_type: '',
        contact_person: '',
        position_role: '',
      });
      setSelectedRole('individual');
      setShowPassword(false);
      setShowConfirmPassword(false);
      setEmailSuggestion(null);
    }, [])
  );



  const updateForm = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key === 'email') {
      setEmailSuggestion(checkEmailTypo(value));
    }
  };

  const handleRegister = async () => {
    // Required fields check
    const requiredFields = selectedRole === 'individual'
      ? ['first_name', 'last_name', 'date_of_birth', 'gender', 'province_region', 'city_municipality', 'barangay', 'house_no', 'street', 'postal_zip_code', 'email', 'contact_number', 'password', 'password_confirmation']
      : ['organization_name', 'website_url', 'industry_sector', 'organization_type', 'contact_person', 'position_role', 'email', 'contact_number', 'password', 'password_confirmation'];

    const missingFields = [];
    for (const key of requiredFields) {
      if (!form[key as keyof typeof form]?.trim()) {
        const readable = key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        missingFields.push(readable);
      }
    }

    if (missingFields.length > 0) {
      Alert.alert('Missing Fields', `Please fill out the following required fields:\n• ${missingFields.join('\n• ')}`);
      return;
    }

    if (form.password !== form.password_confirmation) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      // Defer backend registration until AFTER email verification!
      const name = selectedRole === 'individual' ? form.first_name : form.organization_name;
      await ApiService.sendVerificationEmail({ email: form.email, name });

      // Determine where the user belongs after registration
      const registrationType = 'beneficiary';
      const targetDashboard = 'BeneficiaryDashboard';

      // Pass ALL form payload to VerifyEmail
      const payload = {
        ...form,
        contact_number: form.contact_number ? `+63${form.contact_number}` : '',
        beneficiary_type: selectedRole,
        role: registrationType,
        registrationType,
        targetDashboard
      };

      Alert.alert('Success', 'Verification code sent! Please check your email.');
      navigation.navigate('VerifyEmail', payload);
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || 'Something went wrong. Please try again.';
      Alert.alert('Registration Failed', msg);
    } finally {
      setIsLoading(false);
    }
  };

  const renderLineInput = (
    label: string,
    keyName: string,
    opts?: {
      placeholder?: string;
      keyboardType?: any;
      rightIcon?: React.ReactNode;
      secure?: boolean;
      multiline?: boolean;
      maxLength?: number;
      isRequired?: boolean;
      prefix?: string;
    }
  ) => (
    <View style={styles.inputBlock}>
      <View style={styles.labelContainer}>
        <Text style={styles.label}>
          {label}
          {opts?.isRequired && <Text style={{ color: '#E4B63F' }}> *</Text>}
        </Text>
      </View>
      <View style={styles.lineInputWrap}>
        {opts?.prefix ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1.5, borderBottomColor: 'rgba(255,255,255,0.95)', height: 28 }}>
            <Text style={{ color: '#FFF', fontSize: 11.5, lineHeight: 14, paddingBottom: 2 }}>{opts.prefix}</Text>
            <TextInput
              value={(form as any)[keyName]}
              onChangeText={(val) => updateForm(keyName, val)}
              style={[styles.lineInput, { borderBottomWidth: 0, flex: 1, paddingLeft: 0, paddingTop: 0, paddingBottom: 2, paddingRight: opts.rightIcon ? 28 : 0 }]}
              placeholder={opts.placeholder || ''}
              placeholderTextColor="rgba(255,255,255,0.45)"
              keyboardType={opts.keyboardType}
              secureTextEntry={opts.secure}
              maxLength={opts.maxLength}
            />
            {opts.rightIcon}
          </View>
        ) : (
          <>
            <TextInput
              value={(form as any)[keyName]}
              onChangeText={(val) => updateForm(keyName, val)}
              style={[styles.lineInput, opts?.multiline && { minHeight: 34 }]}
              placeholder={opts?.placeholder || ''}
              placeholderTextColor="rgba(255,255,255,0.45)"
              keyboardType={opts?.keyboardType}
              secureTextEntry={opts?.secure}
              multiline={opts?.multiline}
              maxLength={opts?.maxLength}
            />
            {opts?.rightIcon}
          </>
        )}
      </View>
    </View>
  );

  return (
    <ImageBackground
      source={require('../../assets/images/backgrounds/registration_bg.png')}
      resizeMode="cover"
      style={styles.background}
    >
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      <SafeAreaView style={styles.safeArea}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-back" size={26} color="#FFF" />
        </TouchableOpacity>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.headerWrap}>
              <View style={styles.titleRow}>
                <Image
                  source={require('../../assets/images/icons/registerbeneficiaryicon.png')}
                  style={styles.headerIconImage}
                  resizeMode="contain"
                />
                <Text style={styles.headerTitle}>
                  <Text style={styles.headerTitleYellow}>BENEFICIARY </Text>
                  <Text style={styles.headerTitleWhite}>DETAIL</Text>
                </Text>
              </View>
              <Text style={styles.headerSubtitle}>Please enter your details</Text>
            </View>

            <View style={styles.glassCard}>
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[
                    styles.toggleButton,
                    selectedRole === 'individual' ? styles.toggleActive : styles.toggleInactive,
                  ]}
                  onPress={() => setSelectedRole('individual')}
                >
                  <Ionicons
                    name="person"
                    size={20}
                    color="#FFF"
                    style={styles.toggleIcon}
                  />
                  <Text style={styles.toggleText}>INDIVIDUAL</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[
                    styles.toggleButton,
                    selectedRole === 'organization' ? styles.toggleActive : styles.toggleInactive,
                  ]}
                  onPress={() => setSelectedRole('organization')}
                >
                  <Ionicons
                    name="people"
                    size={20}
                    color="#FFF"
                    style={styles.toggleIcon}
                  />
                  <Text style={styles.toggleText}>ORGANIZATION</Text>
                </TouchableOpacity>
              </View>

              {selectedRole === 'individual' ? (
                <>
                  <View style={styles.twoColRow}>
                    <View style={styles.col}>
                      {renderLineInput('First Name', 'first_name', { isRequired: true })}
                    </View>
                    <View style={styles.col}>
                      {renderLineInput('Last Name', 'last_name', { isRequired: true })}
                    </View>
                  </View>

                  <View style={styles.twoColRow}>
                    <View style={styles.col}>
                      {renderLineInput('Middle Name', 'middle_name')}
                    </View>
                    <View style={styles.col}>
                      {renderLineInput('Suffix', 'suffix')}
                    </View>
                  </View>

                  <View style={styles.twoColRow}>
                    <View style={styles.col}>
                      <View style={styles.inputBlock}>
                        <View style={styles.labelContainer}>
                          <Text style={styles.label}>Date of Birth<Text style={{ color: '#E4B63F' }}> *</Text></Text>
                        </View>
                        <View style={styles.lineInputWrap}>
                          <TextInput
                            style={styles.lineInput}
                            placeholder="YYYY-MM-DD"
                            placeholderTextColor="rgba(255,255,255,0.45)"
                            value={form.date_of_birth}
                            onChangeText={(val) => updateForm('date_of_birth', val)}
                            keyboardType="default"
                          />
                        </View>
                      </View>
                    </View>
                    <View style={styles.col}>
                      <View style={styles.inputBlock}>
                        <View style={styles.labelContainer}>
                          <Text style={styles.label}>Gender<Text style={{ color: '#E4B63F' }}> *</Text></Text>
                        </View>
                        <View style={[styles.lineInputWrap, styles.pickerContainer]}>
                          <CustomDropdown
                            selectedValue={form.gender}
                            onValueChange={(itemValue) => updateForm('gender', itemValue)}
                            placeholder="Select Gender"
                            items={[
                              { label: "Male", value: "Male" },
                              { label: "Female", value: "Female" }
                            ]}
                            style={{ borderWidth: 0, paddingHorizontal: 0, height: 30 }}
                          />
                        </View>
                      </View>
                    </View>
                  </View>

                  <View style={styles.addressRow}>
                    <View style={[styles.addressCol, { flex: 1.5 }]}>
                      <View style={styles.inputBlock}>
                        <View style={styles.labelContainer}>
                          <Text style={styles.label}>Province / Region<Text style={{ color: '#E4B63F' }}> *</Text></Text>
                        </View>
                        <View style={[styles.lineInputWrap, styles.pickerContainer]}>
                          <CustomDropdown
                            selectedValue={form.province_region}
                            onValueChange={(val) => {
                              updateForm('province_region', val);
                              handleProvinceChange(val);
                            }}
                            placeholder={isLoadingProvinces ? "Loading..." : "Select"}
                            items={provinces}
                            style={{ borderWidth: 0, paddingHorizontal: 0, height: 28 }}
                          />
                        </View>
                      </View>
                    </View>

                    <View style={[styles.addressCol, { flex: 1.5 }]}>
                      <View style={styles.inputBlock}>
                        <View style={styles.labelContainer}>
                          <Text style={styles.label}>City/Municipality<Text style={{ color: '#E4B63F' }}> *</Text></Text>
                        </View>
                        <View style={[styles.lineInputWrap, styles.pickerContainer]}>
                          <CustomDropdown
                            selectedValue={form.city_municipality}
                            onValueChange={(val) => {
                              updateForm('city_municipality', val);
                              handleCityChange(val);
                            }}
                            placeholder={isLoadingCities ? "Loading..." : "City"}
                            items={cities}
                            style={{ borderWidth: 0, paddingHorizontal: 0, height: 28 }}
                          />
                        </View>
                      </View>
                    </View>

                    <View style={[styles.addressCol, { flex: 1.1 }]}>
                      <View style={styles.inputBlock}>
                        <View style={styles.labelContainer}>
                          <Text style={styles.label}>Brgy.<Text style={{ color: '#E4B63F' }}> *</Text></Text>
                        </View>
                        <View style={[styles.lineInputWrap, styles.pickerContainer]}>
                          <CustomDropdown
                            selectedValue={form.barangay}
                            onValueChange={(val) => updateForm('barangay', val)}
                            placeholder={isLoadingBarangays ? "Loading..." : "Brgy"}
                            items={barangays}
                            style={{ borderWidth: 0, paddingHorizontal: 0, height: 28 }}
                          />
                        </View>
                      </View>
                    </View>
                  </View>

                  <View style={styles.addressRow}>
                    <View style={[styles.addressCol, { flex: 1.3 }]}>
                      {renderLineInput('House Number', 'house_no', { keyboardType: 'numeric', isRequired: true })}
                    </View>
                    <View style={[styles.addressCol, { flex: 1.1 }]}>
                      {renderLineInput('Street', 'street', { isRequired: true })}
                    </View>
                    <View style={[styles.addressCol, { flex: 1.7 }]}>
                      {renderLineInput('Postal / ZIP', 'postal_zip_code', { keyboardType: 'numeric', isRequired: true })}
                    </View>
                  </View>
                </>
              ) : (
                <>
                  {renderLineInput('Organization Name', 'organization_name', { isRequired: true })}

                  {renderLineInput('Website URL', 'website_url', {
                    isRequired: true,
                    rightIcon: (
                      <MaterialCommunityIcons
                        name="link-variant"
                        size={18}
                        color="rgba(255, 255, 255, 0.85)"
                        style={styles.rightFieldIcon}
                      />
                    ),
                  })}

                  <View style={styles.twoColRow}>
                    <View style={styles.col}>
                      <View style={styles.inputBlock}>
                        <View style={styles.labelContainer}>
                          <Text style={styles.label}>Industry / Sector<Text style={{ color: '#E4B63F' }}> *</Text></Text>
                        </View>
                        <View style={[styles.lineInputWrap, styles.pickerContainer]}>
                          <CustomDropdown
                            selectedValue={form.industry_sector}
                            onValueChange={(val) => updateForm('industry_sector', val)}
                            placeholder="Select Sector"
                            items={[
                              { label: "Food", value: "Food" },
                              { label: "NGO", value: "NGO" },
                              { label: "Corporate", value: "Corporate" }
                            ]}
                            style={{ borderWidth: 0, paddingHorizontal: 0, height: 30 }}
                          />
                        </View>
                      </View>
                    </View>
                    <View style={styles.col}>
                      <View style={styles.inputBlock}>
                        <View style={styles.labelContainer}>
                          <Text style={styles.label}>Organization Type<Text style={{ color: '#E4B63F' }}> *</Text></Text>
                        </View>
                        <View style={[styles.lineInputWrap, styles.pickerContainer]}>
                          <CustomDropdown
                            selectedValue={form.organization_type}
                            onValueChange={(val) => updateForm('organization_type', val)}
                            placeholder="Select Type"
                            items={[
                              { label: "Public", value: "Public" },
                              { label: "Private", value: "Private" }
                            ]}
                            style={{ borderWidth: 0, paddingHorizontal: 0, height: 30 }}
                          />
                        </View>
                      </View>
                    </View>
                  </View>

                  <View style={styles.twoColRow}>
                    <View style={styles.col}>
                      {renderLineInput('Contact Person', 'contact_person', { isRequired: true })}
                    </View>
                    <View style={styles.col}>
                      {renderLineInput('Position/Role', 'position_role', { isRequired: true })}
                    </View>
                  </View>
                </>
              )}

              <View>
                {renderLineInput('Email Address', 'email', {
                  keyboardType: 'email-address',
                  isRequired: true,
                })}
                {emailSuggestion && (
                  <TouchableOpacity onPress={() => {
                    updateForm('email', emailSuggestion);
                    setEmailSuggestion(null);
                  }}>
                    <Text style={{ color: COLORS.yellow, fontSize: 11, marginTop: -4, marginBottom: 8, marginLeft: 2 }}>
                      Did you mean {emailSuggestion}?
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {renderLineInput('Contact Number', 'contact_number', {
                keyboardType: 'numeric',
                maxLength: 10,
                isRequired: true,
                prefix: '+63',
              })}

              <View>
                {renderLineInput('Password', 'password', {
                  secure: !showPassword,
                  isRequired: true,
                  rightIcon: (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => setShowPassword(!showPassword)}
                      style={styles.eyeButton}
                    >
                      <Ionicons
                        name={showPassword ? 'eye-off' : 'eye'}
                        size={22}
                        color="#FFF"
                      />
                    </TouchableOpacity>
                  ),
                })}
                {form.password.length > 0 && (
                  <View style={{ marginTop: -2, marginBottom: 8, marginLeft: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={{ fontSize: 10, color: '#FFF' }}>Strength: </Text>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: evaluatePasswordStrength(form.password).color }}>
                        {evaluatePasswordStrength(form.password).label}
                      </Text>
                    </View>
                    {evaluatePasswordStrength(form.password).missing.length > 0 && (
                      <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', marginTop: 2, paddingRight: 4 }}>
                        Needs: {evaluatePasswordStrength(form.password).missing.join(', ')}
                      </Text>
                    )}
                  </View>
                )}
              </View>

              {renderLineInput('Confirm Password', 'password_confirmation', {
                secure: !showConfirmPassword,
                isRequired: true,
                rightIcon: (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={styles.eyeButton}
                  >
                    <Ionicons
                      name={showConfirmPassword ? 'eye-off' : 'eye'}
                      size={22}
                      color="#FFF"
                    />
                  </TouchableOpacity>
                ),
              })}

              <TouchableOpacity
                style={styles.registerButton}
                activeOpacity={0.85}
                onPress={handleRegister}
                disabled={isLoading}
              >
                <Text style={styles.registerButtonText}>{isLoading ? 'Registering...' : 'Register'}</Text>
              </TouchableOpacity>

              <View style={styles.loginRow}>
                <Text style={styles.loginText}>Already have an account? </Text>
                <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                  <Text style={styles.loginHighlight}>Log In</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.overlay,
  },

  safeArea: {
    flex: 1,
  },

  scrollContent: {
    paddingBottom: 30,
    paddingHorizontal: 18,
  },

  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 52 : 34,
    left: 12,
    zIndex: 20,
    padding: 8,
  },

  headerWrap: {
    alignItems: 'center',
    marginTop: Platform.OS === 'ios' ? 80 : 65,
    marginBottom: 16,
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerIcon: {
    marginRight: 8,
    textShadowColor: 'rgba(0,0,0,0.28)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 8,
  },

  headerIconImage: {
    width: 40,
    height: 40,
    marginRight: 8,
  },

  headerTitle: {
    fontSize: width * 0.075,
    fontWeight: '800',
    letterSpacing: 0.4,
    textShadowColor: 'rgba(0,0,0,0.28)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 8,
  },

  headerTitleYellow: {
    color: COLORS.yellow,
  },

  headerTitleWhite: {
    color: '#FFF',
  },

  headerSubtitle: {
    color: '#F4F4F4',
    fontSize: 14,
    marginTop: 8,
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },

  glassCard: {
    backgroundColor: COLORS.glass,
    borderWidth: 2,
    borderColor: COLORS.glassBorder,
    borderRadius: 38,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    minHeight: height * 0.7,
  },

  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 8,
    paddingHorizontal: 4,
  },

  toggleButton: {
    flex: 1,
    height: 40,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  toggleActive: {
    backgroundColor: COLORS.yellow,
    borderWidth: 1.5,
    borderColor: '#FFF3C4',
  },

  toggleInactive: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.8)',
  },

  toggleIcon: {
    marginRight: 8,
  },

  toggleText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },

  twoColRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },

  col: {
    flex: 1,
  },

  addressRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },

  addressCol: {
    justifyContent: 'flex-start',
  },

  inputBlock: {
    marginBottom: 6,
  },

  labelContainer: {
    minHeight: 16,
    justifyContent: 'flex-end',
    marginBottom: 2,
  },

  label: {
    color: '#FFF',
    fontSize: 10.5,
    fontWeight: '700',
  },

  lineInputWrap: {
    position: 'relative',
    justifyContent: 'center',
  },

  lineInput: {
    height: 28,
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(255,255,255,0.95)',
    color: '#FFF',
    fontSize: 11.5,
    paddingRight: 28,
    paddingBottom: 2,
    width: '100%',
  },

  pickerContainer: {
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(255,255,255,0.95)',
    height: 28,
    justifyContent: 'center',
  },

  picker: {
    color: '#FFF',
    marginLeft: -10,
    marginTop: Platform.OS === 'ios' ? -50 : 0,
    width: '120%',
  },

  rightFieldIcon: {
    position: 'absolute',
    right: 2,
    bottom: 8,
  },

  eyeButton: {
    position: 'absolute',
    right: 0,
    bottom: 5,
    padding: 4,
  },

  registerButton: {
    marginTop: 18,
    alignSelf: 'center',
    width: '70%',
    backgroundColor: COLORS.orange,
    borderRadius: 28,
    paddingVertical: 12,
    alignItems: 'center',
  },

  registerButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },

  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },

  loginText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '500',
  },

  loginHighlight: {
    color: COLORS.yellow,
    fontSize: 13,
    fontWeight: '800',
  },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 30, alignItems: 'center' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#eee' },
  modalTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a1a', textAlign: 'center' },
  modalCancel: { fontSize: 15, color: '#888' },
  modalDone: { fontSize: 15, fontWeight: '700', color: '#00592d' },
});