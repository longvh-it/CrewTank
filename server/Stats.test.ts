import { describe, expect, it } from 'vitest';
import { ASSIST_WINDOW_SEC } from '@crew-tanks/shared/constants';
import { Stats } from './Stats';

function setup() {
  const s = new Stats();
  s.registerTank({ id: 'red-1', driverId: 'rd', gunnerId: 'rg' }); // duo
  s.registerTank({ id: 'red-2', driverId: 'rs', gunnerId: null }); // solo
  s.registerTank({ id: 'blue-1', driverId: 'bd', gunnerId: 'bg' }); // duo
  return s;
}
const get = (s: Stats, id: string) => {
  const p = s.results().find((r) => r.playerId === id);
  if (!p) throw new Error(`no player ${id}`);
  return p;
};

describe('Stats', () => {
  it('registers every crew member once', () => {
    expect(setup().results().map((r) => r.playerId).sort()).toEqual(['bd', 'bg', 'rd', 'rg', 'rs']);
  });

  it('kills and deaths count for both crew members of a duo', () => {
    const s = setup();
    s.recordKill('red-1', 'blue-1', 1000);
    expect(get(s, 'rd').kills).toBe(1);
    expect(get(s, 'rg').kills).toBe(1);
    expect(get(s, 'bd').deaths).toBe(1);
    expect(get(s, 'bg').deaths).toBe(1);
    expect(get(s, 'rs').kills).toBe(0);
  });

  it('shots, hits and damage go to the gunner of a duo, to the only player of a solo', () => {
    const s = setup();
    s.recordShot('red-1');
    s.recordShot('red-1');
    s.recordHit('red-1', 'blue-1', 20, 1000);
    s.recordShot('red-2');
    s.recordHit('red-2', 'blue-1', 20, 1000);
    expect(get(s, 'rg')).toMatchObject({ shots: 2, hits: 1, damage: 20 });
    expect(get(s, 'rd')).toMatchObject({ shots: 0, hits: 0, damage: 0 });
    expect(get(s, 'rs')).toMatchObject({ shots: 1, hits: 1, damage: 20 });
  });

  it('assist: damage within the window by another tank counts for its whole crew, not for the killer', () => {
    const s = setup();
    s.recordHit('red-2', 'blue-1', 20, 1000);
    s.recordHit('red-1', 'blue-1', 20, 2000);
    s.recordKill('red-1', 'blue-1', 3000);
    expect(get(s, 'rs').assists).toBe(1);
    expect(get(s, 'rd').assists).toBe(0);
  });

  it('no assist when the damage is older than the assist window', () => {
    const s = setup();
    s.recordHit('red-2', 'blue-1', 20, 1000);
    s.recordKill('red-1', 'blue-1', 1000 + ASSIST_WINDOW_SEC * 1000 + 1);
    expect(get(s, 'rs').assists).toBe(0);
  });

  it('assists are cleared after a death', () => {
    const s = setup();
    s.recordHit('red-2', 'blue-1', 20, 1000);
    s.recordKill('red-1', 'blue-1', 1500);
    s.recordKill('red-1', 'blue-1', 2000);
    expect(get(s, 'rs').assists).toBe(1);
  });
});

describe('awards', () => {
  it('MVP: kill = 3, assist = 1, damage / 50', () => {
    const s = setup();
    s.recordHit('red-2', 'blue-1', 100, 0); // rs: 2 pts from damage
    s.recordHit('red-1', 'blue-1', 20, 0);
    s.recordKill('red-1', 'blue-1', 100); // rd, rg: 3 pts each; rs gets assist (+1)
    const a = s.awards(60);
    // rg: 3 + 20/50 = 3.4 ; rd: 3 ; rs: 100/50 + 1 = 3
    expect(a.mvp).toBe('rg');
  });

  it('no MVP before anything happened', () => expect(setup().awards(60).mvp).toBeUndefined());

  it('Tay lái lụa: the pilot hit least often wins', () => {
    const s = setup();
    s.recordHit('blue-1', 'red-1', 20, 0);
    s.recordHit('blue-1', 'red-1', 20, 0);
    s.recordHit('blue-1', 'red-2', 20, 0);
    // pilots: rd 2 hits, rs 1 hit, bd 0 hits
    expect(s.awards(120).bestDriver).toBe('bd');
    expect(s.awards(0).bestDriver).toBeUndefined();
  });

  it('Cặp đôi ăn ý: the 2-crew tank with the most damage; solo tanks excluded', () => {
    const s = setup();
    s.recordHit('red-2', 'blue-1', 200, 0); // solo deals most but is not a duo
    s.recordHit('red-1', 'blue-1', 40, 0);
    s.recordHit('blue-1', 'red-1', 20, 0);
    expect(s.awards(60).bestDuo).toEqual(['rd', 'rg']);
  });

  it('no duo award without duo damage', () => expect(setup().awards(60).bestDuo).toBeUndefined());
});
