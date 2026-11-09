import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LauncherService } from '../src/main/core/service'

let root: string
let gameDir: string
let bundleDir: string
let modsDir: string
let running = false

const ORIGINAL = 'ORIGINAL-CONTENT'
const REL = 'fm_Data/StreamingAssets/aa/StandaloneWindows64'
const T = (name: string): string => `${REL}/${name}`
const backupOf = (name: string): string => path.join(root, 'data', 'backups', ...REL.split('/'), name)

async function makeService(): Promise<LauncherService> {
  const svc = await LauncherService.create({
    libraryFile: path.join(root, 'data', 'library.json'),
    defaultBackupDir: path.join(root, 'data', 'backups'),
    modsDir: path.join(root, 'data', 'mods'),
    version: 'test',
    isGameRunning: async () => running
  })
  await svc.setSettings({ gameDir })
  return svc
}

async function writeMod(name: string, content: string, dir = modsDir): Promise<string> {
  await mkdir(dir, { recursive: true })
  const file = path.join(dir, name)
  await writeFile(file, content)
  return file
}

const gameFile = (name: string): Promise<string> => readFile(path.join(bundleDir, name), 'utf8')

async function setBuild(id: string): Promise<void> {
  await writeFile(
    path.join(root, 'steamapps', 'appmanifest_4530370.acf'),
    `"AppState"\n{\n\t"appid"\t\t"4530370"\n\t"buildid"\t\t"${id}"\n}\n`
  )
}

