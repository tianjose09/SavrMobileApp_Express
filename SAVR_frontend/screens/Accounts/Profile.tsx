import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator, Alert, Platform, Image, Modal, TextInput, KeyboardAvoidingView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { ApiService } from '../../services/api';
import { StorageUtils, StorageKeys, getProfilePicKey } from '../../utils/storage';

export default function Profile({ navigation }: any) {
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>('');

  // Change Password modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordStep, setPasswordStep] = useState<1 | 2>(1);
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [otpSentMsg, setOtpSentMsg] = useState('');

  const handlePickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert('Permission Denied', 'You need to allow camera roll permissions to change your avatar.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      const uri = result.assets[0].uri;
      setProfileImage(uri);
      const key = await getProfilePicKey();
      StorageUtils.setItem(key, uri);
    }
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchProfile();
    });
    fetchProfile();
    return unsubscribe;
  }, [navigation]);

  const fetchProfile = async () => {
    setIsLoading(true);
    try {
      const picKey = await getProfilePicKey();
      const localPic = await StorageUtils.getItem(picKey);
      if (localPic) setProfileImage(localPic);

      const storedName = await StorageUtils.getItem(StorageKeys.DISPLAY_NAME);
      if (storedName) setDisplayName(storedName);

      const response = await ApiService.getProfile();
      if (response.data && response.data.success) {
        setProfile(response.data.user);
      } else {
        throw new Error('Fallback trigger');
      }
    } catch (e) {
      console.log('Profile API not ready, fetching role context to present matching demonstration data...');
      
      let userRole = await StorageUtils.getItem(StorageKeys.USER_ROLE);
      if (!userRole) {
        const userInfoRaw = await StorageUtils.getItem(StorageKeys.USER_INFO);
        if (userInfoRaw) {
          try {
            const parsed = JSON.parse(userInfoRaw);
            userRole = parsed?.role || parsed?.user_type || 'donor';
          } catch (err) {}
        }
      }
      userRole = userRole?.toLowerCase() || 'donor';

      if (userRole === 'partner_kitchen') {
        setProfile({
          role: 'partner_kitchen',
          kitchen_name: 'Loaves and Fishes',
          contact_person: 'Contact Person',
          position_role: 'Manager',
          website_url: 'N/A',
          email: 'contact@loavesandfishes.org',
          contact_number: '+63 912 345 6789',
        });
      } else if (userRole === 'organization') {
        setProfile({
          name: 'Organization Name',
          role: 'organization',
          email: 'contact@organization.org',
          contact_number: '+63 912 345 6789',
          city_municipality: 'Makati',
        });
      } else if (userRole === 'beneficiary') {
        setProfile({
          name: 'Beneficiary Name',
          first_name: 'Beneficiary',
          last_name: 'Name',
          role: 'beneficiary',
          email: 'beneficiary@example.com',
          contact_number: '+63 912 345 6789',
          date_of_birth: '1985-11-20',
          gender: 'Female',
          house_no: '12',
          street: 'Hope Street',
          barangay: 'Brgy 1',
          city_municipality: 'Quezon City',
          province_region: 'Metro Manila',
          postal_zip_code: '1100'
        });
      } else {
        setProfile({
          name: 'Juan Dela Cruz',
          first_name: 'Juan',
          last_name: 'Dela Cruz',
          role: 'donor',
          email: 'juan.delacruz@example.com',
          contact_number: '+63 912 345 6789',
          date_of_birth: '1990-01-01',
          gender: 'Male',
          house_no: '456',
          street: 'Rizal Avenue',
          barangay: 'Brgy 2',
          city_municipality: 'Makati',
          province_region: 'Metro Manila',
          postal_zip_code: '1200'
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const resetPasswordModal = () => {
    setPasswordStep(1);
    setOtpCode('');
    setNewPassword('');
    setConfirmPassword('');
    setOtpSentMsg('');
    setShowPasswordModal(false);
  };

  const handleSendOtp = async () => {
    const email = profile?.email;
    if (!email) return;
    setPwLoading(true);
    try {
      await ApiService.forgotPassword({ email });
      setOtpSentMsg('OTP sent to your email.');
      setPasswordStep(2);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to send OTP. Please try again.');
    } finally {
      setPwLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!otpCode.trim() || otpCode.length < 6) {
      Alert.alert('Invalid OTP', 'Please enter the 6-digit OTP sent to your email.');
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      Alert.alert('Weak Password', 'New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Mismatch', 'Passwords do not match.');
      return;
    }
    setPwLoading(true);
    try {
      await ApiService.resetPassword({
        email: profile?.email,
        code: otpCode.trim(),
        password: newPassword,
        password_confirmation: confirmPassword,
      });
      Alert.alert('Success', 'Your password has been changed successfully.', [
        { text: 'OK', onPress: resetPasswordModal },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to change password. Check your OTP and try again.');
    } finally {
      setPwLoading(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone and will permanently remove your data.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await ApiService.deleteAccount();
              Alert.alert('Success', 'Your account has been deleted.');
              import('../../utils/logout').then(({ LogoutHelper }) => LogoutHelper.logout(navigation));
            } catch (error) {
              Alert.alert('Error', 'Failed to delete account. You may need to clear your active records first.');
              console.error(error);
            }
          },
        }
      ]
    );
  };

  if (isLoading && !profile) {
    return (
      <SafeAreaView style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#0" />
      </SafeAreaView>
    );
  }

  // Value Extracts - Falling back intelligently
  const role = profile?.role || 'donor';
  const isPartnerKitchen = role === 'partner_kitchen';
  const isOrganization = role === 'organization';
  const isBeneficiary = role === 'beneficiary';
  const isDonor = !isPartnerKitchen && !isOrganization && !isBeneficiary;
  const isOrgType = isOrganization || (isBeneficiary && (profile?.beneficiary_type === 'organization' || !!profile?.organization_name));
  const roleDisplay = isPartnerKitchen ? 'PARTNER KITCHEN DETAILS' : isOrganization ? 'ORGANIZATION DETAILS' : isBeneficiary ? 'BENEFICIARY DETAILS' : 'DONOR DETAILS';

  const heroName = isPartnerKitchen
    ? (profile?.kitchen_name || profile?.display_name || profile?.username || profile?.contact_person || displayName || 'Kitchen')
    : (profile?.name || profile?.display_name || profile?.username || `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || displayName || 'User');

  const fName = profile?.first_name || profile?.name?.split(' ')[0] || 'User';
  const lName = profile?.last_name || profile?.name?.split(' ').slice(1).join(' ') || '';
  const mInit = profile?.middle_initial || profile?.middle_name || null;
  const suff = profile?.suffix || null;
  const dob = profile?.date_of_birth || 'Not Specified';
  const gender = profile?.gender || 'Not Specified';

  const houseNo = profile?.house_no || null;
  const street = profile?.street || 'Not Specified';
  const brgy = profile?.barangay || 'Not Specified';
  const city = profile?.city_municipality || 'Not Specified';
  const prov = profile?.province_region || 'Not Specified';
  const zip = profile?.postal_zip_code || null;

  return (
    <SafeAreaView style={styles.container}>

      {/* Top Navigation Bar */}
      <View style={styles.topNav}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.navigate('HomeTabs', { screen: 'Home' })}>
          <Ionicons name="chevron-back" size={30} color="#00592d" />
        </TouchableOpacity>
        <Text style={styles.pageTitle}>My Profile</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Dark Green Hero Banner */}
        <View style={styles.heroBanner}>
          <View style={styles.heroTop}>
            <TouchableOpacity style={styles.avatarCircle} onPress={handlePickImage} activeOpacity={0.8}>
              {profileImage ? (
                <Image source={{ uri: profileImage }} style={{ width: 66, height: 66, borderRadius: 33 }} />
              ) : (
                <Text style={styles.avatarText}>{(displayName || heroName).charAt(0).toUpperCase()}</Text>
              )}
              <View style={styles.cameraIconBadge}>
                <Ionicons name="camera" size={14} color="#00592d" />
              </View>
            </TouchableOpacity>
            <View style={styles.heroTextCol}>
              <Text style={styles.heroName} numberOfLines={1}>{heroName}</Text>
              <Text style={styles.heroSub}>Manage your personal information and account details</Text>
            </View>
          </View>

          <View style={styles.heroDivider} />

          <View style={styles.heroBottomRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="id-card" size={20} color="#FFF" style={{ marginRight: 6 }} />
              <Text style={styles.personalInfoText}>Personal Information</Text>
            </View>

            <TouchableOpacity style={styles.editBtn} onPress={() => navigation.navigate('EditProfile', { profile })}>
              <Ionicons name="pencil" size={14} color="#00592d" style={{ marginRight: 4 }} />
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Section Header */}
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.sectionOverline}>{roleDisplay}</Text>
            <Text style={styles.sectionTitle}>Your Information</Text>
          </View>
        </View>

        {/* Dynamic Pills — only render a field when it has a value */}

        {isPartnerKitchen ? (
          <>
            {!!profile?.kitchen_name && <View style={styles.pillBox}><Text style={styles.pillLabel}>Kitchen Name</Text><Text style={styles.pillValue}>{profile.kitchen_name}</Text></View>}
            {!!profile?.contact_person && <View style={styles.pillBox}><Text style={styles.pillLabel}>Contact Person</Text><Text style={styles.pillValue}>{profile.contact_person}</Text></View>}
            {!!profile?.position_role && <View style={styles.pillBox}><Text style={styles.pillLabel}>Position / Role</Text><Text style={styles.pillValue}>{profile.position_role}</Text></View>}
            {!!profile?.website_url && <View style={styles.pillBox}><Text style={styles.pillLabel}>Website URL</Text><Text style={styles.pillValue}>{profile.website_url}</Text></View>}
          </>
        ) : isOrgType ? (
          /* Donor Organization or Beneficiary Organization */
          <>
            {!!(profile?.name || profile?.organization_name) && <View style={styles.pillBox}><Text style={styles.pillLabel}>Organization Name</Text><Text style={styles.pillValue}>{profile.organization_name || profile.name}</Text></View>}
            {!!profile?.website_url && <View style={styles.pillBox}><Text style={styles.pillLabel}>Website URL</Text><Text style={styles.pillValue}>{profile.website_url}</Text></View>}
            {!!profile?.industry_sector && <View style={styles.pillBox}><Text style={styles.pillLabel}>Industry / Sector</Text><Text style={styles.pillValue}>{profile.industry_sector}</Text></View>}
            {!!profile?.organization_type && <View style={styles.pillBox}><Text style={styles.pillLabel}>Organization Type</Text><Text style={styles.pillValue}>{profile.organization_type}</Text></View>}
            {!!profile?.first_name && <View style={styles.pillBox}><Text style={styles.pillLabel}>First Name</Text><Text style={styles.pillValue}>{profile.first_name}</Text></View>}
            {!!profile?.last_name && <View style={styles.pillBox}><Text style={styles.pillLabel}>Last Name</Text><Text style={styles.pillValue}>{profile.last_name}</Text></View>}
            {!!city && city !== 'Not Specified' && <View style={styles.pillBox}><Text style={styles.pillLabel}>City / Municipality</Text><Text style={styles.pillValue}>{city}</Text></View>}
          </>
        ) : (
          /* Individual — Donor or Beneficiary */
          <>
            {!!fName && <View style={styles.pillBox}><Text style={styles.pillLabel}>First Name</Text><Text style={styles.pillValue}>{fName}</Text></View>}
            {!!lName && <View style={styles.pillBox}><Text style={styles.pillLabel}>Last Name</Text><Text style={styles.pillValue}>{lName}</Text></View>}
            {!!mInit && <View style={styles.pillBox}><Text style={styles.pillLabel}>Middle Initial</Text><Text style={styles.pillValue}>{mInit}</Text></View>}
            {!!suff && <View style={styles.pillBox}><Text style={styles.pillLabel}>Suffix</Text><Text style={styles.pillValue}>{suff}</Text></View>}
            {!!dob && dob !== 'Not Specified' && <View style={styles.pillBox}><Text style={styles.pillLabel}>Date of Birth</Text><Text style={styles.pillValue}>{dob}</Text></View>}
            {!!gender && gender !== 'Not Specified' && <View style={styles.pillBox}><Text style={styles.pillLabel}>Gender</Text><Text style={styles.pillValue}>{gender}</Text></View>}
            {!!houseNo && <View style={styles.pillBox}><Text style={styles.pillLabel}>House Number</Text><Text style={styles.pillValue}>{houseNo}</Text></View>}
            {!!street && street !== 'Not Specified' && <View style={styles.pillBox}><Text style={styles.pillLabel}>Street</Text><Text style={styles.pillValue}>{street}</Text></View>}
            {!!brgy && brgy !== 'Not Specified' && <View style={styles.pillBox}><Text style={styles.pillLabel}>Brgy.</Text><Text style={styles.pillValue}>{brgy}</Text></View>}
            {!!city && city !== 'Not Specified' && <View style={styles.pillBox}><Text style={styles.pillLabel}>City / Municipality</Text><Text style={styles.pillValue}>{city}</Text></View>}
            {!!prov && prov !== 'Not Specified' && <View style={styles.pillBox}><Text style={styles.pillLabel}>Province / Region</Text><Text style={styles.pillValue}>{prov}</Text></View>}
            {!!zip && <View style={styles.pillBox}><Text style={styles.pillLabel}>Postal / ZIP Code</Text><Text style={styles.pillValue}>{zip}</Text></View>}
          </>
        )}

        {!!profile?.email && (
          <View style={styles.pillBox}>
            <Text style={styles.pillLabel}>Email Address</Text>
            <Text style={styles.pillValue}>{profile.email}</Text>
          </View>
        )}

        {!!profile?.contact_number && (
          <View style={styles.pillBox}>
            <Text style={styles.pillLabel}>Contact Number</Text>
            <Text style={styles.pillValue}>
              {profile.contact_number.startsWith('+63')
                ? profile.contact_number.replace(/\s/g, '')
                : `+63${profile.contact_number.replace(/^0/, '')}`}
            </Text>
          </View>
        )}

        {/* Change Password */}
        <TouchableOpacity style={styles.changePwWrapper} onPress={() => { resetPasswordModal(); setShowPasswordModal(true); }}>
          <Ionicons name="lock-closed-outline" size={16} color="#00592d" style={{ marginRight: 8 }} />
          <Text style={styles.changePwText}>Change Password</Text>
        </TouchableOpacity>

        {/* Delete Account */}
        <TouchableOpacity style={styles.deactivateWrapper} onPress={handleDeleteAccount}>
          <Text style={styles.deactivateText}>Delete My Account</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Change Password Modal ── */}
      <Modal visible={showPasswordModal} transparent animationType="fade" onRequestClose={resetPasswordModal}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>

              {/* Icon */}
              <View style={styles.modalIconCircle}>
                <Ionicons name="lock-closed" size={28} color="#00592d" />
              </View>

              <Text style={styles.modalTitle}>Change Password</Text>

              {passwordStep === 1 ? (
                <>
                  <Text style={styles.modalBody}>
                    We'll send a 6-digit OTP to{'\n'}
                    <Text style={styles.modalEmail}>{profile?.email}</Text>
                  </Text>

                  <View style={styles.modalBtnRow}>
                    <TouchableOpacity style={styles.modalCancelBtn} onPress={resetPasswordModal}>
                      <Text style={styles.modalCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.modalPrimaryBtn} onPress={handleSendOtp} disabled={pwLoading}>
                      {pwLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.modalPrimaryText}>Send OTP</Text>}
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.modalBody}>Enter the OTP sent to your email and your new password.</Text>

                  {/* OTP */}
                  <TextInput
                    style={styles.modalInput}
                    placeholder="6-digit OTP"
                    placeholderTextColor="#BDBDBD"
                    keyboardType="number-pad"
                    maxLength={6}
                    value={otpCode}
                    onChangeText={setOtpCode}
                  />

                  {/* New Password */}
                  <View style={styles.modalInputRow}>
                    <TextInput
                      style={[styles.modalInput, { flex: 1 }]}
                      placeholder="New Password"
                      placeholderTextColor="#BDBDBD"
                      secureTextEntry={!showNewPw}
                      value={newPassword}
                      onChangeText={setNewPassword}
                    />
                    <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowNewPw(v => !v)}>
                      <Ionicons name={showNewPw ? 'eye-off-outline' : 'eye-outline'} size={20} color="#999" />
                    </TouchableOpacity>
                  </View>

                  {/* Confirm Password */}
                  <View style={styles.modalInputRow}>
                    <TextInput
                      style={[styles.modalInput, { flex: 1 }]}
                      placeholder="Confirm New Password"
                      placeholderTextColor="#BDBDBD"
                      secureTextEntry={!showConfirmPw}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                    />
                    <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowConfirmPw(v => !v)}>
                      <Ionicons name={showConfirmPw ? 'eye-off-outline' : 'eye-outline'} size={20} color="#999" />
                    </TouchableOpacity>
                  </View>

                  {!!otpSentMsg && <Text style={styles.otpSentMsg}>{otpSentMsg}</Text>}

                  <View style={styles.modalBtnRow}>
                    <TouchableOpacity style={styles.modalCancelBtn} onPress={resetPasswordModal}>
                      <Text style={styles.modalCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.modalPrimaryBtn} onPress={handleChangePassword} disabled={pwLoading}>
                      {pwLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.modalPrimaryText}>Change Password</Text>}
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity onPress={handleSendOtp} disabled={pwLoading} style={{ marginTop: 12 }}>
                    <Text style={styles.resendText}>Resend OTP</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E1E9E4' },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  topNav: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    paddingVertical: 15, paddingHorizontal: 20, position: 'relative',
    marginTop: Platform.OS === 'android' ? 20 : 0
  },
  backButton: { position: 'absolute', left: 20 },
  pageTitle: { fontSize: 18, fontWeight: '800', color: '#00592d' },

  scrollContent: { paddingHorizontal: 20, paddingTop: 10 },

  heroBanner: {
    backgroundColor: '#226E45', borderRadius: 20, padding: 25, marginBottom: 30,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  avatarCircle: {
    width: 66, height: 66, borderRadius: 33, backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center', marginRight: 15
  },
  avatarText: { color: '#FFF', fontSize: 32, fontWeight: '800' },
  cameraIconBadge: {
    position: 'absolute', bottom: -2, right: -2, backgroundColor: '#FFF',
    width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#226E45'
  },
  heroTextCol: { flex: 1 },
  heroName: { fontSize: 18, fontWeight: '800', color: '#FFF', marginBottom: 4, letterSpacing: -0.5 },
  heroSub: { fontSize: 11, color: 'rgba(255,255,255,0.9)', lineHeight: 16 },

  heroDivider: { height: 1.5, backgroundColor: 'rgba(255,255,255,0.15)', marginBottom: 15 },

  heroBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  personalInfoText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
  editBtn: {
    backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16
  },
  editBtnText: { color: '#00592d', fontWeight: 'bold', fontSize: 11 },

  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 },
  sectionOverline: { color: '#00592d', fontWeight: '800', fontSize: 10, letterSpacing: 1, marginBottom: 2 },
  sectionTitle: { fontSize: 24, fontWeight: '800', color: '#685D52', letterSpacing: -0.5 },
  updatedBadge: { backgroundColor: '#E4F1EB', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  updatedBadgeText: { color: '#00592d', fontWeight: 'bold', fontSize: 11 },

  pillBox: {
    backgroundColor: '#FFF', borderRadius: 16, paddingHorizontal: 20, paddingVertical: 15,
    marginBottom: 12, borderWidth: 1, borderColor: '#F0F0F0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2
  },
  pillLabel: { fontSize: 11, fontWeight: '800', color: '#999', marginBottom: 4 },
  pillValue: { fontSize: 16, fontWeight: '800', color: '#1B5B39' },

  changePwWrapper: {
    marginTop: 25, paddingVertical: 18, alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#00592d', borderRadius: 20, backgroundColor: 'rgba(0, 89, 45, 0.05)'
  },
  changePwText: { color: '#00592d', fontWeight: '800', fontSize: 15 },

  deactivateWrapper: {
    marginTop: 14, paddingVertical: 18, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#FA8072', borderRadius: 20, backgroundColor: 'rgba(250, 128, 114, 0.05)'
  },
  deactivateText: { color: '#FA8072', fontWeight: '800', fontSize: 15 },

  // Modal
  modalOverlay: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: '#FFF', borderRadius: 24, padding: 28,
    width: '100%', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 10,
  },
  modalIconCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#E8F5E9', justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#1B3A2D', marginBottom: 10, textAlign: 'center' },
  modalBody: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  modalEmail: { fontWeight: '800', color: '#1B3A2D' },
  modalInput: {
    width: '100%', borderBottomWidth: 1.5, borderBottomColor: '#E0E0E0',
    paddingVertical: 12, paddingHorizontal: 4, fontSize: 15, color: '#333',
    marginBottom: 14, letterSpacing: 1,
  },
  modalInputRow: { flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: 14 },
  eyeBtn: { position: 'absolute', right: 0, bottom: 14 },
  otpSentMsg: { color: '#00592d', fontWeight: '700', fontSize: 13, marginBottom: 16 },
  modalBtnRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 8, width: '100%' },
  modalCancelBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 30,
    borderWidth: 1.5, borderColor: '#DDD', alignItems: 'center',
  },
  modalCancelText: { color: '#888', fontWeight: '700', fontSize: 14 },
  modalPrimaryBtn: {
    flex: 1.5, paddingVertical: 13, borderRadius: 30,
    backgroundColor: '#00592d', alignItems: 'center',
  },
  modalPrimaryText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
  resendText: { color: '#888', fontSize: 13, textDecorationLine: 'underline' },
});
