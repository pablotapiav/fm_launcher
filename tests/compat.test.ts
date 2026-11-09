import AdmZip from 'adm-zip'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LauncherService } from '../src/main/core/service'
import { parseDeclaredCompat } from '../src/main/core/scan'
import { readGameVersion } from '../src/main/core/steam'

let root: string
let gameDir: string
let downloads: string
let gameVersion: string | null

const ADDR = 'fm_Data/StreamingAssets/AddrData'
const AA = 'fm_Data/StreamingAssets/aa/StandaloneWindows64'

async function makeService(): Promise<LauncherService> {
  const svc = await LauncherService.create({
    libraryFile: path.join(root, 'data', 'library.json'),
    defaultBackupDir: path.join(root, 'data', 'backups'),
    modsDir: path.join(root, 'data', 'mods'),
    version: 'test',
    isGameRunning: async () => false,
    gameVersion: async () => gameVersion
  })
  await svc.setSettings({ gameDir })
  return svc
}

const inGame = (rel: string): string => path.join(gameDir, ...rel.split('/'))
const readGame = (rel: string): Promise<string> => readFile(inGame(rel), 'utf8')

async function makeZip(name: string, entries: Record<string, string>): Promise<string> {
  const zip = new AdmZip()
  for (const [entry, content] of Object.entries(entries)) zip.addFile(entry, Buffer.from(content))
  await mkdir(downloads, { recursive: true })
  const file = path.join(downloads, name)
  zip.writeZip(file)
  return file
}

