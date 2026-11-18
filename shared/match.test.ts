import { describe, expect, it } from 'vitest';
import { evaluateMatch } from './match';

const base = { killLimit: 15, now: 1000, endsAt: 5000 };

describe('evaluateMatch', () => {
  it('keeps playing below the limit and before time', () =>
    expect(evaluateMatch({ ...base, score: { red: 14, blue: 3 } })).toEqual({ over: false }));
  it('first team to the kill limit wins', () => {
    expect(evaluateMatch({ ...base, score: { red: 15, blue: 3 } })).toEqual({ over: true, winner: 'red' });
    expect(evaluateMatch({ ...base, score: { red: 2, blue: 15 } })).toEqual({ over: true, winner: 'blue' });
  });
  it('at time, the higher score wins', () => {
    expect(evaluateMatch({ ...base, now: 5000, score: { red: 4, blue: 7 } })).toEqual({ over: true, winner: 'blue' });
    expect(evaluateMatch({ ...base, now: 9999, score: { red: 8, blue: 7 } })).toEqual({ over: true, winner: 'red' });
  });
  it('equal score at time is a draw', () =>
    expect(evaluateMatch({ ...base, now: 5000, score: { red: 5, blue: 5 } })).toEqual({ over: true, winner: null }));
  it('time not yet reached by one ms is still running', () =>
    expect(evaluateMatch({ ...base, now: 4999, score: { red: 5, blue: 5 } })).toEqual({ over: false }));
});
