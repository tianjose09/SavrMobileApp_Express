import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, SafeAreaView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ApiService } from '../../services/api';
import { StorageUtils, StorageKeys } from '../../utils/storage';

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
    // Partner kitchen fields
    kitchen_name: profile.kitchen_name || '',
    contact_person: profile.contact_person || '',
    position_role: profile.position_role || '',
    // Shared
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

  const Field = ({ label, field, keyboardType = 'default', maxLength }: { label: string; field: string; keyboardType?: any; maxLength?: number }) => (
    <View style={styles.pillBox}>
      <Text style={styles.pillLabel}>{label}</Text>
      <TextInput
        style={styles.pillInput}
        value={(formData as any)[field]}
        onChangeText={(t) => handleChange(field, t)}
        keyboardType={keyboardType}
        maxLength={maxLength}
      />
    </View>
  );

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
              <Field label="Kitchen Name" field="kitchen_name" />
              <Field label="Contact Person" field="contact_person" />
              <Field label="Position / Role" field="position_role" />
              <Field label="Website URL" field="website_url" keyboardType="url" />
            </>
          ) : isOrgType ? (
            <>
              <Field label="Organization Name" field="organization_name" />
              <Field label="City / Municipality" field="city_municipality" />
              <Field label="Website URL" field="website_url" keyboardType="url" />
            </>
          ) : (
            <>
              <Field label="First Name" field="first_name" />
              <Field label="Last Name" field="last_name" />
              <Field label="Middle Initial" field="middle_initial" maxLength={5} />
              <Field label="Suffix" field="suffix" />
              <Field label="Date of Birth (YYYY-MM-DD)" field="date_of_birth" />
              <Field label="Gender" field="gender" />
              <Field label="House #" field="house_no" keyboardType="number-pad" />
              <Field label="Street" field="street" />
              <Field label="Brgy." field="barangay" />
              <Field label="City / Municipality" field="city_municipality" />
              <Field label="Province / Region" field="province_region" />
              <Field label="Postal / ZIP Code" field="postal_zip_code" keyboardType="number-pad" />
            </>
          )}

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
    marginTop: Platform.OS === 'android' ? 20 : 0
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