beforeEach(async () => {
  gameVersion = '27.0.0+2493426'
  root = await mkdtemp(path.join(os.tmpdir(), 'fm-launcher-compat-'))
  gameDir = path.join(root, 'steamapps', 'common', 'Football Manager 27')
  downloads = path.join(root, 'downloads')
  await mkdir(inGame(ADDR), { recursive: true })
  await mkdir(inGame(AA), { recursive: true })
  await writeFile(path.join(gameDir, 'fm.exe'), '')
  await writeFile(path.join(root, 'steamapps', 'appmanifest_4530370.acf'), '"AppState"\n{\n\t"buildid"\t\t"26340721"\n}\n')
  await writeFile(inGame(`${ADDR}/catalog_info.bin`), 'ORIG-CATALOG')
  await writeFile(inGame(`${ADDR}/adboards_assets_all.bundle`), 'ORIG-AD')
  await writeFile(inGame(`${AA}/ui-match.bundle`), 'ORIG-UI')
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('cambiar a este mod', () => {
  async function twoConflicting(svc: LauncherService): Promise<[string, string]> {
    await svc.addPaths([await makeZip('A.zip', { 'a/fm_Data/StreamingAssets/AddrData/catalog_info.bin': 'MOD-A' })])
    await svc.addPaths([await makeZip('B.zip', { 'b/fm_Data/StreamingAssets/AddrData/catalog_info.bin': 'MOD-B' })])
    const [a, b] = (await svc.getState()).mods
    return [a.id, b.id]
  }

  it('desactiva el mod que choca y activa el nuevo en un solo paso', async () => {
    const svc = await makeService()
    const [a, b] = await twoConflicting(svc)
    await svc.activate(a)

    await svc.swapMod(b)
    const state = await svc.getState()
    expect(state.mods.find((m) => m.id === a)?.status).toBe('inactive')
    expect(state.mods.find((m) => m.id === b)?.status).toBe('active')
    expect(await readGame(`${ADDR}/catalog_info.bin`)).toBe('MOD-B')

    // Y el original sigue a salvo: al desactivar el nuevo se recupera.
    await svc.deactivate(b)
    expect(await readGame(`${ADDR}/catalog_info.bin`)).toBe('ORIG-CATALOG')
  })

  it('si nada choca, simplemente activa', async () => {
    const svc = await makeService()
    const [a] = await twoConflicting(svc)
    await svc.swapMod(a)
    expect((await svc.getState()).mods[0].status).toBe('active')
  })

  it('si el mod nuevo no se puede activar, vuelve a dejar activo el anterior', async () => {
    const svc = await makeService()
    const [a, b] = await twoConflicting(svc)
    await svc.activate(a)

    const bSource = (await svc.getState()).mods.find((m) => m.id === b)!.files[0].source
    await rm(bSource)
    await expect(svc.swapMod(b)).rejects.toMatchObject({ info: { code: 'SOURCE_MISSING' } })

    const state = await svc.getState()
    expect(state.mods.find((m) => m.id === a)?.status).toBe('active')
    expect(await readGame(`${ADDR}/catalog_info.bin`)).toBe('MOD-A')
    await svc.deactivate(a)
    expect(await readGame(`${ADDR}/catalog_info.bin`)).toBe('ORIG-CATALOG')
  })

  it('no hace nada con el juego abierto', async () => {
    let running = false
    const svc = await LauncherService.create({
      libraryFile: path.join(root, 'data2', 'library.json'),
      defaultBackupDir: path.join(root, 'data2', 'backups'),
      modsDir: path.join(root, 'data2', 'mods'),
      version: 'test',
      isGameRunning: async () => running,
      gameVersion: async () => gameVersion
    })
    await svc.setSettings({ gameDir })
    await svc.addPaths([await makeZip('C.zip', { 'c/fm_Data/StreamingAssets/AddrData/catalog_info.bin': 'MOD-C' })])
    const id = (await svc.getState()).mods[0].id
    running = true
    await expect(svc.swapMod(id)).rejects.toMatchObject({ info: { code: 'GAME_RUNNING' } })
    expect(await readGame(`${ADDR}/catalog_info.bin`)).toBe('ORIG-CATALOG')
  })
})

describe('aviso de catálogo propio', () => {
  it('avisa en el mod con catálogo cuando hay otros mods activos sin conflicto de archivos', async () => {
    const svc = await makeService()
    await svc.addPaths([
      await makeZip('vallas.zip', {
        'v/fm_Data/StreamingAssets/AddrData/adboards_assets_all.bundle': 'AD',
        'v/fm_Data/StreamingAssets/AddrData/catalog_info.bin': 'CAT'
      })
    ])
    await svc.addPaths([await makeZip('ui.zip', { 'files/ui-match.bundle': 'UI' })])
    const [vallas, ui] = (await svc.getState()).mods

    // Sin otros mods activos, no hay nada que advertir.
    expect(vallas.catalogWith).toEqual([])

    await svc.activate(ui.id)
    const after = (await svc.getState()).mods
    expect(after.find((m) => m.id === vallas.id)?.catalogWith).toEqual([ui.name])
    // Los mods sin catálogo propio no llevan este aviso.
    expect(after.find((m) => m.id === ui.id)?.catalogWith).toEqual([])
  })
})

describe('compatibilidad con la versión del juego', () => {
  const note = (text: string): Record<string, string> => ({
    'p/fm_Data/StreamingAssets/AddrData/catalog_info.bin': 'X',
    'p/INSTALACION.txt': text
  })

  it('reconoce la versión declarada en las notas del zip y la compara con la del juego', async () => {
    const svc = await makeService()
    await svc.addPaths([await makeZip('ok.zip', note('Preparado para la version Steam de FM27: 27.0.0+2493426.'))])
    const [mod] = (await svc.getState()).mods
    expect(mod.compat).toEqual({
      state: 'match',
      declared: '27.0.0+2493426',
      current: '27.0.0+2493426',
      exact: true
    })
  })

  it('un número de compilación distinto con la misma versión base sigue siendo compatible', async () => {
    const svc = await makeService()
    await svc.addPaths([await makeZip('cercano.zip', note('Hecho para 27.0.0+2493426.'))])
    gameVersion = '27.0.0+2493500'
    const [mod] = (await svc.getState()).mods
    expect(mod.compat).toEqual({
      state: 'match',
      declared: '27.0.0+2493426',
      current: '27.0.0+2493500',
      exact: false
    })
  })

  it('solo marca como distinta una versión base diferente', async () => {
    const svc = await makeService()
    await svc.addPaths([await makeZip('viejo.zip', note('Hecho para 27.0.0+2400000.'))])
    gameVersion = '27.1.0+2500000'
    const [mod] = (await svc.getState()).mods
    expect(mod.compat).toEqual({
      state: 'different',
      declared: '27.0.0+2400000',
      current: '27.1.0+2500000',
      exact: false
    })
  })

  it('usa el build de Steam si el mod solo declara eso', async () => {
    const svc = await makeService()
    await svc.addPaths([await makeZip('steam.zip', note('Requires the 2 November update (build 26340721).'))])
    expect((await svc.getState()).mods[0].compat.state).toBe('match')

    await svc.addPaths([await makeZip('steam2.zip', note('Requires build 26000000'))])
    expect((await svc.getState()).mods[1].compat.state).toBe('different')
  })

  it('sin notas, o si no se conoce la versión del juego, queda como desconocida', async () => {
    const svc = await makeService()
    await svc.addPaths([await makeZip('sin-notas.zip', { 'p/fm_Data/StreamingAssets/AddrData/catalog_info.bin': 'X' })])
    expect((await svc.getState()).mods[0].compat).toEqual({ state: 'unknown' })

    await svc.addPaths([await makeZip('con-version.zip', { ...note('27.0.0+2493426'), 'p/fm_Data/StreamingAssets/AddrData/catalog_info.hash': 'H' })])
    gameVersion = null
    // La versión del juego es desconocida, pero el mod sí declara el build de Steam? No: queda sin comparar.
    expect((await svc.getState()).mods[1].compat.state).toBe('unknown')
  })
})

describe('lectura de versiones', () => {
  it('parseDeclaredCompat encuentra versión y build', () => {
    expect(parseDeclaredCompat('prepared for 27.0.0+2493426 only')).toEqual({ version: '27.0.0+2493426' })
    expect(parseDeclaredCompat('Steam build 26340721')).toEqual({ buildId: '26340721' })
    expect(parseDeclaredCompat('build id: 26340721 / 27.0.1+2500000')).toEqual({ version: '27.0.1+2500000', buildId: '26340721' })
    expect(parseDeclaredCompat('nada que ver, versión 3.2')).toBeUndefined()
  })

  it('readGameVersion lee la versión de las preferencias del juego', async () => {
    const local = path.join(root, 'local')
    const prefs = path.join(local, 'Sports Interactive', 'Football Manager 27', 'Preferences', 'version 6')
    await mkdir(prefs, { recursive: true })
    await writeFile(
      path.join(prefs, 'remote_dbcs.xml'),
      '<record>\n\t<string id="version" value="27.0.0+2493426"/>\n</record>'
    )
    expect(await readGameVersion(local)).toBe('27.0.0+2493426')
    expect(await readGameVersion(path.join(root, 'no-existe'))).toBeNull()
  })
})
