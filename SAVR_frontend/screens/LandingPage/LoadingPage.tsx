import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, StatusBar, ImageBackground, Animated, Easing } from 'react-native';

export default function LoadingPage({ navigation }: any) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Initial entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Continuous gentle pulse animation after entrance
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    });

    // Fade out and navigate to LandingPage
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        navigation.replace('LandingPage');
      });
    }, 1800);

    return () => clearTimeout(timer);
  }, [navigation, fadeAnim, scaleAnim, pulseAnim]);

  return (
    <ImageBackground
      source={require('../../assets/images/backgrounds/registration_bg.png')}
      style={styles.background}
      resizeMode="cover"
    >
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      {/* Green tint overlay */}
      <View style={styles.overlay}>
        <Animated.View style={[styles.logoContainer, { 
          opacity: fadeAnim, 
          transform: [
            { scale: scaleAnim },
            { scale: pulseAnim }
          ] 
        }]}>
          <Animated.Image 
            source={require('../../assets/images/logo/logowhite.png')} 
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>
      </View>
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
    flex: 1,
    backgroundColor: 'rgba(21, 88, 51, 0.78)', // Deep, rich green overlay
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 10,
  },
  logo: {
    width: 350,
    height: 120,
  }
});
