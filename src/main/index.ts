import { app, BrowserWindow, clipboard, dialog, ipcMain, session, shell } from 'electron'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { linkUrl, type LinkKind } from '../shared/links'
import type { Lang, Result, Settings } from '../shared/types'
import { LauncherError } from './core/errors'
import { defaultLanguage } from './core/library'
import { LauncherService } from './core/service'
import { FM27_APP_ID } from './core/steam'

const iconPath = path.join(__dirname, '../../build/icon.png')

let win: BrowserWindow | null = null
let service: LauncherService
let lastRunning: boolean | null = null

async function wrap<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() }
  } catch (err) {
    if (err instanceof LauncherError) return { ok: false, error: err.info }
    return { ok: false, error: { code: 'IO', params: { detail: err instanceof Error ? err.message : String(err) } } }
  }
}

const wrapVoid = (fn: () => Promise<unknown>): Promise<Result<null>> =>
  wrap(async () => {
    await fn()
    return null
  })

async function pick(options: Electron.OpenDialogOptions): Promise<string[] | null> {
  const parent = win ?? undefined
  const res = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options)
  return res.canceled || res.filePaths.length === 0 ? null : res.filePaths
}

function registerIpc(): void {
  ipcMain.handle('getState', () => service.getState())
  ipcMain.handle('addPaths', (_e, paths: string[]) => wrap(() => service.addPaths(paths)))

  ipcMain.handle('pickFiles', async () => {
    const paths = await pick({
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Mods (.zip, .7z, .rar, .bundle)', extensions: ['zip', '7z', 'rar', 'bundle'] },
        { name: 'All files', extensions: ['*'] }
      ]
    })
    return paths ? wrap(() => service.addPaths(paths)) : null
  })
  ipcMain.handle('pickFolder', async () => {
    const paths = await pick({ properties: ['openDirectory', 'multiSelections'] })
    return paths ? wrap(() => service.addPaths(paths)) : null
  })

  ipcMain.handle('activate', (_e, id: string) => wrapVoid(() => service.activate(id)))
  ipcMain.handle('deactivate', (_e, id: string) => wrapVoid(() => service.deactivate(id)))
  ipcMain.handle('swapMod', (_e, id: string) => wrapVoid(() => service.swapMod(id)))
  ipcMain.handle('removeMod', (_e, id: string) => wrapVoid(() => service.removeMod(id)))
  ipcMain.handle('renameMod', (_e, id: string, name: string) => wrapVoid(() => service.renameMod(id, name)))

  ipcMain.handle('relocateFile', async (_e, id: string, target: string) => {
    const paths = await pick({
      properties: ['openFile'],
      filters: [{ name: target.slice(target.lastIndexOf('/') + 1), extensions: ['*'] }]
    })
    return paths ? wrapVoid(() => service.relocateFile(id, target, paths[0])) : null
  })

  ipcMain.handle('setSettings', (_e, patch: Partial<Settings>) => wrapVoid(() => service.setSettings(patch)))

  ipcMain.handle('pickGameDir', async () => {
    const paths = await pick({ properties: ['openDirectory'] })
    return paths ? wrapVoid(() => service.setSettings({ gameDir: paths[0] })) : null
  })
  ipcMain.handle('pickBackupDir', async () => {
    const paths = await pick({ properties: ['openDirectory', 'createDirectory'] })
    return paths ? wrapVoid(() => service.setSettings({ backupDir: paths[0] })) : null
  })
  ipcMain.handle('openBackupDir', async () => {
    await mkdir(service.backupDir, { recursive: true })
    await shell.openPath(service.backupDir)
  })

  ipcMain.handle('launchGame', () =>
    wrapVoid(async () => {
      const game = await service.getGame()
      if (!game) throw new LauncherError({ code: 'GAME_NOT_FOUND' })
      await shell.openExternal(`steam://rungameid/${game.appId}`)
    })
  )
  ipcMain.handle('steamVerify', () => shell.openExternal(`steam://validate/${FM27_APP_ID}`))

  ipcMain.handle('openLink', async (_e, kind: LinkKind) => {
    const url = linkUrl(kind)
    if (url) await shell.openExternal(url)
  })
  ipcMain.handle('copyText', (_e, text: string) => clipboard.writeText(String(text).slice(0, 20000)))
}

/** Avisa a la interfaz cuando fm.exe se abre o se cierra. */
function startGameWatcher(): void {
  const tick = async (): Promise<void> => {
    const running = await service.gameRunning()
    if (running !== lastRunning) {
      lastRunning = running
      win?.webContents.send('game-running', running)
    }
  }
  void tick()
  setInterval(() => void tick(), 2500)
}

function createWindow(): void {
  win = new BrowserWindow({
    width: 1000,
    height: 740,
    minWidth: 760,
    minHeight: 560,
    backgroundColor: '#0f1419',
    autoHideMenuBar: true,
    title: 'FM Launcher',
    // En desarrollo se usa el PNG; el .exe empaquetado ya lleva el ícono incrustado.
    ...(existsSync(iconPath) ? { icon: iconPath } : {}),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  // Soltar un archivo sobre la ventana no debe navegar hacia él.
  win.webContents.on('will-navigate', (e) => e.preventDefault())
  win.webContents.on('did-finish-load', () => {
    if (lastRunning !== null) win?.webContents.send('game-running', lastRunning)
  })

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) void win.loadURL(devUrl)
  else void win.loadFile(path.join(__dirname, '../renderer/index.html'))
}

/** Un fallo inesperado no debe pasar en silencio: la interfaz abre el pop-up de comentarios. */
function reportFatal(err: unknown): void {
  const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
  console.error('[fatal]', err)
  win?.webContents.send('fatal-error', message)
}
process.on('uncaughtException', reportFatal)
process.on('unhandledRejection', reportFatal)

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })

  void app.whenReady().then(async () => {
    app.setAppUserModelId('com.fmlauncher.app')

    if (!process.env['ELECTRON_RENDERER_URL']) {
      session.defaultSession.webRequest.onHeadersReceived((details, cb) => {
        cb({
          responseHeaders: {
            ...details.responseHeaders,
            'Content-Security-Policy': [
              "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:"
            ]
          }
        })
      })
    }

    const userData = app.getPath('userData')
    const initialLanguage: Lang = defaultLanguage(app.getLocale())
    service = await LauncherService.create({
      libraryFile: path.join(userData, 'library.json'),
      defaultBackupDir: path.join(userData, 'backups'),
      modsDir: path.join(userData, 'mods'),
      version: app.getVersion(),
      initialLanguage
    })
    registerIpc()
    createWindow()
    startGameWatcher()
  })

  app.on('window-all-closed', () => app.quit())
}
