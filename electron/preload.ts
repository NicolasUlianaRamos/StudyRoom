import { contextBridge, ipcRenderer } from 'electron';
import type { Command, Snapshot } from '../src/shared';
contextBridge.exposeInMainWorld('studyroom', {
  pdfData: (id: string) => ipcRenderer.invoke('studyroom:pdf-data', id),
  command: (command: Command) => ipcRenderer.invoke('studyroom:command', command),
  subscribe: (listener: (state: Snapshot) => void) => {
    const cb = (_event: Electron.IpcRendererEvent, state: Snapshot) => listener(state);
    ipcRenderer.on('studyroom:state', cb);
    return () => ipcRenderer.removeListener('studyroom:state', cb);
  },
});
