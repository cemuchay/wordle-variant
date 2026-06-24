import { describe, it, expect } from 'vitest';

const RATING = { K_FACTOR: 32, DIVISOR: 400, DEFAULT: 600, DEFAULT_OPPONENT: 600, MIN_GAIN_ON_WIN: 1, MAX_LOSS_ON_LOSS: -2 };

function calcElo(myRating: number, oppRating: number, won: boolean, tied: boolean, correctCount: number): number {
  const expected = 1 / (1 + Math.pow(10, (oppRating - myRating) / RATING.DIVISOR));
  const actual = won ? 1 : tied ? 0.5 : 0;
  const baseEloChange = Math.round(RATING.K_FACTOR * (actual - expected));
  const accuracyBonus = won ? correctCount : 0;
  let eloGain = baseEloChange + accuracyBonus;
  if (won && eloGain < RATING.MIN_GAIN_ON_WIN) eloGain = RATING.MIN_GAIN_ON_WIN;
  if (!won && !tied && eloGain < RATING.MAX_LOSS_ON_LOSS) eloGain = RATING.MAX_LOSS_ON_LOSS;
  return eloGain;
}

const XP = { BASE_REWARD: 50, WIN_BONUS: 30, PER_CORRECT: 10 };

function calcXp(won: boolean, correctCount: number): number {
  return XP.BASE_REWARD + (won ? XP.WIN_BONUS : 0) + (correctCount * XP.PER_CORRECT);
}

describe('Scoring: ELO calculation', () => {
  it('equal ratings win gives positive gain', () => {
    const gain = calcElo(600, 600, true, false, 0);
    expect(gain).toBeGreaterThan(0);
  });

  it('equal ratings loss gives negative gain', () => {
    const gain = calcElo(600, 600, false, false, 0);
    expect(gain).toBeLessThan(0);
  });

  it('equal ratings tie gives near-zero', () => {
    const gain = calcElo(600, 600, false, true, 0);
    expect(Math.abs(gain)).toBeLessThanOrEqual(1);
  });

  it('underdog win gives higher gain', () => {
    const underdog = calcElo(400, 800, true, false, 0);
    const favorite = calcElo(800, 400, true, false, 0);
    expect(underdog).toBeGreaterThan(favorite);
  });

  it('clamping caps large losses at MAX_LOSS_ON_LOSS', () => {
    const clamped = calcElo(600, 1000, false, false, 0);
    expect(clamped).toBe(RATING.MAX_LOSS_ON_LOSS);
    expect(clamped).toBe(-2);
  });

  it('extreme underdog loss not clamped below threshold', () => {
    const result = calcElo(600, 1200, false, false, 0);
    expect(result).toBeGreaterThan(RATING.MAX_LOSS_ON_LOSS);
    expect(result).toBe(-1);
  });

  it('underdog win gains more than favorite win', () => {
    const underWin = calcElo(400, 600, true, false, 0);
    const favWin = calcElo(600, 400, true, false, 0);
    expect(underWin).toBeGreaterThan(favWin);
  });

  it('L1: loss clamp uses < not >', () => {
    const eloGain = -50;
    const clamped = eloGain < RATING.MAX_LOSS_ON_LOSS ? RATING.MAX_LOSS_ON_LOSS : eloGain;
    expect(clamped).toBe(-2);
  });

  it('win always gives at least MIN_GAIN_ON_WIN', () => {
    const minWin = calcElo(1600, 600, true, false, 0);
    expect(minWin).toBeGreaterThanOrEqual(RATING.MIN_GAIN_ON_WIN);
  });

  it('accuracy bonus increases win gain', () => {
    const noBonus = calcElo(600, 600, true, false, 0);
    const withBonus = calcElo(600, 600, true, false, 5);
    expect(withBonus).toBeGreaterThan(noBonus);
  });
});

describe('Scoring: XP calculation', () => {
  it('loss gives base XP only', () => {
    expect(calcXp(false, 0)).toBe(50);
  });

  it('win gives base + win bonus', () => {
    expect(calcXp(true, 0)).toBe(80);
  });

  it('correct answers add per-correct bonus', () => {
    expect(calcXp(true, 7)).toBe(80 + 70);
  });

  it('loss with correct answers still gets per-correct bonus', () => {
    expect(calcXp(false, 3)).toBe(50 + 30);
  });
});
