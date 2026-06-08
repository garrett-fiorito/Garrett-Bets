import { describe, expect, it } from 'vitest';
import { americanToDecimal, calculateBet, decimalToAmerican, settledAmounts } from './odds';

describe('odds math', () => {
  it('converts American odds to decimal odds', () => {
    expect(americanToDecimal(150)).toBeCloseTo(2.5);
    expect(americanToDecimal(-110)).toBeCloseTo(1.90909);
  });

  it('converts decimal odds to American odds', () => {
    expect(decimalToAmerican(2.5)).toBe(150);
    expect(decimalToAmerican(1.90909)).toBe(-110);
  });

  it('calculates single payouts', () => {
    const bet = calculateBet(100, [-110]);

    expect(bet.americanOdds).toBe(-110);
    expect(bet.profit).toBeCloseTo(90.91);
    expect(bet.totalReturn).toBeCloseTo(190.91);
  });

  it('calculates parlay payouts by multiplying decimal leg odds', () => {
    const bet = calculateBet(100, [-110, 150, 200]);

    expect(bet.decimalOdds).toBeCloseTo(14.31818);
    expect(bet.americanOdds).toBe(1332);
    expect(bet.profit).toBeCloseTo(1331.82);
    expect(bet.totalReturn).toBeCloseTo(1431.82);
  });

  it('settles losses, pushes, and wins', () => {
    expect(settledAmounts('lost', 50, [120])).toEqual({ profit: -50, totalReturn: 0 });
    expect(settledAmounts('push', 50, [120])).toEqual({ profit: 0, totalReturn: 50 });
    expect(settledAmounts('won', 50, [120]).profit).toBeCloseTo(60);
  });
});
