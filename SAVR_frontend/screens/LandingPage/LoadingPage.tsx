import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, StatusBar, ImageBackground, Animated, Image, Easing } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';

export default function LoadingPage({ navigation }: any) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;
  const fillAnim = useRef(new Animated.Value(0)).current;

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
      // Rotation for the liquid wave wobble
      Animated.loop(
        Animated.timing(waveAnim, {
          toValue: 1,
          duration: 3500, // Slow, rolling wave speed
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();

      // Sweep the wave from left to right to fill the logo
      Animated.timing(fillAnim, {
        toValue: 1,
        duration: 3800, // Duration of the fill
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }).start();
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
    }, 4500); // Give enough time to watch the logo fill up with the liquid wave

    return () => clearTimeout(timer);
  }, [navigation, fadeAnim, scaleAnim, waveAnim, fillAnim]);

  // Rotations to create the organic liquid wave shape
  const rotate1 = waveAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const rotate2 = waveAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['360deg', '0deg'],
  });

  // Translate container to slide the wave over the logo from left to right
  const fillTranslateX = fillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-450, 50], 
  });

  return (
    <ImageBackground
      source={require('../../assets/images/backgrounds/registration_bg.png')}
      style={styles.background}
      resizeMode="cover"
    >
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      {/* Green tint overlay */}
      <View style={styles.overlay}>
        <Animated.View style={[styles.contentContainer, { 
          opacity: fadeAnim, 
          transform: [{ scale: scaleAnim }] 
        }]}>
          
          <MaskedView
            style={styles.maskedView}
            maskElement={
              <Image 
                source={require('../../assets/images/logo/logowhite.png')} 
                style={styles.logo}
                resizeMode="contain"
              />
            }
          >
            {/* The base appearance of the logo (faint outline) */}
            <View style={styles.logoBase} />
            
            {/* Liquid wave container that sweeps from left to right */}
            <Animated.View style={[StyleSheet.absoluteFillObject, { transform: [{ translateX: fillTranslateX }] }]}>
              {/* Back liquid layer (slightly transparent) */}
              <Animated.View style={[styles.liquidWave, { opacity: 0.6, transform: [{ rotate: rotate1 }] }]} />
              {/* Front liquid layer (solid white) */}
              <Animated.View style={[styles.liquidWave, { opacity: 1, transform: [{ rotate: rotate2 }] }]} />
            </Animated.View>
          </MaskedView>

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
  contentContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 10,
  },
  maskedView: {
    width: 350,
    height: 120,
  },
  logo: {
    width: 350,
    height: 120,
    backgroundColor: 'transparent',
  },
  logoBase: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.25)', 
  },
  liquidWave: {
    position: 'absolute',
    width: 800,
    height: 800,
    backgroundColor: '#FFFFFF',
    borderRadius: 330, // Creates a 'squircle' shape. When rotated, its edge wobbles like an organic wave
    top: -340, // Centered vertically relative to the 120px tall logo (120/2 - 400 = -340)
    right: 0, // The right edge of this shape acts as the crashing wave
  }
});
