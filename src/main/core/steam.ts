import { execFile } from 'node:child_process'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import type { GameInfo } from '../../shared/types'
import { exists } from './fsutil'

export const FM27_APP_ID = '4530370'
export const FM27_DIR_NAME = 'Football Manager 27'
export const BUNDLE_SUBPATH = ['fm_Data', 'StreamingAssets', 'aa', 'StandaloneWindows64']

function run(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve) => {
    execFile(cmd, args, { windowsHide: true }, (err, stdout) => resolve(err ? '' : stdout))
  })
}

let steamPathMemo: string | null | undefined

/** Carpeta de instalación de Steam, leída del registro de Windows. */
export async function getSteamPath(): Promise<string | null> {
  if (steamPathMemo !== undefined) return steamPathMemo
  let result: string | null = null
  if (process.platform === 'win32') {
    const out = await run('reg', ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'SteamPath'])
    const m = out.match(/SteamPath\s+REG_SZ\s+(.+)/i)
    if (m) result = path.normalize(m[1].trim())
    if (!result) {
      const pf = process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)'
      const candidate = path.join(pf, 'Steam')
      if (await exists(candidate)) result = candidate
    }
  }
  steamPathMemo = result
  return result
}

/** Todas las bibliotecas de Steam (la principal y las adicionales). */
export async function getLibraryPaths(steamPath: string): Promise<string[]> {
  const libs = [steamPath]
  try {
    const vdf = await readFile(path.join(steamPath, 'steamapps', 'libraryfolders.vdf'), 'utf8')
    for (const m of vdf.matchAll(/"path"\s+"([^"]+)"/g)) {
      const p = path.normalize(m[1].replace(/\\\\/g, '\\'))
      if (!libs.some((l) => l.toLowerCase() === p.toLowerCase())) libs.push(p)
    }
  } catch {
    /* sin libraryfolders.vdf: solo la biblioteca principal */
  }
  return libs
}

export async function readBuildId(gameDir: string): Promise<string | null> {
  // <biblioteca>/steamapps/common/<juego> -> <biblioteca>/steamapps/appmanifest_<id>.acf
  const manifest = path.resolve(gameDir, '..', '..', `appmanifest_${FM27_APP_ID}.acf`)
  try {
    const text = await readFile(manifest, 'utf8')
    return text.match(/"buildid"\s+"(\d+)"/)?.[1] ?? null
  } catch {
    return null
  }
}

/** Valida una carpeta como instalación de FM27 y devuelve sus datos. */
export async function inspectGameDir(gameDir: string): Promise<GameInfo | null> {
  const bundleDir = path.join(gameDir, ...BUNDLE_SUBPATH)
  if (!(await exists(path.join(gameDir, 'fm.exe')))) return null
  if (!(await exists(bundleDir))) return null
  return { gameDir, bundleDir, buildId: await readBuildId(gameDir), version: null, appId: FM27_APP_ID }
}

/**
 * Versión interna del juego (por ejemplo "27.0.0+2493426"). FM27 la deja anotada en sus preferencias
 * cada vez que se abre, así que refleja la última vez que se jugó.
 */
export async function readGameVersion(localAppData: string | undefined = process.env.LOCALAPPDATA): Promise<string | null> {
  if (!localAppData) return null
  const prefs = path.join(localAppData, 'Sports Interactive', 'Football Manager 27', 'Preferences')
  let dirs: string[]
  try {
    dirs = (await readdir(prefs, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name)
  } catch {
    return null
  }
  for (const dir of dirs.sort().reverse()) {
    try {
      const xml = await readFile(path.join(prefs, dir, 'remote_dbcs.xml'), 'utf8')
      const m = xml.match(/id="version"\s+value="(\d+\.\d+\.\d+\+\d+)"/)
      if (m) return m[1]
    } catch {
      /* esa carpeta no tiene el archivo */
    }
  }
  return null
}

/** Busca FM27 en las bibliotecas de Steam, o usa la carpeta indicada por el usuario. */
export async function detectGame(manualDir: string | null): Promise<GameInfo | null> {
  if (manualDir) return inspectGameDir(manualDir)
  const steam = await getSteamPath()
  if (!steam) return null
  for (const lib of await getLibraryPaths(steam)) {
    const info = await inspectGameDir(path.join(lib, 'steamapps', 'common', FM27_DIR_NAME))
    if (info) return info
  }
  return null
}
