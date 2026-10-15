export interface NoteDraft {
  subjectId?: string | null;
  id: string;
  title: string;
  body: string;
  subject: string;
  kind: 'note' | 'later';
}
export interface Note extends NoteDraft {
  createdAt: number;
  updatedAt: number;
}
export interface Site {
  id: number;
  name: string;
  url: string;
  enabled: boolean;
  subdomains: boolean;
}
export interface Settings {
  lastPdfId?: string | null;
  activeProfileId: number;
  lastTopicId?: string | null;
  theme: 'light' | 'dark';
  mode: 'light' | 'strong';
  reflectionSeconds: number;
  dailyGoal: number;
  onboarded: boolean;
  lastUrl: string;
}
export interface StudySession {
  pdfId?: string;
  pdfName?: string;
  intervals?: { start: number; end: number }[];
  profileId?: number;
  profileName?: string;
  topicId?: string;
  subjectId?: string;
  subjectName?: string;
  topicName?: string;
  id: number;
  start: number;
  end: number | null;
  plannedMs: number;
  effectiveMs: number;
  runningSince: number | null;
  checkpoint: number;
  status: 'running' | 'paused' | 'completed' | 'interrupted';
  site: string;
  pauses: number;
  reason: string;
}
export interface BrowserState {
  domain: string;
  loading: boolean;
  error: string;
  blocked: string;
  canBack: boolean;
  canForward: boolean;
  zoom: number;
  authUntil: number;
}
export interface Snapshot {
  immersive: boolean;
  pdfs: PdfMaterial[];
  statistics: StatisticsWeek[];
  profiles: { id: number; name: string }[];
  subjects: Subject[];
  topics: Topic[];
  notes: Note[];
  settings: Settings;
  sites: Site[];
  active: StudySession | null;
  history: StudySession[];
  todayMs: number;
  browser: BrowserState;
  recovered: boolean;
  now: number;
  exitReadyAt: number | null;
}
export type Command =
  | { type: 'focus:presence'; visible: boolean }
  | { type: 'immersive:toggle' }
  | { type: 'pdf:import' }
  | { type: 'pdf:remove'; id: string }
  | { type: 'pdf:progress'; id: string; page: number; pageCount: number }
  | { type: 'pdf:start'; id: string; minutes: number }
  | { type: 'profile:create'; name: string }
  | { type: 'profile:rename'; id: number; name: string }
  | { type: 'profile:remove'; id: number }
  | { type: 'profile:select'; id: number }
  | { type: 'subject:save'; subject: Subject }
  | { type: 'subject:remove'; id: string }
  | { type: 'topic:save'; topic: TopicDraft }
  | { type: 'topic:remove'; id: string }
  | { type: 'topic:start'; id: string }
  | { type: 'snapshot' }
  | { type: 'note:save'; note: NoteDraft }
  | { type: 'note:remove'; id: string }
  | { type: 'note:export'; id: string }
  | { type: 'settings'; settings: Partial<Settings> }
  | { type: 'site:add'; name: string; url: string; subdomains: boolean }
  | { type: 'site:toggle'; id: number }
  | { type: 'site:remove'; id: number }
  | { type: 'start'; minutes: number; url?: string }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'extend'; minutes: number }
  | { type: 'exit:request' }
  | { type: 'exit:cancel' }
  | { type: 'exit:confirm'; reason: string }
  | { type: 'navigate'; url: string }
  | {
      type: 'browser';
      action: 'back' | 'forward' | 'reload' | 'home' | 'return' | 'zoomIn' | 'zoomOut';
    }
  | {
      type: 'view';
      visible: boolean;
      bounds: { x: number; y: number; width: number; height: number };
    };
export interface Bridge {
  pdfData(id: string): Promise<Uint8Array>;
  command(command: Command): Promise<Snapshot>;
  subscribe(listener: (state: Snapshot) => void): () => void;
}
declare global {
  interface Window {
    studyroom: Bridge;
  }
}
export interface Subject {
  id: string;
  name: string;
}
export interface TopicDraft {
  id: string;
  subjectId: string;
  name: string;
  priority: number;
  minutes: number;
  reviewOn: string;
  url: string;
}
export interface Topic extends TopicDraft {
  lastStudied: number | null;
}
export interface StatisticsDay {
  date: string;
  effectiveMs: number;
  started: number;
  completed: number;
  interrupted: number;
  pauses: number;
  blocks: number;
}
export interface StatisticsWeek {
  days: StatisticsDay[];
  effectiveMs: number;
  plannedMs: number;
  started: number;
  completed: number;
  interrupted: number;
  pauses: number;
  blocks: number;
  legacySessions: number;
  sites: { name: string; effectiveMs: number }[];
}
export interface PdfMaterial {
  id: string;
  name: string;
  bytes: number;
  importedAt: number;
  page: number;
  pageCount: number;
}
