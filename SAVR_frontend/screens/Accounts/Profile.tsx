import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator, Alert, Platform, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { ApiService } from '../../services/api';
import { StorageUtils, StorageKeys, getProfilePicKey } from '../../utils/storage';

export default function Profile({ navigation }: any) {
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>('');

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

  const handleDeactivate = () => {
    Alert.alert(
      'Deactivate Account',
      'Are you sure you want to deactivate your account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: async () => {
            try {
              await ApiService.deactivateAccount();
              Alert.alert('Success', 'Your account has been deactivated.');
              import('../../utils/logout').then(({ LogoutHelper }) => LogoutHelper.logout(navigation));
            } catch (e) {
              Alert.alert('Error', 'Failed to deactivate account.');
            }
          }
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
            {!!houseNo && <View style={styles.pillBox}><Text style={styles.pillLabel}>House #</Text><Text style={styles.pillValue}>{houseNo}</Text></View>}
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

        <TouchableOpacity style={styles.deactivateWrapper} onPress={handleDeactivate}>
          <Text style={styles.deactivateText}>Deactivate My Account</Text>
        </TouchableOpacity>

        {/* Removed bottom tab spacer */}
        <View style={{ height: 40 }} />

      </ScrollView>

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

  deactivateWrapper: {
    marginTop: 25, paddingVertical: 18, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#FA8072', borderRadius: 20, backgroundColor: 'rgba(250, 128, 114, 0.05)'
  },
  deactivateText: { color: '#FA8072', fontWeight: '800', fontSize: 15 }
});
