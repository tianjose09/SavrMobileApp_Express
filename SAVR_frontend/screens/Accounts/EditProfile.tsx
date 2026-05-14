import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, SafeAreaView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ApiService } from '../../services/api';
import { StorageUtils, StorageKeys } from '../../utils/storage';

export default function EditProfile({ route, navigation }: any) {
  const profile = route.params?.profile || {};

  const [formData, setFormData] = useState({
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
    contact_number: (profile.contact_number || '').replace(/^\+63/, ''),
  });

  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!formData.first_name || !formData.last_name) {
      Alert.alert('Error', 'First and Last name are required.');
      return;
    }

    setIsLoading(true);
    try {
      // Reconstitute 'name' field combining parts for standard legacy backend
      const payload = {
        ...formData,
        name: `${formData.first_name} ${formData.last_name}`.trim(),
        // Always store with +63 prefix
        contact_number: formData.contact_number
          ? `+63${formData.contact_number.replace(/^\+63/, '').replace(/^0/, '')}`
          : '',
      };

      const response = await ApiService.updateProfile(payload);
      if (response.data.success) {
        await StorageUtils.setItem(StorageKeys.DISPLAY_NAME, payload.name);
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

        {/* Top Navigation Bar */}
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

          {/* Dynamic Input Pills */}
          <View style={styles.pillBox}>
            <Text style={styles.pillLabel}>First Name</Text>
            <TextInput
              style={styles.pillInput}
              value={formData.first_name}
              onChangeText={(t) => handleChange('first_name', t)}
            />
          </View>

          <View style={styles.pillBox}>
            <Text style={styles.pillLabel}>Last Name</Text>
            <TextInput
              style={styles.pillInput}
              value={formData.last_name}
              onChangeText={(t) => handleChange('last_name', t)}
            />
          </View>

          <View style={styles.pillBox}>
            <Text style={styles.pillLabel}>Middle Initial</Text>
            <TextInput
              style={styles.pillInput}
              value={formData.middle_initial}
              onChangeText={(t) => handleChange('middle_initial', t)}
              maxLength={5}
            />
          </View>

          <View style={styles.pillBox}>
            <Text style={styles.pillLabel}>Suffix</Text>
            <TextInput
              style={styles.pillInput}
              value={formData.suffix}
              onChangeText={(t) => handleChange('suffix', t)}
            />
          </View>

          <View style={styles.pillBox}>
            <Text style={styles.pillLabel}>Date of Birth (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.pillInput}
              value={formData.date_of_birth}
              onChangeText={(t) => handleChange('date_of_birth', t)}
            />
          </View>

          <View style={styles.pillBox}>
            <Text style={styles.pillLabel}>Gender</Text>
            <TextInput
              style={styles.pillInput}
              value={formData.gender}
              onChangeText={(t) => handleChange('gender', t)}
            />
          </View>

          <View style={styles.pillBox}>
            <Text style={styles.pillLabel}>House #</Text>
            <TextInput
              style={styles.pillInput}
              value={formData.house_no}
              keyboardType="number-pad"
              onChangeText={(t) => handleChange('house_no', t)}
            />
          </View>

          <View style={styles.pillBox}>
            <Text style={styles.pillLabel}>Street</Text>
            <TextInput
              style={styles.pillInput}
              value={formData.street}
              onChangeText={(t) => handleChange('street', t)}
            />
          </View>

          <View style={styles.pillBox}>
            <Text style={styles.pillLabel}>Brgy.</Text>
            <TextInput
              style={styles.pillInput}
              value={formData.barangay}
              onChangeText={(t) => handleChange('barangay', t)}
            />
          </View>

          <View style={styles.pillBox}>
            <Text style={styles.pillLabel}>City / Municipality</Text>
            <TextInput
              style={styles.pillInput}
              value={formData.city_municipality}
              onChangeText={(t) => handleChange('city_municipality', t)}
            />
          </View>

          <View style={styles.pillBox}>
            <Text style={styles.pillLabel}>Province / Region</Text>
            <TextInput
              style={styles.pillInput}
              value={formData.province_region}
              onChangeText={(t) => handleChange('province_region', t)}
            />
          </View>

          <View style={styles.pillBox}>
            <Text style={styles.pillLabel}>Postal / ZIP Code</Text>
            <TextInput
              style={styles.pillInput}
              value={formData.postal_zip_code}
              keyboardType="number-pad"
              onChangeText={(t) => handleChange('postal_zip_code', t)}
            />
          </View>

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
                  // Strip leading 0 or +63 if user pastes full number
                  const cleaned = t.replace(/^\+63/, '').replace(/^0/, '').replace(/[^0-9]/g, '');
                  handleChange('contact_number', cleaned);
                }}
              />
            </View>
          </View>

          {/* Removed bottom tab spacer */}
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
  infoBadge: { backgroundColor: '#E4F1EB', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  infoBadgeText: { color: '#00592d', fontWeight: 'bold', fontSize: 11 },

  pillBox: {
    backgroundColor: '#FFF', borderRadius: 16, paddingHorizontal: 20, paddingVertical: 12,
    marginBottom: 12, borderWidth: 1, borderColor: '#D1E6DA',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 3, elevation: 1
  },
  pillLabel: { fontSize: 11, fontWeight: '800', color: '#999', marginBottom: 6 },
  pillInput: {
    fontSize: 16, fontWeight: '700', color: '#00592d', padding: 0,
  },
});
