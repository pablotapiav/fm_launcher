import { randomUUID } from 'node:crypto'
import { rm } from 'node:fs/promises'
import path from 'node:path'
import type { AddReport, AppState, GameInfo, Library, Mod, ModFile, Settings } from '../../shared/types'
import { extractArchive } from './archive'
import { activateMod, buildViews, deactivateMod, type EngineContext } from './engine'
import { LauncherError } from './errors'
import { exists, key } from './fsutil'
import { LibraryStore } from './library'
import { BUNDLE_DIR_REL, targetName } from './paths'
import { isGameRunning as realIsGameRunning } from './process'
import { findInGame } from './resolve'
import { scanPaths } from './scan'
import { detectGame, inspectGameDir, readGameVersion } from './steam'

export interface ServiceOptions {
  libraryFile: string
  defaultBackupDir: string
  /** Carpeta donde se descomprimen los mods que vienen en .zip/.7z/.rar. */
  modsDir: string
  version: string
  /** Idioma por defecto la primera vez que se abre el launcher. */
  initialLanguage?: Settings['language']
  isGameRunning?: () => Promise<boolean>
  /** Cómo averiguar la versión interna del juego (se puede reemplazar en pruebas). */
  gameVersion?: () => Promise<string | null>
}

const isInside = (child: string, parent: string): boolean => {
  const rel = path.relative(parent, child)
  return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel)
}

/**
 * Lógica del launcher sin dependencias de Electron (se puede probar con carpetas temporales).
 * Todas las operaciones que cambian algo se ejecutan de a una.
 */
export class LauncherService {
  private queue: Promise<unknown> = Promise.resolve()
  private readonly store: LibraryStore
  private readonly isRunning: () => Promise<boolean>

  private constructor(
    private lib: Library,
    private readonly opts: ServiceOptions
  ) {
    this.store = new LibraryStore(opts.libraryFile)
    this.isRunning = opts.isGameRunning ?? realIsGameRunning
  }

  static async create(opts: ServiceOptions): Promise<LauncherService> {
    const store = new LibraryStore(opts.libraryFile)
    const fileExisted = await exists(opts.libraryFile)
    const lib = await store.load()
    if (!fileExisted && opts.initialLanguage) lib.settings.language = opts.initialLanguage
    return new LauncherService(lib, opts)
  }

