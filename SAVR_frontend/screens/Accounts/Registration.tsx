import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ImageBackground, Platform, Dimensions, Image, StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

const COLORS = {
  yellow: '#F4B942',
};

const FONT_FAMILY = Platform.OS === 'ios' ? 'System' : 'sans-serif';

export default function Registration({ navigation }: any) {
  return (
    <ImageBackground
      source={require('../../assets/images/backgrounds/registration_bg.png')}
      style={styles.background}
      resizeMode="cover"
    >
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      <SafeAreaView style={styles.safeArea}>
        {/* BACK BUTTON */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation?.goBack?.()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={26} color="#FFF" />
        </TouchableOpacity>

        <View style={styles.container}>
          {/* LOGO */}
          <View style={styles.logoContainer}>
            <Image
              source={require('../../assets/images/logo/logowhite.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          {/* TITLE */}
          <View style={styles.titleContainer}>
            <Text style={styles.mainTitle}>
              CHOOSE YOUR <Text style={styles.highlight}>ROLE</Text>
            </Text>

            <Text style={styles.subtitle}>
              Select your role to create an account.
            </Text>
          </View>

          {/* DONOR CARD */}
          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.cardWrapper}
            onPress={() => navigation.navigate('DonorRegistration')}
          >
            <Image
              source={require('../../assets/images/cards/donor_card.png')}
              style={styles.cardImage}
              resizeMode="contain"
            />
          </TouchableOpacity>

          {/* BENEFICIARY CARD */}
          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.cardWrapper}
            onPress={() => navigation.navigate('BeneficiaryRegistration')}
          >
            <Image
              source={require('../../assets/images/cards/beneficiary_card.png')}
              style={styles.cardImage}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>
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

  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 55 : 40,
    left: 15,
    zIndex: 999,
    padding: 10,
  },

  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },

  logoContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },

  logo: {
    width: 300,
    height: 100,
  },

  titleContainer: {
    alignItems: 'center',
    marginBottom: 35,
  },

  mainTitle: {
    fontFamily: FONT_FAMILY,
    fontSize: 30,
    fontWeight: '800',
    color: '#FFF',
    textAlign: 'center',
    letterSpacing: 0.5,
  },

  highlight: {
    color: COLORS.yellow,
  },

  subtitle: {
    fontFamily: FONT_FAMILY,
    color: '#FFF',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },

  cardWrapper: {
    alignItems: 'center',
    marginBottom: 20,
  },

  cardImage: {
    width: width * 0.85,
    height: width * 0.42,
  },
});