beforeEach(async () => {
  running = false
  root = await mkdtemp(path.join(os.tmpdir(), 'fm-launcher-test-'))
  gameDir = path.join(root, 'steamapps', 'common', 'Football Manager 27')
  bundleDir = path.join(gameDir, 'fm_Data', 'StreamingAssets', 'aa', 'StandaloneWindows64')
  modsDir = path.join(root, 'mods')
  await mkdir(bundleDir, { recursive: true })
  await writeFile(path.join(gameDir, 'fm.exe'), '')
  await writeFile(path.join(bundleDir, 'ui-match.bundle'), ORIGINAL)
  await writeFile(path.join(bundleDir, 'ui-other.bundle'), ORIGINAL + '-2')
  await setBuild('100')
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('biblioteca', () => {
  it('agrega un bundle suelto como un mod y detecta si su destino no existe', async () => {
    const svc = await makeService()
    const ok = await writeMod('ui-match.bundle', 'MOD-A')
    const unknown = await writeMod('no-existe.bundle', 'X')
    const report = await svc.addPaths([ok, unknown])
    expect(report.added).toEqual(['ui-match', 'no-existe'])
    expect(report.unknownTargets).toEqual(['no-existe.bundle'])
    const state = await svc.getState()
    expect(state.mods).toHaveLength(2)
    expect(state.mods[0].status).toBe('inactive')
  })

  it('una carpeta con bundles es un mod; una carpeta con subcarpetas, varios', async () => {
    const svc = await makeService()
    await writeMod('ui-match.bundle', 'A', path.join(modsDir, 'pack1'))
    await writeMod('ui-other.bundle', 'B', path.join(modsDir, 'pack1'))
    await writeMod('ui-match.bundle', 'C', path.join(modsDir, 'pack2'))
    await writeMod('readme.txt', 'hola', path.join(modsDir, 'pack2'))

    const one = await svc.addPaths([path.join(modsDir, 'pack1')])
    expect(one.added).toEqual(['pack1'])
    const many = await svc.addPaths([modsDir])
    expect(many.added).toEqual(['pack2'])
    expect(many.duplicates).toEqual(['pack1'])

    const state = await svc.getState()
    expect(state.mods.find((m) => m.name === 'pack1')?.files).toHaveLength(2)
  })

  it('rechaza lo que no contiene bundles', async () => {
    const svc = await makeService()
    const txt = await writeMod('nota.txt', 'x')
    await expect(svc.addPaths([txt])).rejects.toMatchObject({ info: { code: 'NOTHING_ADDED' } })
  })

  it('marca como no encontrado un mod cuyo archivo desapareció y permite relocalizarlo', async () => {
    const svc = await makeService()
    const src = await writeMod('ui-match.bundle', 'MOD-A')
    await svc.addPaths([src])
    await rm(src)
    let state = await svc.getState()
    expect(state.mods[0].status).toBe('missing')
    await expect(svc.activate(state.mods[0].id)).rejects.toMatchObject({ info: { code: 'SOURCE_MISSING' } })

    const moved = await writeMod('ui-match.bundle', 'MOD-A', path.join(root, 'otra'))
    await expect(
      svc.relocateFile(state.mods[0].id, T('ui-match.bundle'), await writeMod('otro.bundle', 'x'))
    ).rejects.toMatchObject({ info: { code: 'WRONG_FILE' } })
    await svc.relocateFile(state.mods[0].id, T('ui-match.bundle'), moved)
    state = await svc.getState()
    expect(state.mods[0].status).toBe('inactive')
  })

  it('persiste la biblioteca entre sesiones', async () => {
    let svc = await makeService()
    await svc.addPaths([await writeMod('ui-match.bundle', 'MOD-A')])
    svc = await makeService()
    expect((await svc.getState()).mods).toHaveLength(1)
  })
})

describe('activar y desactivar', () => {
  it('reemplaza el bundle, respalda el original y lo restaura al desactivar', async () => {
    const svc = await makeService()
    await svc.addPaths([await writeMod('ui-match.bundle', 'MOD-A')])
    const id = (await svc.getState()).mods[0].id

    await svc.activate(id)
    expect(await gameFile('ui-match.bundle')).toBe('MOD-A')
    expect(existsSync(backupOf('ui-match.bundle'))).toBe(true)
    expect((await svc.getState()).mods[0].status).toBe('active')

    await svc.deactivate(id)
    expect(await gameFile('ui-match.bundle')).toBe(ORIGINAL)
    expect(existsSync(backupOf('ui-match.bundle'))).toBe(false)
    expect((await svc.getState()).mods[0].status).toBe('inactive')
  })

  it('activar dos veces no pierde el original', async () => {
    const svc = await makeService()
    await svc.addPaths([await writeMod('ui-match.bundle', 'MOD-A')])
    const id = (await svc.getState()).mods[0].id
    await svc.activate(id)
    await svc.activate(id)
    await svc.deactivate(id)
    expect(await gameFile('ui-match.bundle')).toBe(ORIGINAL)
  })

  it('un mod con varios bundles los aplica y revierte todos', async () => {
    const svc = await makeService()
    await writeMod('ui-match.bundle', 'A1', path.join(modsDir, 'pack'))
    await writeMod('ui-other.bundle', 'A2', path.join(modsDir, 'pack'))
    await svc.addPaths([path.join(modsDir, 'pack')])
    const id = (await svc.getState()).mods[0].id
    await svc.activate(id)
    expect(await gameFile('ui-other.bundle')).toBe('A2')
    await svc.deactivate(id)
    expect(await gameFile('ui-match.bundle')).toBe(ORIGINAL)
    expect(await gameFile('ui-other.bundle')).toBe(ORIGINAL + '-2')
  })

  it('avisa del conflicto cuando dos mods reemplazan el mismo archivo', async () => {
    const svc = await makeService()
    await svc.addPaths([
      await writeMod('ui-match.bundle', 'MOD-A', path.join(modsDir, 'a')),
      await writeMod('ui-match.bundle', 'MOD-B', path.join(modsDir, 'b'))
    ])
    const [a, b] = (await svc.getState()).mods
    expect(a.conflictsWith.map((c) => c.id)).toEqual([b.id])

    await svc.activate(a.id)
    let state = await svc.getState()
    expect(state.mods[1].blockedBy.map((c) => c.id)).toEqual([a.id])
    await expect(svc.activate(b.id)).rejects.toMatchObject({
      info: { code: 'CONFLICT', params: { mods: a.name } }
    })
    expect(await gameFile('ui-match.bundle')).toBe('MOD-A')

    await svc.deactivate(a.id)
    await svc.activate(b.id)
    state = await svc.getState()
    expect(state.mods[1].status).toBe('active')
    expect(state.mods[0].blockedBy.map((c) => c.id)).toEqual([b.id])
  })

  it('no hace nada con el juego abierto', async () => {
    const svc = await makeService()
    await svc.addPaths([await writeMod('ui-match.bundle', 'MOD-A')])
    const id = (await svc.getState()).mods[0].id
    running = true
    await expect(svc.activate(id)).rejects.toMatchObject({ info: { code: 'GAME_RUNNING' } })
    expect(await gameFile('ui-match.bundle')).toBe(ORIGINAL)
  })

  it('no activa un mod cuyo archivo no existe en el juego', async () => {
    const svc = await makeService()
    await svc.addPaths([await writeMod('no-existe.bundle', 'X')])
    const id = (await svc.getState()).mods[0].id
    await expect(svc.activate(id)).rejects.toMatchObject({ info: { code: 'TARGET_MISSING' } })
  })

  it('detecta que Steam revirtió el mod y vuelve a respaldar lo que hay ahora', async () => {
    const svc = await makeService()
    await svc.addPaths([await writeMod('ui-match.bundle', 'MOD-A')])
    const id = (await svc.getState()).mods[0].id
    await svc.activate(id)

    // Steam repone el archivo original (con otro contenido por un parche).
    await writeFile(path.join(bundleDir, 'ui-match.bundle'), 'ORIGINAL-V2')
    expect((await svc.getState()).mods[0].status).toBe('inactive')

    await svc.activate(id)
    await svc.deactivate(id)
    expect(await gameFile('ui-match.bundle')).toBe('ORIGINAL-V2')
  })

  it('desactivar un mod que Steam ya revirtió no toca el archivo', async () => {
    const svc = await makeService()
    await svc.addPaths([await writeMod('ui-match.bundle', 'MOD-A')])
    const id = (await svc.getState()).mods[0].id
    await svc.activate(id)
    await writeFile(path.join(bundleDir, 'ui-match.bundle'), 'ORIGINAL-V2')
    await svc.deactivate(id)
    expect(await gameFile('ui-match.bundle')).toBe('ORIGINAL-V2')
  })

  it('no restaura un respaldo hecho en otra versión del juego', async () => {
    const svc = await makeService()
    await svc.addPaths([await writeMod('ui-match.bundle', 'MOD-A')])
    const id = (await svc.getState()).mods[0].id
    await svc.activate(id)
    await setBuild('200')
    await expect(svc.deactivate(id)).rejects.toMatchObject({
      info: { code: 'BUILD_CHANGED', suggestSteamVerify: true }
    })
    expect(await gameFile('ui-match.bundle')).toBe('MOD-A')
  })

  it('sin respaldos no se puede revertir y se sugiere verificar en Steam', async () => {
    const svc = await makeService()
    await svc.setSettings({ backupsEnabled: false })
    await svc.addPaths([await writeMod('ui-match.bundle', 'MOD-A')])
    const id = (await svc.getState()).mods[0].id
    await svc.activate(id)
    expect(existsSync(backupOf('ui-match.bundle'))).toBe(false)
    await expect(svc.deactivate(id)).rejects.toMatchObject({
      info: { code: 'NO_BACKUP', suggestSteamVerify: true }
    })
  })

  it('usa la carpeta de respaldos elegida', async () => {
    const svc = await makeService()
    const custom = path.join(root, 'mis-respaldos')
    await svc.setSettings({ backupDir: custom })
    await svc.addPaths([await writeMod('ui-match.bundle', 'MOD-A')])
    await svc.activate((await svc.getState()).mods[0].id)
    expect(existsSync(path.join(custom, ...REL.split('/'), 'ui-match.bundle'))).toBe(true)
  })

  it('detecta que el archivo del mod cambió después de aplicarlo', async () => {
    const svc = await makeService()
    const src = await writeMod('ui-match.bundle', 'MOD-A')
    await svc.addPaths([src])
    const id = (await svc.getState()).mods[0].id
    await svc.activate(id)
    await writeFile(src, 'MOD-A-v2')
    expect((await svc.getState()).mods[0].files[0].outdated).toBe(true)
    await svc.activate(id)
    expect((await svc.getState()).mods[0].files[0].outdated).toBe(false)
    await svc.deactivate(id)
    expect(await gameFile('ui-match.bundle')).toBe(ORIGINAL)
  })

  it('no permite quitar un mod activo', async () => {
    const svc = await makeService()
    await svc.addPaths([await writeMod('ui-match.bundle', 'MOD-A')])
    const id = (await svc.getState()).mods[0].id
    await svc.activate(id)
    await expect(svc.removeMod(id)).rejects.toMatchObject({ info: { code: 'MOD_ACTIVE' } })
    await svc.deactivate(id)
    await svc.removeMod(id)
    expect((await svc.getState()).mods).toHaveLength(0)
  })

  it('rechaza una carpeta de juego inválida', async () => {
    const svc = await makeService()
    await expect(svc.setSettings({ gameDir: root })).rejects.toMatchObject({
      info: { code: 'INVALID_GAME_DIR' }
    })
  })
})
