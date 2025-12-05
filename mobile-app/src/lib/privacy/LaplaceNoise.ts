import Constants from 'expo-constants';
import { PRIVACY_EPSILON, HOURS_SENSITIVITY } from './constants';

// Resolve a numeric seed from env/extra or return null if unset/invalid.
function resolveNoiseSeed(): number | null {
  const parseSeed = (raw: unknown): number | null => {
    const num = Number(raw);
    return Number.isFinite(num) ? num : null;
  };

  const envSeed = parseSeed((process as any)?.env?.TEST_PRIVACY_NOISE_SEED);
  if (envSeed !== null) return envSeed;

  const extraSeed = parseSeed((Constants.expoConfig as any)?.extra?.TEST_PRIVACY_NOISE_SEED);
  if (extraSeed !== null) return extraSeed;

  const globalSeed = parseSeed((globalThis as any)?.__TEST_PRIVACY_NOISE_SEED);
  if (globalSeed !== null) return globalSeed;

  return null;
}

function createSeededPrng(seed: number): () => number {
  // Lehmer RNG (mod 2^31-1), good enough for deterministic tests.
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

const seededRandom = (() => {
  const seed = resolveNoiseSeed();
  return seed === null ? null : createSeededPrng(seed);
})();

function sampleLaplace(scale: number): number {
  const random = seededRandom ?? Math.random;
  const u = random() - 0.5;
  return -scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
}

export function addLaplaceNoise(
  value: number,
  epsilon: number = PRIVACY_EPSILON,
  sensitivity: number = HOURS_SENSITIVITY,
): number {
  if (epsilon <= 0) {
    throw new Error('Epsilon must be positive for Laplace noise');
  }
  const scale = sensitivity / epsilon;
  return value + sampleLaplace(scale);
}

export function addLaplaceNoiseToMinutes(
  minutes: number,
  epsilon: number = PRIVACY_EPSILON,
  sensitivity: number = HOURS_SENSITIVITY,
): number {
  const hours = minutes / 60;
  const noisyHours = addLaplaceNoise(hours, epsilon, sensitivity);
  const noisyMinutes = Math.max(0, Math.round(noisyHours * 60));
  return noisyMinutes;
}
