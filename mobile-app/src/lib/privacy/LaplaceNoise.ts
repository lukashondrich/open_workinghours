import { PRIVACY_EPSILON, HOURS_SENSITIVITY } from './constants';

function sampleLaplace(scale: number): number {
  const u = Math.random() - 0.5;
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