  private serialize<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.queue.then(fn, fn)
    this.queue = next.catch(() => undefined)
    return next
  }

  /** Ejecuta una operación que modifica la biblioteca y la guarda siempre al terminar. */
  private mutate<T>(fn: () => Promise<T>): Promise<T> {
    return this.serialize(async () => {
      try {
        return await fn()
      } finally {
        await this.store.save(this.lib)
      }
    })
  }

  /** Localiza el juego y le agrega la versión interna (si el juego ya se abrió alguna vez). */
  private async detect(): Promise<GameInfo | null> {
    const game = await detectGame(this.lib.settings.gameDir)
    if (game) game.version = await (this.opts.gameVersion ?? readGameVersion)()
    return game
  }

  get backupDir(): string {
    return this.lib.settings.backupDir ?? this.opts.defaultBackupDir
  }

  private async context(): Promise<EngineContext> {
    return {
      game: await this.detect(),
      backupDir: this.backupDir,
      backupsEnabled: this.lib.settings.backupsEnabled,
      isGameRunning: this.isRunning
    }
  }

  async getGame(): Promise<GameInfo | null> {
    return this.detect()
  }

  async gameRunning(): Promise<boolean> {
    return this.isRunning()
  }

  async getState(): Promise<AppState> {
    const game = await this.detect()
    return {
      game,
      gameRunning: await this.isRunning(),
      settings: { ...this.lib.settings },
      backupDir: this.backupDir,
      mods: await buildViews(this.lib, game),
      version: this.opts.version
    }
  }

  addPaths(paths: string[]): Promise<AddReport> {
    return this.mutate(async () => {
      const { candidates, ignored, skipped } = await scanPaths(paths, {
        extract: (archive) => extractArchive(archive, this.opts.modsDir)
      })
      if (candidates.length === 0) throw new LauncherError({ code: 'NOTHING_ADDED' })
      const game = await this.detect()

      const report: AddReport = { added: [], duplicates: [], ignored, unknownTargets: [], skipped }
      const signature = (files: string[]): string =>
        files.map((f) => path.resolve(f).toLowerCase()).sort().join('|')
      const known = new Set(this.lib.mods.map((m) => signature(m.files.map((f) => f.source))))

      for (const c of candidates) {
        const sig = signature(c.files.map((f) => f.source))
        if (known.has(sig)) {
          report.duplicates.push(c.name)
          continue
        }
        known.add(sig)

        const files: ModFile[] = []
        for (const f of c.files) {
          if (f.target) {
            files.push({ source: f.source, target: f.target, mirrored: f.mirrored })
            continue
          }
          // .bundle suelto: se busca en el juego dónde vive un archivo con ese nombre.
          const name = path.basename(f.source)
          const found = game ? await findInGame(game, name) : null
          if (!found) report.unknownTargets.push(name)
          files.push({ source: f.source, target: found ?? `${BUNDLE_DIR_REL}/${name}`, mirrored: false })
        }

        const mod: Mod = {
          id: randomUUID(),
          name: c.name,
          files,
          addedAt: Date.now(),
          origin: c.origin,
          declared: c.declared
        }
        this.lib.mods.push(mod)
        report.added.push(mod.name)
      }
      return report
    })
  }

  activate(modId: string): Promise<void> {
    return this.mutate(async () => activateMod(this.lib, modId, await this.context()))
  }

  deactivate(modId: string): Promise<void> {
    return this.mutate(async () => deactivateMod(this.lib, modId, await this.context()))
  }

  /**
   * "Cambiar a este mod": como dos mods que reemplazan el mismo archivo son excluyentes, desactiva
   * los que están activos sobre esos archivos y activa este. Si la activación falla, intenta
   * volver a dejar activos los que se habían desactivado.
   */
  swapMod(modId: string): Promise<void> {
    return this.mutate(async () => {
      const ctx = await this.context()
      const views = await buildViews(this.lib, ctx.game)
      const target = views.find((v) => v.id === modId)
      if (!target) throw new LauncherError({ code: 'MOD_NOT_FOUND' })

      const blockers = target.blockedBy.map((b) => b.id)
      const deactivated: string[] = []
      try {
        for (const id of blockers) {
          await deactivateMod(this.lib, id, ctx)
          deactivated.push(id)
        }
        await activateMod(this.lib, modId, ctx)
      } catch (err) {
        for (const id of deactivated) await activateMod(this.lib, id, ctx).catch(() => undefined)
        throw err
      }
    })
  }

  removeMod(modId: string): Promise<void> {
    return this.mutate(async () => {
      const game = await this.detect()
      const view = (await buildViews(this.lib, game)).find((v) => v.id === modId)
      if (!view) throw new LauncherError({ code: 'MOD_NOT_FOUND' })
      if (view.status === 'active' || view.status === 'partial') {
        throw new LauncherError({ code: 'MOD_ACTIVE' })
      }
      const mod = this.lib.mods.find((m) => m.id === modId) as Mod
      this.lib.mods = this.lib.mods.filter((m) => m.id !== modId)
      for (const [k, owner] of Object.entries(this.lib.owners)) {
        if (owner.modId === modId) delete this.lib.owners[k]
      }
      await this.cleanupExtracted(mod)
    })
  }

  /** Borra los archivos descomprimidos por el launcher cuando ningún otro mod los usa. */
  private async cleanupExtracted(mod: Mod): Promise<void> {
    const root = path.resolve(this.opts.modsDir)
    const tops = new Set<string>()
    for (const f of mod.files) {
      const abs = path.resolve(f.source)
      if (!isInside(abs, root)) continue
      tops.add(path.join(root, path.relative(root, abs).split(path.sep)[0]))
    }
    for (const top of tops) {
      const stillUsed = this.lib.mods.some((m) => m.files.some((f) => isInside(path.resolve(f.source), top)))
      if (!stillUsed) await rm(top, { recursive: true, force: true }).catch(() => undefined)
    }
  }

  renameMod(modId: string, name: string): Promise<void> {
    return this.mutate(async () => {
      const mod = this.lib.mods.find((m) => m.id === modId)
      if (!mod) throw new LauncherError({ code: 'MOD_NOT_FOUND' })
      const trimmed = name.trim()
      if (trimmed) mod.name = trimmed
    })
  }

  /** Apunta un archivo del mod a una nueva ubicación (cuando se movió o borró). */
  relocateFile(modId: string, target: string, newSource: string): Promise<void> {
    return this.mutate(async () => {
      const mod = this.lib.mods.find((m) => m.id === modId)
      const file = mod?.files.find((f) => key(f.target) === key(target))
      if (!mod || !file) throw new LauncherError({ code: 'MOD_NOT_FOUND' })
      if (key(path.basename(newSource)) !== key(targetName(file.target))) {
        throw new LauncherError({ code: 'WRONG_FILE', params: { expected: targetName(file.target) } })
      }
      file.source = newSource
    })
  }

  setSettings(patch: Partial<Settings>): Promise<void> {
    return this.mutate(async () => {
      if (patch.gameDir) {
        const info = await inspectGameDir(patch.gameDir)
        if (!info) throw new LauncherError({ code: 'INVALID_GAME_DIR' })
      }
      this.lib.settings = { ...this.lib.settings, ...patch }
    })
  }
}
