import type { StatisticsDay, StatisticsWeek, StudySession } from '../src/shared';
import { captureInterval, effective } from './sessions';

export function dateKey(time: number) {
  const d = new Date(time);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function statisticsStart(now: number) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7) - 49);
  return start.getTime();
}
export function statistics(
  sessions: StudySession[],
  blocks: { at: number }[],
  now: number,
  active: StudySession | null = null,
): StatisticsWeek[] {
  const days = new Map<string, StatisticsDay>();
  const weeks: StatisticsWeek[] = [];
  const byDate = new Map<string, StatisticsWeek>();
  const cursor = new Date(statisticsStart(now));
  for (let w = 0; w < 8; w++) {
    const week: StatisticsWeek = {
      days: [],
      effectiveMs: 0,
      plannedMs: 0,
      started: 0,
      completed: 0,
      interrupted: 0,
      pauses: 0,
      blocks: 0,
      legacySessions: 0,
      sites: [],
    };
    for (let d = 0; d < 7; d++) {
      const date = dateKey(cursor.getTime());
      const day: StatisticsDay = {
        date,
        effectiveMs: 0,
        started: 0,
        completed: 0,
        interrupted: 0,
        pauses: 0,
        blocks: 0,
      };
      days.set(date, day);
      byDate.set(date, week);
      week.days.push(day);
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }
  const records = active ? [...sessions.filter((s) => s.id !== active.id), active] : sessions;
  for (const original of records) {
    const s = structuredClone(original);
    if (s.id === active?.id) captureInterval(s, now);
    const startKey = dateKey(s.start);
    const startDay = days.get(startKey);
    const startWeek = byDate.get(startKey);
    if (startDay && startWeek) {
      startDay.started++;
      startWeek.started++;
      startDay.pauses += s.pauses;
      startWeek.pauses += s.pauses;
      startWeek.plannedMs += s.plannedMs;
      if (s.status === 'completed') {
        startDay.completed++;
        startWeek.completed++;
      }
      if (s.status === 'interrupted') {
        startDay.interrupted++;
        startWeek.interrupted++;
      }
      if (!s.intervals) startWeek.legacySessions++;
    }
    const addTime = (key: string, ms: number) => {
      const day = days.get(key),
        week = byDate.get(key);
      if (!day || !week || ms <= 0) return;
      day.effectiveMs += ms;
      week.effectiveMs += ms;
      const site = week.sites.find((site) => site.name === s.site);
      if (site) site.effectiveMs += ms;
      else week.sites.push({ name: s.site, effectiveMs: ms });
    };
    if (!s.intervals) {
      addTime(startKey, s.id === active?.id ? effective(s, now) : effective(s, s.checkpoint));
      continue;
    }
    for (const interval of s.intervals) {
      let time = Math.max(interval.start, statisticsStart(now));
      const end = Math.min(interval.end, now);
      while (time < end) {
        const next = new Date(time);
        next.setHours(0, 0, 0, 0);
        next.setDate(next.getDate() + 1);
        const boundary = Math.min(next.getTime(), end);
        addTime(dateKey(time), boundary - time);
        time = boundary;
      }
    }
  }
  for (const block of blocks) {
    if (block.at > now) continue;
    const key = dateKey(block.at),
      day = days.get(key),
      week = byDate.get(key);
    if (day && week) {
      day.blocks++;
      week.blocks++;
    }
  }
  for (const week of weeks)
    week.sites.sort((a, b) => b.effectiveMs - a.effectiveMs || a.name.localeCompare(b.name));
  return weeks.reverse();
}
