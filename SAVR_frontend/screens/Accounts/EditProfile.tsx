import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, SafeAreaView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator , StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ApiService } from '../../services/api';
import { StorageUtils, StorageKeys } from '../../utils/storage';

const Field = ({
  label,
  value,
  onChangeText,
  keyboardType = 'default',
  maxLength
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  keyboardType?: any;
  maxLength?: number;
}) => (
  <View style={styles.pillBox}>
    <Text style={styles.pillLabel}>{label}</Text>
    <TextInput
      style={styles.pillInput}
      value={value}
      onChangeText={onChangeText}
      keyboardType={keyboardType}
      maxLength={maxLength}
    />
  </View>
);

export default function EditProfile({ route, navigation }: any) {
  const profile = route.params?.profile || {};

  const role = profile.role || 'donor';
  const isPartnerKitchen = role === 'partner_kitchen';
  const isOrgType = role === 'organization' ||
    (role === 'beneficiary' && (profile.beneficiary_type === 'organization' || !!profile.organization_name));

  const [formData, setFormData] = useState({
    // Individual fields
    first_name: profile.first_name || profile.name?.split(' ')[0] || '',
    last_name: profile.last_name || profile.name?.split(' ').slice(1).join(' ') || '',
    middle_initial: profile.middle_initial || '',
    suffix: profile.suffix || '',
    date_of_birth: profile.date_of_birth || '',
    gender: profile.gender || '',
    house_no: profile.house_no || '',
    street: profile.street || '',
    barangay: profile.barangay || '',
    city_municipality: profile.city_municipality || '',
    province_region: profile.province_region || '',
    postal_zip_code: profile.postal_zip_code || '',
    // Organization fields
    organization_name: profile.organization_name || profile.name || '',
    website_url: profile.website_url || '',
    industry_sector: profile.industry_sector || '',
    organization_type: profile.organization_type || '',
    // Partner kitchen fields
    kitchen_name: profile.kitchen_name || '',
    contact_person: profile.contact_person || '',
    position_role: profile.position_role || '',
    // Shared
    email: profile.email || '',
    contact_number: (profile.contact_number || '').replace(/^\+63/, ''),
  });

  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (isPartnerKitchen && !formData.kitchen_name) {
      Alert.alert('Error', 'Kitchen name is required.');
      return;
    }
    if (isOrgType && !formData.organization_name) {
      Alert.alert('Error', 'Organization name is required.');
      return;
    }
    if (!isPartnerKitchen && !isOrgType && (!formData.first_name || !formData.last_name)) {
      Alert.alert('Error', 'First and Last name are required.');
      return;
    }

    setIsLoading(true);
    try {
      const displayName = isPartnerKitchen
        ? formData.kitchen_name
        : isOrgType
          ? formData.organization_name
          : `${formData.first_name} ${formData.last_name}`.trim();

      const payload = {
        ...formData,
        name: displayName,
        contact_number: formData.contact_number
          ? `+63${formData.contact_number.replace(/^\+63/, '').replace(/^0/, '')}`
          : '',
      };

      const response = await ApiService.updateProfile(payload);
      if (response.data.success) {
        await StorageUtils.setItem(StorageKeys.DISPLAY_NAME, displayName);
        Alert.alert('Success', 'Profile updated successfully.');
        if (navigation.canGoBack()) navigation.goBack(); else navigation.navigate('HomeTabs', { screen: 'Home' });
      } else {
        const errorValues = Object.values(response.data.errors || {})[0];
        // @ts-ignore
        const errorMessage = (errorValues && errorValues[0]) || response.data.message || 'Failed to update.';
        Alert.alert('Error', errorMessage);
      }
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Connection error.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>

        <View style={styles.topNav}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('HomeTabs', { screen: 'Home' })}>
            <Ionicons name="close" size={30} color="#1B5B39" />
          </TouchableOpacity>
          <Text style={styles.pageTitle}>Edit Profile</Text>
          <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={isLoading}>
            {isLoading ? <ActivityIndicator color="#1B5B39" /> : <Text style={styles.saveText}>Save</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Update Information</Text>
          </View>

          {isPartnerKitchen ? (
            <>
              <Field label="Kitchen Name" value={formData.kitchen_name} onChangeText={(t) => handleChange('kitchen_name', t)} />
              <Field label="Website URL" value={formData.website_url} onChangeText={(t) => handleChange('website_url', t)} keyboardType="url" />
              <Field label="Contact Person" value={formData.contact_person} onChangeText={(t) => handleChange('contact_person', t)} />
              <Field label="Position / Role" value={formData.position_role} onChangeText={(t) => handleChange('position_role', t)} />
            </>
          ) : isOrgType ? (
            <>
              <Field label="Organization Name" value={formData.organization_name} onChangeText={(t) => handleChange('organization_name', t)} />
              <Field label="Website URL" value={formData.website_url} onChangeText={(t) => handleChange('website_url', t)} keyboardType="url" />
              <Field label="Industry / Sector" value={formData.industry_sector} onChangeText={(t) => handleChange('industry_sector', t)} />
              <Field label="Organization Type" value={formData.organization_type} onChangeText={(t) => handleChange('organization_type', t)} />
              <Field label="First Name" value={formData.first_name} onChangeText={(t) => handleChange('first_name', t)} />
              <Field label="Last Name" value={formData.last_name} onChangeText={(t) => handleChange('last_name', t)} />
            </>
          ) : (
            <>
              <Field label="First Name" value={formData.first_name} onChangeText={(t) => handleChange('first_name', t)} />
              <Field label="Last Name" value={formData.last_name} onChangeText={(t) => handleChange('last_name', t)} />
              <Field label="Middle Initial" value={formData.middle_initial} onChangeText={(t) => handleChange('middle_initial', t)} maxLength={5} />
              <Field label="Suffix" value={formData.suffix} onChangeText={(t) => handleChange('suffix', t)} />
              <Field label="Date of Birth (YYYY-MM-DD)" value={formData.date_of_birth} onChangeText={(t) => handleChange('date_of_birth', t)} />
              <Field label="Gender" value={formData.gender} onChangeText={(t) => handleChange('gender', t)} />
              <Field label="House Number" value={formData.house_no} onChangeText={(t) => handleChange('house_no', t)} keyboardType="number-pad" />
              <Field label="Street" value={formData.street} onChangeText={(t) => handleChange('street', t)} />
              <Field label="Brgy." value={formData.barangay} onChangeText={(t) => handleChange('barangay', t)} />
              <Field label="City / Municipality" value={formData.city_municipality} onChangeText={(t) => handleChange('city_municipality', t)} />
              <Field label="Province / Region" value={formData.province_region} onChangeText={(t) => handleChange('province_region', t)} />
              <Field label="Postal / ZIP Code" value={formData.postal_zip_code} onChangeText={(t) => handleChange('postal_zip_code', t)} keyboardType="number-pad" />
            </>
          )}

          {/* Email — shared by all roles */}
          <Field label="Email Address" value={formData.email} onChangeText={(t) => handleChange('email', t)} keyboardType="email-address" />

          {/* Contact number — shared by all roles */}
          <View style={styles.pillBox}>
            <Text style={styles.pillLabel}>Contact Number</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#00592d', marginRight: 2 }}>+63</Text>
              <TextInput
                style={[styles.pillInput, { flex: 1 }]}
                value={formData.contact_number}
                keyboardType="phone-pad"
                maxLength={10}
                placeholder="9XXXXXXXXX"
                placeholderTextColor="#ccc"
                onChangeText={(t) => {
                  const cleaned = t.replace(/^\+63/, '').replace(/^0/, '').replace(/[^0-9]/g, '');
                  handleChange('contact_number', cleaned);
                }}
              />
            </View>
          </View>

          <View style={{ height: 40 }} />

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E1E9E4' },

  topNav: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 15, paddingHorizontal: 20, position: 'relative',
    marginTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 10 : 0
  },
  backButton: { width: 50, alignItems: 'flex-start' },
  pageTitle: { fontSize: 18, fontWeight: '800', color: '#00592d' },
  saveButton: { width: 50, alignItems: 'flex-end' },
  saveText: { fontSize: 16, fontWeight: '800', color: '#00592d' },

  scrollContent: { paddingHorizontal: 20, paddingTop: 10 },

  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, marginTop: 10 },
  sectionTitle: { fontSize: 22, fontWeight: '800', color: '#685D52', letterSpacing: -0.5 },

  pillBox: {
    backgroundColor: '#FFF', borderRadius: 16, paddingHorizontal: 20, paddingVertical: 12,
    marginBottom: 12, borderWidth: 1, borderColor: '#D1E6DA',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 3, elevation: 1
  },
  pillLabel: { fontSize: 11, fontWeight: '800', color: '#999', marginBottom: 6 },
  pillInput: { fontSize: 16, fontWeight: '700', color: '#00592d', padding: 0 },
});
