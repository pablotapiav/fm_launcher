// Tipos compartidos entre el proceso principal, el preload y la interfaz.

export type Lang = 'es' | 'en'

export interface Settings {
  language: Lang
  /** Ruta manual de la carpeta del juego. null = detectar automáticamente. */
  gameDir: string | null
  /** Si es false, no se guardan respaldos de los archivos originales. */
  backupsEnabled: boolean
  /** Carpeta de respaldos. null = la carpeta por defecto del launcher. */
  backupDir: string | null
  /** El usuario ya vio el aviso de primera ejecución. */
  introAcknowledged: boolean
}

/** Un archivo de un mod. */
export interface ModFile {
  /** Ruta absoluta del archivo del mod en el disco del usuario. */
  source: string
  /**
   * Ruta relativa dentro de la carpeta del juego, con "/" (por ejemplo
   * "fm_Data/StreamingAssets/AddrData/catalog_info.bin").
   */
  target: string
  /**
   * true si la ruta viene de la estructura del mod (un zip o carpeta que copia fm_Data):
   * el archivo puede ser nuevo y no existir aún en el juego.
   * false si es un .bundle suelto cuya ubicación se buscó por nombre.
   */
  mirrored: boolean
}

/** Versión del juego para la que el autor dice que hizo el mod (leída de sus notas de instalación). */
export interface DeclaredCompat {
  /** Versión interna, por ejemplo "27.0.0+2493426". */
  version?: string
  /** Build de Steam, por ejemplo "26340721". */
  buildId?: string
}

export interface Mod {
  id: string
  name: string
  files: ModFile[]
  addedAt: number
  declared?: DeclaredCompat
  /** Archivo comprimido del que salió el mod, si vino de uno. */
  origin?: string
}

/** Respaldo del archivo original que existía antes de aplicar un mod. */
export interface BackupRecord {
  target: string
  path: string
  /** false si el archivo no existía en el juego antes del mod (al revertir se borra). */
  existed: boolean
  /** Hash del archivo respaldado. */
  hash: string
  /** Build del juego en el momento del respaldo. */
  buildId: string | null
  time: number
}

/** Qué mod está aplicado hoy sobre cada archivo del juego. */
export interface OwnerRecord {
  modId: string
  /** Hash del archivo tal como el launcher lo dejó en el juego. */
  hash: string
  time: number
}

export interface Library {
  version: 2
  settings: Settings
  mods: Mod[]
  backups: Record<string, BackupRecord>
  owners: Record<string, OwnerRecord>
  /**
   * Archivos compartidos (catálogo): pila de mods activos sobre cada uno, en orden de activación.
   * El último es el que está puesto en el juego; el respaldo guarda siempre el original.
   */
  shared: Record<string, OwnerRecord[]>
}

export interface GameInfo {
  gameDir: string
  bundleDir: string
  buildId: string | null
  /** Versión interna del juego (la de la última vez que se abrió), por ejemplo "27.0.0+2493426". */
  version: string | null
  appId: string
}

export type FileState = 'active' | 'inactive'

export interface ModFileView {
  source: string
  target: string
  sourceExists: boolean
  targetExists: boolean
  state: FileState
  /** El archivo del mod cambió desde que se aplicó (hay una versión nueva). */
  outdated: boolean
}

export type ModStatus = 'active' | 'partial' | 'inactive' | 'missing'

/** Etiqueta inteligente deducida de los archivos del mod. */
export interface ModTag {
  id: string
  group: 'media' | 'interface' | 'world' | 'data' | 'warn'
}

export interface ModView {
  id: string
  name: string
  tags: ModTag[]
  /** Nombre del archivo comprimido de origen, si lo hay. */
  origin: string | null
  status: ModStatus
  files: ModFileView[]
  /** Otros mods que reemplazan alguno de los mismos archivos. */
  conflictsWith: { id: string; name: string }[]
  /** Subconjunto de conflictsWith que está activo ahora mismo. */
  blockedBy: { id: string; name: string }[]
  compat: ModCompat
}

export interface ModCompat {
  /**
   * match: misma versión base (27.0.0); un número de compilación distinto no cuenta como diferencia.
   * different: el mod declara otra versión base u otro build de Steam; solo se muestra como nota.
   */
  state: 'match' | 'different' | 'unknown'
  /** Lo que declara el mod y lo que tiene el usuario, para mostrarlo. */
  declared?: string
  current?: string
  /** true si coinciden también en el número de compilación. */
  exact?: boolean
}

export interface AppState {
  game: GameInfo | null
  gameRunning: boolean
  settings: Settings
  backupDir: string
  mods: ModView[]
  version: string
}

/** Códigos de error que la interfaz traduce a mensajes. */
export type ErrorCode =
  | 'GAME_RUNNING'
  | 'GAME_NOT_FOUND'
  | 'MOD_NOT_FOUND'
  | 'SOURCE_MISSING'
  | 'TARGET_MISSING'
  | 'CONFLICT'
  | 'NO_BACKUP'
  | 'BUILD_CHANGED'
  | 'MOD_ACTIVE'
  | 'NOTHING_ADDED'
  | 'INVALID_GAME_DIR'
  | 'WRONG_FILE'
  | 'ARCHIVE_FAILED'
  | 'IO'

export interface LauncherErrorInfo {
  code: ErrorCode
  /** Datos para rellenar el mensaje (nombres de mods, archivos, etc.). */
  params?: Record<string, string>
  /** Conviene ofrecer "Verificar archivos en Steam". */
  suggestSteamVerify?: boolean
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: LauncherErrorInfo }

export interface AddReport {
  added: string[]
  /** Rutas que ya estaban en la biblioteca. */
  duplicates: string[]
  /** Rutas ignoradas por no contener .bundle. */
  ignored: string[]
  /** Archivos sueltos que no se encontraron en la carpeta del juego (no se podrán activar). */
  unknownTargets: string[]
  /** Archivos del mod ignorados por estar fuera de StreamingAssets o ser ejecutables. */
  skipped: string[]
}

export interface LauncherApi {
  getState(): Promise<AppState>
  addPaths(paths: string[]): Promise<Result<AddReport>>
  pickFiles(): Promise<Result<AddReport> | null>
  pickFolder(): Promise<Result<AddReport> | null>
  activate(modId: string): Promise<Result<null>>
  deactivate(modId: string): Promise<Result<null>>
  /** Desactiva los mods que chocan con este y lo activa. */
  swapMod(modId: string): Promise<Result<null>>
  removeMod(modId: string): Promise<Result<null>>
  renameMod(modId: string, name: string): Promise<Result<null>>
  relocateFile(modId: string, target: string): Promise<Result<null> | null>
  setSettings(patch: Partial<Settings>): Promise<Result<null>>
  pickGameDir(): Promise<Result<null> | null>
  pickBackupDir(): Promise<Result<null> | null>
  openBackupDir(): Promise<void>
  /** Abre en el navegador uno de los enlaces de contacto conocidos (Twitter o GitHub). */
  openLink(kind: 'twitter' | 'github'): Promise<void>
  copyText(text: string): Promise<void>
  /** Avisa de errores inesperados del proceso principal. */
  onFatalError(cb: (message: string) => void): () => void
  launchGame(): Promise<Result<null>>
  steamVerify(): Promise<void>
  onGameRunning(cb: (running: boolean) => void): () => void
  getPathForFile(file: File): string
}
