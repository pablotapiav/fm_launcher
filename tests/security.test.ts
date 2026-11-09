import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LauncherService } from '../src/main/core/service'

let root: string
let gameDir: string

const AA = 'fm_Data/StreamingAssets/aa/StandaloneWindows64'

async function makeService(): Promise<LauncherService> {
  return LauncherService.create({
    libraryFile: path.join(root, 'data', 'library.json'),
    defaultBackupDir: path.join(root, 'data', 'backups'),
    modsDir: path.join(root, 'data', 'mods'),
    version: 'test',
    isGameRunning: async () => false,
    gameVersion: async () => null
  })
}

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'fm-launcher-sec-'))
  gameDir = path.join(root, 'steamapps', 'common', 'Football Manager 27')
  await mkdir(path.join(gameDir, ...AA.split('/')), { recursive: true })
  await writeFile(path.join(gameDir, 'fm.exe'), '')
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('ajustes que llegan desde la interfaz', () => {
  it('acepta ajustes válidos', async () => {
    const svc = await makeService()
    await svc.setSettings({ language: 'en', backupsEnabled: false, introAcknowledged: true })
    const { settings } = await svc.getState()
    expect(settings).toMatchObject({ language: 'en', backupsEnabled: false, introAcknowledged: true })
    await svc.setSettings({ backupDir: path.join(root, 'respaldos') })
    expect((await svc.getState()).backupDir).toBe(path.join(root, 'respaldos'))
  })

  it.each([
    ['un ajuste desconocido', { inventado: true }],
    ['un idioma inexistente', { language: 'fr' }],
    ['un tipo equivocado', { backupsEnabled: 'si' }],
    ['una ruta relativa de respaldos', { backupDir: '..\\..\\x' }],
    ['una ruta que no es texto', { gameDir: 42 }],
    ['una clave peligrosa', JSON.parse('{"__proto__": {"language": "en"}}')],
    ['una clave constructor', { constructor: 'x' }]
  ])('rechaza %s', async (_name, patch) => {
    const svc = await makeService()
    await expect(svc.setSettings(patch as never)).rejects.toMatchObject({ info: { code: 'IO' } })
    // Y no cambia nada.
    expect((await svc.getState()).settings.language).toBe('es')
  })
})

describe('biblioteca editada a mano o dañada', () => {
  it('descarta archivos cuyo destino se sale de StreamingAssets o es un ejecutable', async () => {
    const file = path.join(root, 'data', 'library.json')
    await mkdir(path.dirname(file), { recursive: true })
    const good = { source: 'C:\\Mods\\ok.bundle', target: `${AA}/ok.bundle`, mirrored: false }
    await writeFile(
      file,
      JSON.stringify({
        version: 2,
        settings: { language: 'es', gameDir: gameDir, backupsEnabled: true, backupDir: null, introAcknowledged: true },
        mods: [
          { id: 'a', name: 'Bueno', addedAt: 1, files: [good] },
          {
            id: 'b',
            name: 'Malo',
            addedAt: 1,
            files: [
              { source: 'C:\\x', target: '../../Windows/System32/evil.dll', mirrored: true },
              { source: 'C:\\x', target: 'C:/Windows/evil.bundle', mirrored: true },
              { source: 'C:\\x', target: 'fm_Data/StreamingAssets/../../fm.exe', mirrored: true },
              { source: 'C:\\x', target: 'fm_Data/StreamingAssets/AddrData/instalar.bat', mirrored: true },
              { source: 'C:\\x', target: 'fm_Data/Plugins/otro.bundle', mirrored: true },
              { source: 'C:\\x', target: 'fm_Data/StreamingAssets/AddrData/a.bundle:secreto', mirrored: true },
              { source: 42, target: `${AA}/raro.bundle`, mirrored: false }
            ]
          },
          { id: 'c', name: 'Mezclado', addedAt: 1, files: [good, { source: 'C:\\x', target: '..\\evil.bundle', mirrored: true }] },
          null,
          'texto',
          { id: 'd', name: 'Sin archivos', addedAt: 1 }
        ],
        backups: {},
        owners: {}
      })
    )

    const svc = await makeService()
    const mods = (await svc.getState()).mods
    expect(mods.map((m) => m.name)).toEqual(['Bueno', 'Mezclado'])
    // El mod mezclado conserva solo el archivo seguro.
    expect(mods[1].files.map((f) => f.target)).toEqual([`${AA}/ok.bundle`])
  })

  it('una biblioteca que no es JSON se aparta y se empieza de cero', async () => {
    const file = path.join(root, 'data', 'library.json')
    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(file, '{ esto no es json')
    const svc = await makeService()
    expect((await svc.getState()).mods).toEqual([])
  })
})
