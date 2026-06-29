import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, StatusBar, ImageBackground, Animated, Image, Easing, Dimensions } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';

const { width } = Dimensions.get('window');

// Responsive logo dimensions, proportional to original 350×120
const LOGO_WIDTH  = Math.min(width * 0.82, 350);
const LOGO_HEIGHT = LOGO_WIDTH * (120 / 350);

// Wave blob large enough to cover the logo on any screen
const WAVE_SIZE   = Math.max(width * 2, 800);
const WAVE_RADIUS = WAVE_SIZE * 0.4125; // keeps the squircle shape ratio

export default function LoadingPage({ navigation }: any) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;
  const fillAnim = useRef(new Animated.Value(0)).current;
  const [imageLoaded, setImageLoaded] = React.useState(false);

  useEffect(() => {
    // Entrance: fade-in + spring scale
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Organic wobble — continuous slow rotation
      Animated.loop(
        Animated.timing(waveAnim, {
          toValue: 1,
          duration: 3500,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();

      // Wave sweeps smoothly left → right across the logo
      Animated.timing(fillAnim, {
        toValue: 1,
        duration: 2400,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }).start();
    });

    // Fade out then navigate
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => navigation.replace('LandingPage'));
    }, 4200);

    return () => clearTimeout(timer);
  }, [navigation, fadeAnim, scaleAnim, waveAnim, fillAnim]);

  // Two counter-rotating blobs create the organic liquid edge
  const rotate1 = waveAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const rotate2 = waveAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['360deg', '0deg'],
  });

  // Start: wave blob entirely off-screen to the left; End: blob fully covers the logo
  const fillTranslateX = fillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-(LOGO_WIDTH + 100), 50],
  });

  return (
    <ImageBackground
      source={require('../../assets/images/backgrounds/registration_bg.png')}
      style={styles.background}
      resizeMode="cover"
    >
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.contentContainer,
            { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
          ]}
        >
          <MaskedView
            key={imageLoaded ? 'loaded' : 'loading'}
            androidRenderingMode="software"
            style={{ width: LOGO_WIDTH, height: LOGO_HEIGHT }}
            maskElement={
              <Image
                source={require('../../assets/images/logo/logowhite.png')}
                style={{ width: LOGO_WIDTH, height: LOGO_HEIGHT }}
                resizeMode="contain"
                onLoad={() => setImageLoaded(true)}
              />
            }
          >
            {/* Faint ghost so the logo is visible before the wave arrives */}
            <View style={[StyleSheet.absoluteFillObject, styles.logoBase]} />

            {/* Wave container — translates left→right to fill the logo */}
            <Animated.View
              style={[
                StyleSheet.absoluteFillObject,
                { transform: [{ translateX: fillTranslateX }] },
              ]}
            >
              <Animated.View
                style={[
                  styles.liquidWave,
                  { opacity: 0.65, transform: [{ rotate: rotate1 }] },
                ]}
              />
              <Animated.View
                style={[
                  styles.liquidWave,
                  { opacity: 1, transform: [{ rotate: rotate2 }] },
                ]}
              />
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
    backgroundColor: 'rgba(21, 88, 51, 0.78)',
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
  logoBase: {
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  liquidWave: {
    position: 'absolute',
    width: WAVE_SIZE,
    height: WAVE_SIZE,
    backgroundColor: '#FFFFFF',
    borderRadius: WAVE_RADIUS,
    // Vertically center the blob relative to the logo height
    top: -(WAVE_SIZE / 2 - LOGO_HEIGHT / 2),
    right: 0,
  },
});
