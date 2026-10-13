import { it, expect } from 'vitest';
import { Store } from '../electron/database';
import { Sessions } from '../electron/sessions';
import { statistics, statisticsStart, dateKey } from '../electron/statistics';

it('divide uma sessão à meia-noite e entre semanas, excluindo a pausa', () => {
  const store = new Store(':memory:');
  try {
    store.saveSettings({ ...store.settings(), mode: 'light' });
    let now = new Date(2026, 9, 11, 23, 59).getTime(); // Sunday
    const sessions = new Sessions(store, () => now);
    sessions.start(5, 'qconcursos.com');
    now += 120000;
    sessions.pause();
    now += 300000;
    sessions.resume();
    now += 60000;
    sessions.finish('');
    const weeks = statistics(store.sessions(), [{ at: now }], now);
    expect(weeks[0]).toMatchObject({ effectiveMs: 120000, started: 0, interrupted: 0, blocks: 1 });
    expect(weeks[1]).toMatchObject({
      effectiveMs: 60000,
      started: 1,
      interrupted: 1,
      pauses: 1,
      plannedMs: 300000,
    });
    expect(weeks[0].sites).toEqual([{ name: 'qconcursos.com', effectiveMs: 120000 }]);
    expect(store.sessions()[0].intervals).toHaveLength(2);
  } finally {
    store.close();
  }
});

it('contabiliza a sessão ao vivo uma única vez, limita ao alvo e respeita extensão e recuperação', () => {
  const store = new Store(':memory:');
  try {
    let now = new Date(2026, 9, 12, 10).getTime();
    const sessions = new Sessions(store, () => now);
    sessions.start(5, 'docs.example');
    now += 60000;
    sessions.tick();
    now += 60000;
    expect(statistics(store.sessions(), [], now, sessions.active)[0].effectiveMs).toBe(120000);
    expect(sessions.active!.intervals![0].end - sessions.active!.intervals![0].start).toBe(60000);
    now += 3600000;
    const recovered = new Sessions(store, () => now);
    expect(statistics(store.sessions(), [], now, recovered.active)[0].effectiveMs).toBe(60000);
    recovered.resume();
    now += 600000;
    recovered.tick();
    expect(statistics(store.sessions(), [], now, recovered.active)[0].effectiveMs).toBe(300000);
    recovered.extend(5);
    now += 120000;
    recovered.pause();
    expect(statistics(store.sessions(), [], now, recovered.active)[0].effectiveMs).toBe(420000);
    expect(recovered.active!.intervals).toHaveLength(3);
  } finally {
    store.close();
  }
});

it('mantém tempo legado no dia de início e não limita as estatísticas às mil sessões do histórico', () => {
  const store = new Store(':memory:');
  try {
    let now = new Date(2026, 9, 12, 10).getTime();
    store.saveSettings({ ...store.settings(), mode: 'light' });
    const sessions = new Sessions(store, () => now);
    sessions.start(5, 'qconcursos.com');
    now += 60000;
    sessions.finish('');
    const old = store.sessions()[0];
    delete old.intervals;
    for (let i = 0; i < 1001; i++) store.saveSession({ ...old, id: old.id + i });
    expect(store.sessions()).toHaveLength(1000);
    const week = statistics(store.statisticsSessions(statisticsStart(now)), [], now)[0];
    expect(week).toMatchObject({ effectiveMs: 1001 * 60000, started: 1001, legacySessions: 1001 });
    expect(statistics([], [], now)[0].days).toHaveLength(7);
  } finally {
    store.close();
  }
});

it('usa limites de dia local em semanas com horário de verão', () => {
  const previous = process.env.TZ;
  process.env.TZ = 'America/New_York';
  const store = new Store(':memory:');
  try {
    const start = new Date(2026, 2, 8, 0).getTime();
    const end = new Date(2026, 2, 9, 0).getTime();
    const sessions = new Sessions(store, () => start);
    sessions.start(480, 'docs.example');
    const s = store.sessions()[0];
    s.intervals = [{ start, end }];
    s.effectiveMs = end - start;
    s.plannedMs = end - start;
    s.runningSince = null;
    s.status = 'completed';
    const weeks = statistics([s], [], end);
    expect(end - start).toBe(23 * 3600000);
    expect(weeks[1].days.find((d) => d.date === dateKey(start))!.effectiveMs).toBe(23 * 3600000);
    expect(weeks[0].effectiveMs).toBe(0);
  } finally {
    store.close();
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});
