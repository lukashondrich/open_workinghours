import { addLaplaceNoise, addLaplaceNoiseToMinutes } from '../LaplaceNoise';

describe('Laplace noise helpers', () => {
  it('produces varying values per call', () => {
    const base = 40;
    const samples = new Set<number>();
    for (let i = 0; i < 8; i += 1) {
      samples.add(addLaplaceNoise(base, 1, 4));
    }
    expect(samples.size).toBeGreaterThan(1);
  });

  it('keeps sample mean near original value over many trials', () => {
    const base = 32;
    const iterations = 6000;
    let sum = 0;
    for (let i = 0; i < iterations; i += 1) {
      sum += addLaplaceNoise(base, 1, 4);
    }
    const avg = sum / iterations;
    expect(Math.abs(avg - base)).toBeLessThan(2);
  });

  it('returns non-negative minute totals', () => {
    const noisy = addLaplaceNoiseToMinutes(0);
    expect(noisy).toBeGreaterThanOrEqual(0);
  });
});
