// Datos de ejemplo para la captura del README (se inyecta antes de que cargue la interfaz).
const { contextBridge } = require('electron')

const AA = 'fm_Data/StreamingAssets/aa/StandaloneWindows64/'
const AD = 'fm_Data/StreamingAssets/AddrData/'
const base = { conflictsWith: [], blockedBy: [], compat: { state: 'unknown' } }
const file = (target, source, state = 'inactive') => ({
  source,
  target,
  sourceExists: true,
  targetExists: true,
  state,
  outdated: false
})

const state = {
  game: { gameDir: 'C:\\Steam\\FM27', bundleDir: 'x', buildId: '26340721', version: '27.0.0+2493426', appId: '4530370' },
  gameRunning: false,
  settings: { language: 'es', gameDir: null, backupsEnabled: true, backupDir: null, introAcknowledged: true },
  backupDir: 'C:\\x',
  version: '0.2.0',
  mods: [
    {
      ...base,
      id: '1',
      name: 'Ejemplo: Botones de datos en partido',
      origin: 'botones-partido.zip',
      status: 'active',
      tags: [{ id: 'ui', group: 'interface' }, { id: 'match-ui', group: 'interface' }],
      files: [file(AA + 'ui-match.bundle', 'C:\\Mods\\a.bundle', 'active')],
      compat: { state: 'match', declared: '27.0.0+2493426', current: '27.0.0+2493426', exact: true }
    },
    {
      ...base,
      id: '2',
      name: 'Ejemplo: Vallas publicitarias',
      origin: 'vallas.zip',
      status: 'inactive',
      tags: [{ id: 'adboards', group: 'media' }],
      files: [file(AD + 'adboards_assets_all.bundle', 'C:\\Mods\\b.bundle'), file(AD + 'catalog_info.bin', 'C:\\Mods\\c.bin')]
    },
    {
      ...base,
      id: '3',
      name: 'Ejemplo: Sonido de hinchada',
      origin: null,
      status: 'inactive',
      tags: [{ id: 'audio', group: 'media' }],
      files: [file(AD + 'audio_assets_all.bundle', 'C:\\Mods\\d.bundle')]
    }
  ]
}

const ok = async () => ({ ok: true, data: null })
contextBridge.exposeInMainWorld('api', {
  getState: async () => state,
  addPaths: async () => ({ ok: true, data: { added: [], duplicates: [], ignored: [], unknownTargets: [], skipped: [] } }),
  pickFiles: async () => null,
  pickFolder: async () => null,
  activate: ok,
  deactivate: ok,
  swapMod: ok,
  removeMod: ok,
  renameMod: ok,
  relocateFile: async () => null,
  setSettings: ok,
  pickGameDir: async () => null,
  pickBackupDir: async () => null,
  openBackupDir: async () => {},
  openLink: async () => {},
  copyText: async () => {},
  launchGame: ok,
  steamVerify: async () => {},
  onFatalError: () => () => {},
  onGameRunning: () => () => {},
  getPathForFile: () => ''
})
