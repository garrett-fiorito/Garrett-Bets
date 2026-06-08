import type { BetStatus } from '../types';

export type BetMath = {
  decimalOdds: number;
  americanOdds: number;
  profit: number;
  totalReturn: number;
};

export function americanToDecimal(odds: number): number {
  if (!Number.isFinite(odds) || odds === 0 || Math.abs(odds) < 100) {
    throw new Error('American odds must be <= -100 or >= 100.');
  }

  return odds > 0 ? 1 + odds / 100 : 1 + 100 / Math.abs(odds);
}

export function decimalToAmerican(decimalOdds: number): number {
  if (!Number.isFinite(decimalOdds) || decimalOdds <= 1) {
    throw new Error('Decimal odds must be greater than 1.');
  }

  return decimalOdds >= 2
    ? Math.round((decimalOdds - 1) * 100)
    : Math.round(-100 / (decimalOdds - 1));
}

export function calculateBet(stake: number, odds: number[]): BetMath {
  if (!Number.isFinite(stake) || stake < 0) {
    throw new Error('Stake must be a positive number.');
  }

  if (odds.length === 0) {
    return {
      decimalOdds: 0,
      americanOdds: 0,
      profit: 0,
      totalReturn: stake,
    };
  }

  const decimalOdds = odds.reduce((product, legOdds) => product * americanToDecimal(legOdds), 1);
  const totalReturn = stake * decimalOdds;

  return {
    decimalOdds,
    americanOdds: decimalToAmerican(decimalOdds),
    profit: totalReturn - stake,
    totalReturn,
  };
}

export function settledAmounts(status: BetStatus, stake: number, odds: number[]) {
  const projected = calculateBet(stake, odds);

  if (status === 'lost') {
    return { profit: -stake, totalReturn: 0 };
  }

  if (status === 'push' || status === 'void') {
    return { profit: 0, totalReturn: stake };
  }

  return {
    profit: projected.profit,
    totalReturn: projected.totalReturn,
  };
}

export function formatAmericanOdds(odds: number): string {
  if (odds === 0) return '--';
  return odds > 0 ? `+${odds}` : `${odds}`;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(amount);
}
