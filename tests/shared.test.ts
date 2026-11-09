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
const CAT = `${ADDR}/catalog_info.bin`

async function makeService(): Promise<LauncherService> {
  const svc = await LauncherService.create({
    libraryFile: path.join(root, 'data', 'library.json'),
    defaultBackupDir: path.join(root, 'data', 'backups'),
    modsDir: path.join(root, 'data', 'mods'),
    version: 'test',
    isGameRunning: async () => false,
    gameVersion: async () => null
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

/** Un pack de vallas para una competición: un bundle propio y su propia copia del catálogo. */
const pack = (name: string, bundle: string, catalog: string): Promise<string> =>
  makeZip(`${name}.zip`, {
    [`${name}/${ADDR}/${bundle}`]: `BUNDLE-${name}`,
    [`${name}/${CAT}`]: catalog
  })

/** Agrega los dos packs y devuelve sus ids en el orden en que se agregaron. */
async function addTwo(svc: LauncherService): Promise<[string, string]> {
  await svc.addPaths([await pack('champions', 'adboards_champions.bundle', 'CAT-CL')])
  await svc.addPaths([await pack('chile', 'adboards_chile.bundle', 'CAT-CH')])
  const [a, b] = (await svc.getState()).mods
  return [a.id, b.id]
}

const status = async (svc: LauncherService, id: string): Promise<string | undefined> =>
  (await svc.getState()).mods.find((m) => m.id === id)?.status

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'fm-launcher-shared-'))
  gameDir = path.join(root, 'steamapps', 'common', 'Football Manager 27')
  downloads = path.join(root, 'downloads')
  await mkdir(inGame(ADDR), { recursive: true })
  await mkdir(inGame(AA), { recursive: true })
  await writeFile(path.join(gameDir, 'fm.exe'), '')
  await writeFile(path.join(root, 'steamapps', 'appmanifest_4530370.acf'), '"AppState"\n{\n\t"buildid"\t\t"26340721"\n}\n')
  await writeFile(inGame(CAT), 'ORIG-CATALOG')
  await writeFile(inGame(`${ADDR}/adboards_assets_all.bundle`), 'ORIG-AD')
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('archivos de catálogo compartidos', () => {
  it('dos packs de vallas para competiciones distintas conviven sin ningún aviso', async () => {
    const svc = await makeService()
    const [cl, ch] = await addTwo(svc)

    const mods = (await svc.getState()).mods
    expect(mods.every((m) => m.conflictsWith.length === 0 && m.blockedBy.length === 0)).toBe(true)
    expect(mods.every((m) => m.tags.every((t) => t.id !== 'catalog'))).toBe(true)

    await svc.activate(cl)
    await svc.activate(ch)
    expect(await status(svc, cl)).toBe('active')
    expect(await status(svc, ch)).toBe('active')
    // Los dos bundles están puestos y el catálogo es el del último activado.
    expect(await readGame(`${ADDR}/adboards_champions.bundle`)).toBe('BUNDLE-champions')
    expect(await readGame(`${ADDR}/adboards_chile.bundle`)).toBe('BUNDLE-chile')
    expect(await readGame(CAT)).toBe('CAT-CH')
  })

  it('al desactivar el de arriba queda el catálogo del otro, y al desactivar el último vuelve el original', async () => {
    const svc = await makeService()
    const [cl, ch] = await addTwo(svc)
    await svc.activate(cl)
    await svc.activate(ch)

    await svc.deactivate(ch)
    expect(await readGame(CAT)).toBe('CAT-CL')
    expect(await status(svc, cl)).toBe('active')
    expect(await status(svc, ch)).toBe('inactive')
    expect(existsSync(inGame(`${ADDR}/adboards_chile.bundle`))).toBe(false)

    await svc.deactivate(cl)
    expect(await readGame(CAT)).toBe('ORIG-CATALOG')
    expect(existsSync(inGame(`${ADDR}/adboards_champions.bundle`))).toBe(false)
    expect(existsSync(path.join(root, 'data', 'backups', ...CAT.split('/')))).toBe(false)
  })

  it('desactivar primero el de abajo no toca el catálogo que está puesto', async () => {
    const svc = await makeService()
    const [cl, ch] = await addTwo(svc)
    await svc.activate(cl)
    await svc.activate(ch)

    await svc.deactivate(cl)
    expect(await readGame(CAT)).toBe('CAT-CH')
    expect(await status(svc, ch)).toBe('active')

    await svc.deactivate(ch)
    expect(await readGame(CAT)).toBe('ORIG-CATALOG')
  })

  it('volver a activar uno de abajo lo sube, y el original sigue a salvo', async () => {
    const svc = await makeService()
    const [cl, ch] = await addTwo(svc)
    await svc.activate(cl)
    await svc.activate(ch)

    await svc.activate(cl)
    expect(await readGame(CAT)).toBe('CAT-CL')

    await svc.deactivate(cl)
    expect(await readGame(CAT)).toBe('CAT-CH')
    await svc.deactivate(ch)
    expect(await readGame(CAT)).toBe('ORIG-CATALOG')
  })

  it('dos packs que reemplazan el mismo bundle de contenido siguen en conflicto aunque compartan catálogo', async () => {
    const svc = await makeService()
    await svc.addPaths([await pack('uno', 'adboards_assets_all.bundle', 'CAT-1')])
    await svc.addPaths([await pack('dos', 'adboards_assets_all.bundle', 'CAT-2')])
    const [a, b] = (await svc.getState()).mods
    expect(a.conflictsWith.map((c) => c.id)).toEqual([b.id])

    await svc.activate(a.id)
    await expect(svc.activate(b.id)).rejects.toMatchObject({
      info: { code: 'CONFLICT', params: { mods: 'uno' } }
    })

    // Y "Cambiar a este mod" deja el catálogo y el bundle del nuevo.
    await svc.swapMod(b.id)
    expect(await readGame(CAT)).toBe('CAT-2')
    expect(await readGame(`${ADDR}/adboards_assets_all.bundle`)).toBe('BUNDLE-dos')
    await svc.deactivate(b.id)
    expect(await readGame(CAT)).toBe('ORIG-CATALOG')
    expect(await readGame(`${ADDR}/adboards_assets_all.bundle`)).toBe('ORIG-AD')
  })

  it('si Steam repone el catálogo, los mods quedan parciales y se puede volver a empezar', async () => {
    const svc = await makeService()
    const [cl, ch] = await addTwo(svc)
    await svc.activate(cl)
    await svc.activate(ch)

    await writeFile(inGame(CAT), 'ORIG-CATALOG-V2')
    expect(await status(svc, cl)).toBe('partial')
    expect(await status(svc, ch)).toBe('partial')

    await svc.activate(cl)
    expect(await readGame(CAT)).toBe('CAT-CL')
    await svc.deactivate(cl)
    // Lo que había al volver a empezar es el nuevo original.
    expect(await readGame(CAT)).toBe('ORIG-CATALOG-V2')
  })

  it('si falta el archivo del mod de abajo al sacar el de arriba, se repone el original', async () => {
    const svc = await makeService()
    const [cl, ch] = await addTwo(svc)
    await svc.activate(cl)
    await svc.activate(ch)

    const champions = (await svc.getState()).mods.find((m) => m.id === cl)!
    await rm(champions.files.find((f) => f.target.endsWith('catalog_info.bin'))!.source)

    await svc.deactivate(ch)
    expect(await readGame(CAT)).toBe('ORIG-CATALOG')
  })

  it('un mod con catálogo propio se activa y se quita sin afectar a un mod de interfaz', async () => {
    const svc = await makeService()
    await mkdir(inGame(AA), { recursive: true })
    await writeFile(inGame(`${AA}/ui-match.bundle`), 'ORIG-UI')
    await svc.addPaths([await pack('vallas', 'adboards_nuevo.bundle', 'CAT-V')])
    await svc.addPaths([await makeZip('marcador.zip', { 'files/ui-match.bundle': 'UI-MOD' })])
    const [vallas, marcador] = (await svc.getState()).mods

    await svc.activate(vallas.id)
    await svc.activate(marcador.id)
    expect(await status(svc, vallas.id)).toBe('active')
    expect(await status(svc, marcador.id)).toBe('active')
    expect(await readGame(`${AA}/ui-match.bundle`)).toBe('UI-MOD')

    await svc.deactivate(vallas.id)
    expect(await status(svc, marcador.id)).toBe('active')
    expect(await readGame(CAT)).toBe('ORIG-CATALOG')
  })

  it('migra una biblioteca de la 0.1 con un mod activo: sigue activo y se puede desactivar', async () => {
    let svc = await makeService()
    await svc.addPaths([await pack('vallas', 'adboards_nuevo.bundle', 'CAT-V')])
    const id = (await svc.getState()).mods[0].id
    await svc.activate(id)

    // Así se guardaba en la 0.1: sin la pila de archivos compartidos.
    const file = path.join(root, 'data', 'library.json')
    const saved = JSON.parse(await readFile(file, 'utf8'))
    delete saved.shared
    await writeFile(file, JSON.stringify(saved))

    svc = await makeService()
    expect(await status(svc, id)).toBe('active')
    await svc.deactivate(id)
    expect(await readGame(CAT)).toBe('ORIG-CATALOG')
    expect(existsSync(inGame(`${ADDR}/adboards_nuevo.bundle`))).toBe(false)
  })

  it('quitar de la lista los mods apilados limpia la pila', async () => {
    const svc = await makeService()
    const [cl, ch] = await addTwo(svc)
    await svc.activate(cl)
    await svc.activate(ch)
    await svc.deactivate(ch)
    await svc.deactivate(cl)
    await svc.removeMod(ch)
    await svc.removeMod(cl)
    expect((await svc.getState()).mods).toHaveLength(0)
    expect(await readGame(CAT)).toBe('ORIG-CATALOG')
  })
})
