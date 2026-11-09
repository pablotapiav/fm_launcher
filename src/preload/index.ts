import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { LauncherApi } from '../shared/types'

const api: LauncherApi = {
  getState: () => ipcRenderer.invoke('getState'),
  addPaths: (paths) => ipcRenderer.invoke('addPaths', paths),
  pickFiles: () => ipcRenderer.invoke('pickFiles'),
  pickFolder: () => ipcRenderer.invoke('pickFolder'),
  activate: (id) => ipcRenderer.invoke('activate', id),
  deactivate: (id) => ipcRenderer.invoke('deactivate', id),
  swapMod: (id) => ipcRenderer.invoke('swapMod', id),
  removeMod: (id) => ipcRenderer.invoke('removeMod', id),
  renameMod: (id, name) => ipcRenderer.invoke('renameMod', id, name),
  relocateFile: (id, target) => ipcRenderer.invoke('relocateFile', id, target),
  setSettings: (patch) => ipcRenderer.invoke('setSettings', patch),
  pickGameDir: () => ipcRenderer.invoke('pickGameDir'),
  pickBackupDir: () => ipcRenderer.invoke('pickBackupDir'),
  openBackupDir: () => ipcRenderer.invoke('openBackupDir'),
  openLink: (kind) => ipcRenderer.invoke('openLink', kind),
  copyText: (text) => ipcRenderer.invoke('copyText', text),
  onFatalError: (cb) => {
    const listener = (_e: unknown, message: string): void => cb(message)
    ipcRenderer.on('fatal-error', listener)
    return () => ipcRenderer.removeListener('fatal-error', listener)
  },
  launchGame: () => ipcRenderer.invoke('launchGame'),
  steamVerify: () => ipcRenderer.invoke('steamVerify'),
  onGameRunning: (cb) => {
    const listener = (_e: unknown, running: boolean): void => cb(running)
    ipcRenderer.on('game-running', listener)
    return () => ipcRenderer.removeListener('game-running', listener)
  },
  getPathForFile: (file) => webUtils.getPathForFile(file)
}

contextBridge.exposeInMainWorld('api', api)
