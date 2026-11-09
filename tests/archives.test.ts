import AdmZip from 'adm-zip'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LauncherService } from '../src/main/core/service'

let root: string
let gameDir: string
let downloads: string

const ADDR = 'fm_Data/StreamingAssets/AddrData'
const AA = 'fm_Data/StreamingAssets/aa/StandaloneWindows64'

async function makeService(): Promise<LauncherService> {
  const svc = await LauncherService.create({
    libraryFile: path.join(root, 'data', 'library.json'),
    defaultBackupDir: path.join(root, 'data', 'backups'),
    modsDir: path.join(root, 'data', 'mods'),
    version: 'test',
    isGameRunning: async () => false
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
  root = await mkdtemp(path.join(os.tmpdir(), 'fm-launcher-zip-'))
  gameDir = path.join(root, 'steamapps', 'common', 'Football Manager 27')
  downloads = path.join(root, 'downloads')
  await mkdir(inGame(ADDR), { recursive: true })
  await mkdir(inGame(AA), { recursive: true })
  await writeFile(path.join(gameDir, 'fm.exe'), '')
  await writeFile(inGame(`${ADDR}/adboards_assets_all.bundle`), 'ORIG-ADBOARDS')
  await writeFile(inGame(`${ADDR}/catalog_info.bin`), 'ORIG-CATALOG')
  await writeFile(inGame(`${ADDR}/catalog_info.hash`), 'ORIG-HASH')
  await writeFile(inGame(`${AA}/ui-match.bundle`), 'ORIG-UI')
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('mods en archivos comprimidos', () => {
  it('lee un zip que copia la estructura del juego (varias carpetas) y descarta lo demás', async () => {
    const zip = await makeZip('ADBOARDS FM 27 CHILE & CONMEBOL.zip', {
      'ADBOARDS/fm_Data/StreamingAssets/AddrData/adboards_assets_all.bundle': 'MOD-ADBOARDS',
      'ADBOARDS/fm_Data/StreamingAssets/AddrData/catalog_info.bin': 'MOD-CATALOG',
      'ADBOARDS/fm_Data/StreamingAssets/AddrData/catalog_info.hash': 'MOD-HASH',
      'ADBOARDS/fm_Data/Plugins/evil.dll': 'MZ',
      'ADBOARDS/fm_Data/StreamingAssets/Install.bat': 'del /s',
      'ADBOARDS/INSTALACION.txt': 'hola',
      'ADBOARDS/Vistas previas/a.jpg': 'jpg'
    })
    const svc = await makeService()
    const report = await svc.addPaths([zip])

    expect(report.added).toEqual(['ADBOARDS FM 27 CHILE & CONMEBOL'])
    const [mod] = (await svc.getState()).mods
    expect(mod.origin).toBe('ADBOARDS FM 27 CHILE & CONMEBOL.zip')
    expect(mod.files.map((f) => f.target)).toEqual([
      `${ADDR}/adboards_assets_all.bundle`,
      `${ADDR}/catalog_info.bin`,
      `${ADDR}/catalog_info.hash`
    ])
    // Los ejecutables nunca se extraen.
    const extracted = path.join(root, 'data', 'mods')
    expect(existsSync(extracted)).toBe(true)
    const all = (await import('node:fs/promises')).readdir
    const names = (await all(extracted, { recursive: true })).map(String)
    expect(names.some((n) => /\.(dll|bat)$/i.test(n))).toBe(false)

    await svc.activate(mod.id)
    expect(await readGame(`${ADDR}/adboards_assets_all.bundle`)).toBe('MOD-ADBOARDS')
    expect(await readGame(`${ADDR}/catalog_info.bin`)).toBe('MOD-CATALOG')
    expect(await readGame(`${ADDR}/catalog_info.hash`)).toBe('MOD-HASH')
    expect((await svc.getState()).mods[0].status).toBe('active')

    await svc.deactivate(mod.id)
    expect(await readGame(`${ADDR}/adboards_assets_all.bundle`)).toBe('ORIG-ADBOARDS')
    expect(await readGame(`${ADDR}/catalog_info.bin`)).toBe('ORIG-CATALOG')
    expect(await readGame(`${ADDR}/catalog_info.hash`)).toBe('ORIG-HASH')
  })

  it('un zip con un bundle suelto usa el nombre del zip y encuentra su carpeta en el juego', async () => {
    const zip = await makeZip('Match Data Buttons v1.1.zip', {
      'files/ui-match.bundle': 'MOD-UI',
      'Install.bat': 'echo hola',
      'Uninstall.bat': 'echo chao'
    })
    const svc = await makeService()
    const report = await svc.addPaths([zip])
    expect(report.added).toEqual(['Match Data Buttons v1.1'])
    expect(report.unknownTargets).toEqual([])

    const [mod] = (await svc.getState()).mods
    expect(mod.files[0].target).toBe(`${AA}/ui-match.bundle`)
    await svc.activate(mod.id)
    expect(await readGame(`${AA}/ui-match.bundle`)).toBe('MOD-UI')
    await svc.deactivate(mod.id)
    expect(await readGame(`${AA}/ui-match.bundle`)).toBe('ORIG-UI')
  })

  it('un bundle suelto que vive en AddrData se ubica en AddrData', async () => {
    const loose = path.join(downloads, 'adboards_assets_all.bundle')
    await mkdir(downloads, { recursive: true })
    await writeFile(loose, 'MOD-LOOSE')
    const svc = await makeService()
    await svc.addPaths([loose])
    const [mod] = (await svc.getState()).mods
    expect(mod.files[0].target).toBe(`${ADDR}/adboards_assets_all.bundle`)
  })

  it('detecta el conflicto entre un zip y un bundle suelto sobre el mismo archivo', async () => {
    const zip = await makeZip('pack.zip', { 'p/fm_Data/StreamingAssets/AddrData/catalog_info.bin': 'M1' })
    const loose = path.join(downloads, 'catalog_info.bin')
    await writeFile(loose, 'unused')
    const svc = await makeService()
    await svc.addPaths([zip])
    const state = await svc.getState()
    expect(state.mods[0].conflictsWith).toEqual([])
    await svc.activate(state.mods[0].id)

    // Otro pack que reemplaza el mismo archivo.
    const zip2 = await makeZip('pack2.zip', { 'q/fm_Data/StreamingAssets/AddrData/catalog_info.bin': 'M2' })
    await svc.addPaths([zip2])
    const second = (await svc.getState()).mods[1]
    await expect(svc.activate(second.id)).rejects.toMatchObject({
      info: { code: 'CONFLICT', params: { mods: 'pack' } }
    })
  })

  it('crea los archivos nuevos del mod y los borra al desactivar', async () => {
    const zip = await makeZip('nuevo.zip', {
      'n/fm_Data/StreamingAssets/AddrData/stadium_new.bundle': 'NEW',
      'n/fm_Data/StreamingAssets/AddrData/catalog_info.bin': 'MOD-CATALOG'
    })
    const svc = await makeService()
    await svc.addPaths([zip])
    const id = (await svc.getState()).mods[0].id

    await svc.activate(id)
    expect(await readGame(`${ADDR}/stadium_new.bundle`)).toBe('NEW')
    await svc.deactivate(id)
    expect(existsSync(inGame(`${ADDR}/stadium_new.bundle`))).toBe(false)
    expect(await readGame(`${ADDR}/catalog_info.bin`)).toBe('ORIG-CATALOG')
  })

  it('ignora entradas del zip que intentan salirse de la carpeta de destino', async () => {
    const zip = new AdmZip()
    zip.addFile('ok/fm_Data/StreamingAssets/AddrData/catalog_info.bin', Buffer.from('OK'))
    const evil = zip.addFile('x/fm_Data/StreamingAssets/placeholder.bundle', Buffer.from('EVIL'))
    evil.entryName = 'x/fm_Data/../../../../escape.bundle'
    await mkdir(downloads, { recursive: true })
    const file = path.join(downloads, 'slip.zip')
    zip.writeZip(file)

    const svc = await makeService()
    await svc.addPaths([file])
    expect(existsSync(path.join(root, 'escape.bundle'))).toBe(false)
    expect(existsSync(path.join(root, 'data', 'escape.bundle'))).toBe(false)
    expect(existsSync(path.join(root, 'data', 'mods', 'escape.bundle'))).toBe(false)
  })

  it('un zip sin nada utilizable da error claro', async () => {
    const zip = await makeZip('vacio.zip', { 'readme.txt': 'hola' })
    const svc = await makeService()
    await expect(svc.addPaths([zip])).rejects.toMatchObject({ info: { code: 'NOTHING_ADDED' } })
  })

  it('un archivo corrupto da ARCHIVE_FAILED', async () => {
    await mkdir(downloads, { recursive: true })
    const bad = path.join(downloads, 'roto.zip')
    await writeFile(bad, 'esto no es un zip')
    const svc = await makeService()
    await expect(svc.addPaths([bad])).rejects.toMatchObject({ info: { code: 'ARCHIVE_FAILED' } })
  })

  it('al quitar el mod se borran los archivos descomprimidos', async () => {
    const zip = await makeZip('pack.zip', { 'p/fm_Data/StreamingAssets/AddrData/catalog_info.bin': 'M1' })
    const svc = await makeService()
    await svc.addPaths([zip])
    const mods = path.join(root, 'data', 'mods')
    expect(existsSync(mods)).toBe(true)
    await svc.removeMod((await svc.getState()).mods[0].id)
    expect(existsSync(zip)).toBe(true) // el zip original no se toca
    const { readdir } = await import('node:fs/promises')
    expect(await readdir(mods)).toEqual([])
  })

  it('volver a agregar el mismo zip actualiza los archivos en vez de duplicar', async () => {
    const zip = await makeZip('pack.zip', { 'p/fm_Data/StreamingAssets/AddrData/catalog_info.bin': 'V1' })
    const svc = await makeService()
    await svc.addPaths([zip])
    const id = (await svc.getState()).mods[0].id
    await svc.activate(id)

    await makeZip('pack.zip', { 'p/fm_Data/StreamingAssets/AddrData/catalog_info.bin': 'V2' })
    const report = await svc.addPaths([zip])
    expect(report.duplicates).toEqual(['pack'])
    const state = await svc.getState()
    expect(state.mods).toHaveLength(1)
    expect(state.mods[0].files[0].outdated).toBe(true)

    await svc.activate(id)
    expect(await readGame(`${ADDR}/catalog_info.bin`)).toBe('V2')
    await svc.deactivate(id)
    expect(await readGame(`${ADDR}/catalog_info.bin`)).toBe('ORIG-CATALOG')
  })
})

describe('bibliotecas antiguas', () => {
  it('migra una biblioteca v1 (solo el nombre del bundle) a rutas relativas', async () => {
    const file = path.join(root, 'data', 'library.json')
    await mkdir(path.dirname(file), { recursive: true })
    const src = path.join(downloads, 'ui-match.bundle')
    await mkdir(downloads, { recursive: true })
    await writeFile(src, 'MOD-UI')
    await writeFile(
      file,
      JSON.stringify({
        version: 1,
        settings: { language: 'en', gameDir: gameDir, backupsEnabled: true, backupDir: null, introAcknowledged: true },
        mods: [{ id: 'm1', name: 'Viejo', addedAt: 1, files: [{ source: src, target: 'ui-match.bundle' }] }],
        backups: {},
        owners: {}
      })
    )
    const svc = await makeService()
    const [mod] = (await svc.getState()).mods
    expect(mod.files[0].target).toBe(`${AA}/ui-match.bundle`)
    await svc.activate(mod.id)
    expect(await readGame(`${AA}/ui-match.bundle`)).toBe('MOD-UI')
  })
})
