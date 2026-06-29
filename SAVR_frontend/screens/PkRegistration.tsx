import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiService } from '../services/api';

export default function PkRegistration({ navigation }: any) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    contact_number: '',
    address: '',
    kitchen_capacity: '',
    password: '',
    password_confirmation: '',
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleNext = async () => {
    const requiredFields = ['name', 'email', 'contact_number', 'password', 'password_confirmation'];
    const missingFields = [];
    for (const key of requiredFields) {
      if (!formData[key as keyof typeof formData]?.trim()) {
        const readable = key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        missingFields.push(readable);
      }
    }

    if (missingFields.length > 0) {
      Alert.alert('Missing Fields', `Please fill out the following required fields:\n• ${missingFields.join('\n• ')}`);
      return;
    }

    if (formData.password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters long.');
      return;
    }
    if (formData.password !== formData.password_confirmation) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      // Send verification code, which also checks for duplicate email
      await ApiService.sendVerificationEmail({ email: formData.email, name: formData.name });

      Alert.alert('Success', 'Verification code sent! Please check your email.');
      navigation.navigate('VerifyEmail', {
        ...formData,
        contact_number: formData.contact_number ? `+63${formData.contact_number}` : '',
        role: 'partner_kitchen',
        registrationType: 'partner_kitchen',
        targetDashboard: 'PkDashboard'
      });
    } catch (error: any) {
      Alert.alert('Registration Failed', error.response?.data?.message || 'Something went wrong.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardView}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.titleContainer}>
            <Text style={styles.titlePrefix}>Join as a </Text>
            <Text style={styles.titleHighlight}>Partner Kitchen</Text>
          </View>
          <Text style={styles.subtitle}>Help transform surplus ingredients into hot meals for the community.</Text>

          <View style={styles.formContainer}>
            <Text style={styles.label}>Kitchen Name / Establishment *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Community Kitchen Cafe"
              value={formData.name}
              onChangeText={(text) => handleChange('name', text)}
            />

            <Text style={styles.label}>Contact Email *</Text>
            <TextInput
              style={styles.input}
              placeholder="hello@kitchen.com"
              keyboardType="email-address"
              autoCapitalize="none"
              value={formData.email}
              onChangeText={(text) => handleChange('email', text)}
            />

            <Text style={styles.label}>Phone Number *</Text>
            <TextInput
              style={styles.input}
              placeholder="+63 912 345 6789"
              keyboardType="phone-pad"
              value={formData.contact_number}
              onChangeText={(text) => handleChange('contact_number', text)}
            />

            <Text style={styles.label}>Est. Daily Meal Capacity</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 100 meals"
              keyboardType="numeric"
              value={formData.kitchen_capacity}
              onChangeText={(text) => handleChange('kitchen_capacity', text)}
            />

            <Text style={styles.label}>Kitchen Address</Text>
            <TextInput
              style={styles.input}
              placeholder="Where is your kitchen located?"
              value={formData.address}
              onChangeText={(text) => handleChange('address', text)}
            />

            <Text style={styles.label}>Password *</Text>
            <TextInput
              style={styles.input}
              placeholder="Min 8 characters"
              secureTextEntry
              value={formData.password}
              onChangeText={(text) => handleChange('password', text)}
            />

            <Text style={styles.label}>Confirm Password *</Text>
            <TextInput
              style={styles.input}
              placeholder="Re-enter password"
              secureTextEntry
              value={formData.password_confirmation}
              onChangeText={(text) => handleChange('password_confirmation', text)}
            />

            <TouchableOpacity style={styles.button} onPress={handleNext} disabled={isLoading}>
              {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Next Step →</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  keyboardView: { flex: 1 },
  header: { padding: 20, paddingTop: 10 },
  backButton: { alignSelf: 'flex-start' },
  backText: { fontSize: 16, color: '#333', fontWeight: '600' },
  scrollContent: { paddingHorizontal: 25, paddingBottom: 50 },
  titleContainer: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 5, flexWrap: 'wrap' },
  titlePrefix: { fontSize: 24, fontWeight: '800', color: '#222' },
  titleHighlight: { fontSize: 28, fontWeight: '800', color: '#F57C00' },
  subtitle: { fontSize: 15, color: '#666', marginBottom: 30, lineHeight: 22 },
  formContainer: {
    backgroundColor: '#fff', borderRadius: 20, padding: 25,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.05, shadowRadius: 15, elevation: 3,
  },
  label: { fontSize: 14, fontWeight: '600', color: '#444', marginBottom: 8 },
  input: {
    backgroundColor: '#f4f5f7', height: 50, borderRadius: 12, paddingHorizontal: 16,
    fontSize: 16, color: '#333', marginBottom: 20,
  },
  button: {
    backgroundColor: '#F57C00', height: 56, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center', marginTop: 10,
  },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
