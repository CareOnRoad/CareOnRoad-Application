import nativewindConfig from './nativewind.config';



// NativeWind (used by Metro withNativeWind) requires a `tailwind.config.ts` file
// at the project root to be picked up by tailwindcss/loadConfig. We re-export the
// NativeWind preset config so both Metro and Tailwind CLI resolve the same styles.
const config = {
  ...nativewindConfig,
  presets: nativewindConfig.presets,
};

export default config;
