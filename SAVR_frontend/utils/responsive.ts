import { Dimensions, PixelRatio } from 'react-native';

const { width: W, height: H } = Dimensions.get('window');

const BASE_W = 390;
const scale = Math.min(W / BASE_W, 1.3);

export const wp = (pct: number) => W * pct / 100;
export const hp = (pct: number) => H * pct / 100;
export const rs = (size: number) =>
  Math.round(PixelRatio.roundToNearestPixel(size * scale));

export const SW = W;
export const SH = H;

/**
 * Minimum bottom clearance for screens that sit above the tab bar.
 * Tab bar (70) + Android gesture/button nav area (up to 50) + buffer (10).
 */
export const TAB_BOTTOM_CLEAR = 130;
