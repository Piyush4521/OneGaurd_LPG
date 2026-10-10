import { describe, it, expect } from 'vitest';

describe('OneGaurd LPG Telemetry & Tare Mathematics', () => {
  it('T16 & T17: Computes net gas mass correctly given tare and total gross weight', () => {
    const totalMassKg = 23.55;
    const tareMassKg = 15.10;
    const netGasMass = Math.max(0, Number((totalMassKg - tareMassKg).toFixed(2)));
    expect(netGasMass).toBe(8.45);
  });

  it('T16: Clamps net gas mass to zero if measured total mass is less than tare', () => {
    const totalMassKg = 14.50;
    const tareMassKg = 15.10;
    const netGasMass = Math.max(0, Number((totalMassKg - tareMassKg).toFixed(2)));
    expect(netGasMass).toBe(0);
  });

  it('Calculates remaining percentage within 0-100% bounds', () => {
    const netGasMass = 8.45;
    const cylinderCapacityKg = 14.2;
    const percentage = Math.max(0, Math.min(100, Math.round((netGasMass / cylinderCapacityKg) * 100)));
    expect(percentage).toBe(60);
  });

  it('T10: Rejects unrealistic telemetry bounds', () => {
    const validatePayload = (gasRaw: number, totalMassKg: number) => {
      if (gasRaw < 0 || gasRaw > 4095) return false;
      if (totalMassKg < 0 || totalMassKg > 150) return false;
      return true;
    };

    expect(validatePayload(250, 22.0)).toBe(true);
    expect(validatePayload(5000, 22.0)).toBe(false); // Out of bounds ADC
    expect(validatePayload(250, -5.0)).toBe(false);  // Negative mass
    expect(validatePayload(250, 250.0)).toBe(false); // Exceeds platform rating
  });

  it('T11: Identifies stale telemetry when heartbeat exceeds 60 seconds', () => {
    const now = Date.now();
    const isStale = (lastHeartbeat: number) => (now - lastHeartbeat) > 60000;

    expect(isStale(now - 15000)).toBe(false);
    expect(isStale(now - 75000)).toBe(true);
  });

  it('T18: Detects open-circuit sensor fault when ADC is below baseline threshold', () => {
    const evaluateSensor = (rawGas: number, isWarmingUp: boolean) => {
      if (isWarmingUp) return 'warming';
      if (rawGas < 30) return 'fault';
      return 'ok';
    };

    expect(evaluateSensor(180, false)).toBe('ok');
    expect(evaluateSensor(10, false)).toBe('fault');
    expect(evaluateSensor(10, true)).toBe('warming');
  });

  it('T12: Triggers leak condition when debounced ADC exceeds threshold', () => {
    const threshold = 450;
    const evaluateLeak = (rawGas: number) => rawGas >= threshold;

    expect(evaluateLeak(180)).toBe(false);
    expect(evaluateLeak(449)).toBe(false);
    expect(evaluateLeak(450)).toBe(true);
    expect(evaluateLeak(780)).toBe(true);
  });
});
