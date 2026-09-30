import React, {useEffect, useRef, useState} from 'react';
import {Animated, Easing} from 'react-native';
import BootSplash from 'react-native-bootsplash';
import {useWardrobeContext} from '../state/WardrobeContext';

const manifest = require('../assets/bootsplash/manifest.json');
const logoSource = require('../assets/bootsplash/logo.png');

const FADE_IN = 500;
const HOLD = 400;
const FADE_OUT = 450;

/**
 * Takes over from the plain white native launch screen: the hanger fades in
 * (growing slightly into place), holds, then fades out once the saved
 * wardrobe has loaded, and the white fades after it to reveal the app.
 */
export function SplashScreen() {
  const {wardrobe} = useWardrobeContext();
  // 0 = hidden, 1 = shown, 2 = gone.
  const [logo] = useState(() => new Animated.Value(0));
  const [backdrop] = useState(() => new Animated.Value(1));
  const [shown, setShown] = useState(false);
  const [done, setDone] = useState(false);
  const leaving = useRef(false);

  const {container, logo: logoProps} = BootSplash.useHideAnimation({
    manifest,
    logo: logoSource,
    animate: () => {
      Animated.sequence([
        Animated.timing(logo, {
          toValue: 1,
          duration: FADE_IN,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(HOLD),
      ]).start(() => setShown(true));
    },
  });

  useEffect(() => {
    if (!shown || !wardrobe.loaded || leaving.current) {
      return;
    }
    leaving.current = true;
    Animated.parallel([
      Animated.timing(logo, {
        toValue: 2,
        duration: FADE_OUT,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(backdrop, {
        toValue: 0,
        duration: 350,
        delay: FADE_OUT - 150,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => setDone(true));
  }, [shown, wardrobe.loaded, logo, backdrop]);

  if (done) {
    return null;
  }
  const opacity = logo.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0, 1, 0],
  });
  const scale = logo.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0.9, 1, 1.08],
  });
  return (
    <Animated.View {...container} style={[container.style, {opacity: backdrop}]}>
      <Animated.Image
        {...logoProps}
        style={[logoProps.style, {opacity, transform: [{scale}]}]}
      />
    </Animated.View>
  );
}
