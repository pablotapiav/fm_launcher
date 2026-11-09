import { rm } from 'node:fs/promises'
import path from 'node:path'
import type {
  BackupRecord,
  DeclaredCompat,
  GameInfo,
  Library,
  Mod,
  ModCompat,
  ModFile,
  ModStatus,
  ModView,
  OwnerRecord
} from '../../shared/types'
import { LauncherError } from './errors'
import { atomicCopy, exists, hashFile, key } from './fsutil'
import { isSharedTarget, targetAbs, targetName } from './paths'
import { findInGame } from './resolve'
import { computeTags } from './tags'

export interface EngineContext {
  game: GameInfo | null
  backupDir: string
  backupsEnabled: boolean
  isGameRunning: () => Promise<boolean>
}

const gamePath = (game: GameInfo, file: ModFile): string => targetAbs(game.gameDir, file.target)
const backupPathFor = (backupDir: string, target: string): string => path.join(backupDir, ...target.split('/'))
const layersOf = (lib: Library, k: string): OwnerRecord[] => lib.shared[k] ?? []

/**
 * El archivo del juego sigue siendo el que dejó el launcher (el mismo hash que registró).
 * Para archivos compartidos es el del mod que está arriba de la pila.
 */
async function topIsIntact(lib: Library, game: GameInfo, file: ModFile): Promise<boolean> {
  const owner = lib.owners[key(file.target)]
  if (!owner) return false
  const tp = gamePath(game, file)
  if (!(await exists(tp))) return false
  return (await hashFile(tp)) === owner.hash
}

/** El estado se lee siempre del disco: un archivo está activo si su hash coincide con el que dejó el launcher. */
async function isFileActive(lib: Library, game: GameInfo, mod: Mod, file: ModFile): Promise<boolean> {
  const k = key(file.target)
  if (isSharedTarget(file.target)) {
    // Un mod con catálogo propio está activo mientras siga en la pila y el archivo no haya sido repuesto.
    if (!layersOf(lib, k).some((l) => l.modId === mod.id)) return false
    return topIsIntact(lib, game, file)
  }
  const owner = lib.owners[k]
  if (!owner || owner.modId !== mod.id) return false
  return topIsIntact(lib, game, file)
}

/** Hash con el que el launcher aplicó el archivo de este mod (para saber si el mod cambió después). */
function appliedHash(lib: Library, mod: Mod, file: ModFile): string | undefined {
  const k = key(file.target)
  if (isSharedTarget(file.target)) return layersOf(lib, k).find((l) => l.modId === mod.id)?.hash
  return lib.owners[k]?.hash
}

export async function buildViews(lib: Library, game: GameInfo | null): Promise<ModView[]> {
  const views: ModView[] = []
  for (const mod of lib.mods) {
    const files = []
    for (const f of mod.files) {
      const sourceExists = await exists(f.source)
      const targetExists = game ? await exists(gamePath(game, f)) : false
      const active = game ? await isFileActive(lib, game, mod, f) : false
      let outdated = false
      if (active && sourceExists) {
        outdated = (await hashFile(f.source)) !== appliedHash(lib, mod, f)
      }
      files.push({
        source: f.source,
        target: f.target,
        sourceExists,
        targetExists,
        state: active ? ('active' as const) : ('inactive' as const),
        outdated
      })
    }
    const activeCount = files.filter((f) => f.state === 'active').length
    let status: ModStatus
    if (activeCount === files.length && files.length > 0) status = 'active'
    else if (activeCount > 0) status = 'partial'
    else if (files.some((f) => !f.sourceExists)) status = 'missing'
    else status = 'inactive'
    views.push({
      id: mod.id,
      name: mod.name,
      tags: computeTags(mod),
      origin: mod.origin ? path.basename(mod.origin) : null,
      status,
      files,
      conflictsWith: [],
      blockedBy: [],
      compat: computeCompat(mod.declared, game)
    })
  }

  // Conflicto = dos mods que reemplazan el mismo archivo de contenido. Los archivos compartidos
  // (catálogo) no cuentan: conviven.
  for (const v of views) {
    const mine = new Set(v.files.filter((f) => !isSharedTarget(f.target)).map((f) => key(f.target)))
    for (const other of views) {
      if (other.id === v.id) continue
      const clash = other.files.filter((f) => mine.has(key(f.target)))
      if (clash.length === 0) continue
      v.conflictsWith.push({ id: other.id, name: other.name })
      if (clash.some((f) => f.state === 'active')) v.blockedBy.push({ id: other.id, name: other.name })
    }
  }
  return views
}

/** "27.0.0+2493426" -> "27.0.0". El número tras el "+" es solo la compilación y no cambia la compatibilidad. */
const baseVersion = (version: string): string => version.split('+')[0]

/**
 * Compara la versión que declara el mod con la del juego instalado.
 * Es deliberadamente tolerante: 27.0.0+2493426 y 27.0.0+2493500 son prácticamente el mismo juego.
 */
export function computeCompat(declared: DeclaredCompat | undefined, game: GameInfo | null): ModCompat {
  if (!declared || !game) return { state: 'unknown' }
  if (declared.version && game.version) {
    const same = baseVersion(declared.version) === baseVersion(game.version)
    return {
      state: same ? 'match' : 'different',
      declared: declared.version,
      current: game.version,
      exact: declared.version === game.version
    }
  }
  if (declared.buildId && game.buildId) {
    const exact = declared.buildId === game.buildId
    return {
      state: exact ? 'match' : 'different',
      declared: `build ${declared.buildId}`,
      current: `build ${game.buildId}`,
      exact
    }
  }
  return { state: 'unknown' }
}

async function assertCanWrite(ctx: EngineContext): Promise<GameInfo> {
  if (!ctx.game) throw new LauncherError({ code: 'GAME_NOT_FOUND' })
  if (await ctx.isGameRunning()) throw new LauncherError({ code: 'GAME_RUNNING' })
  return ctx.game
}

function findMod(lib: Library, modId: string): Mod {
  const mod = lib.mods.find((m) => m.id === modId)
  if (!mod) throw new LauncherError({ code: 'MOD_NOT_FOUND' })
  return mod
}

async function dropBackup(lib: Library, k: string): Promise<void> {
  const rec = lib.backups[k]
  if (rec) {
    if (rec.path) await rm(rec.path, { force: true })
    delete lib.backups[k]
  }
}

/** Guarda lo que hay ahora en el juego como "original" (o anota que el archivo no existía). */
async function backUpOriginal(
  lib: Library,
  ctx: EngineContext,
  game: GameInfo,
  f: ModFile,
  present: boolean,
  current: string | null
): Promise<void> {
  const k = key(f.target)
  if (!present) {
    // Archivo nuevo: al revertir simplemente se borra.
    lib.backups[k] = { target: f.target, path: '', existed: false, hash: '', buildId: game.buildId, time: Date.now() }
  } else if (ctx.backupsEnabled) {
    const backupPath = backupPathFor(ctx.backupDir, f.target)
    await atomicCopy(gamePath(game, f), backupPath)
    const record: BackupRecord = {
      target: f.target,
      path: backupPath,
      existed: true,
      hash: current as string,
      buildId: game.buildId,
      time: Date.now()
    }
    lib.backups[k] = record
  } else {
    // Un respaldo anterior ya no corresponde a lo que hay ahora en el juego.
    await dropBackup(lib, k)
  }
}

/** Un mod de la pila puede reponerse si su archivo de origen sigue existiendo. */
async function layerSource(lib: Library, layer: OwnerRecord, k: string): Promise<ModFile | null> {
  const mod = lib.mods.find((m) => m.id === layer.modId)
  const file = mod?.files.find((f) => key(f.target) === k)
  return file && (await exists(file.source)) ? file : null
}

/**
 * Quita a un mod de la pila de un archivo compartido. Si era el de arriba, deja puesto el del mod
 * siguiente (se descartan los que ya no tienen su archivo). Devuelve "empty" cuando no queda ninguno:
 * ahí quien llama debe reponer el original.
 */
async function removeSharedLayer(lib: Library, game: GameInfo, k: string, modId: string): Promise<'empty' | 'kept'> {
  let layers = layersOf(lib, k).filter((l) => l.modId !== modId)
  const wasTop = lib.owners[k]?.modId === modId

  if (wasTop) {
    while (layers.length > 0) {
      const top = layers[layers.length - 1]
      const file = await layerSource(lib, top, k)
      if (file) {
        const tp = gamePath(game, file)
        await atomicCopy(file.source, tp)
        top.hash = await hashFile(tp)
        top.time = Date.now()
        lib.owners[k] = { ...top }
        break
      }
      layers = layers.slice(0, -1)
    }
  }

  if (layers.length === 0) {
    delete lib.shared[k]
    return 'empty'
  }
  lib.shared[k] = layers
  return 'kept'
}

/**
 * Aplica un mod: respalda los originales (si hay respaldos activados) y copia los archivos del mod.
 * Modifica `lib`; quien llama debe guardarla siempre, incluso si hubo error.
 */
export async function activateMod(lib: Library, modId: string, ctx: EngineContext): Promise<void> {
  const game = await assertCanWrite(ctx)
  const mod = findMod(lib, modId)

  const missingSources: string[] = []
  const missingTargets: string[] = []
  for (const f of mod.files) {
    if (!(await exists(f.source))) missingSources.push(targetName(f.target))
    if (!f.mirrored && !(await exists(gamePath(game, f)))) {
      // Un .bundle suelto: puede que el juego lo haya movido de carpeta.
      const found = await findInGame(game, targetName(f.target))
      if (found) f.target = found
      else missingTargets.push(targetName(f.target))
    }
  }
  if (missingSources.length) {
    throw new LauncherError({ code: 'SOURCE_MISSING', params: { files: missingSources.join(', ') } })
  }
  if (missingTargets.length) {
    throw new LauncherError({ code: 'TARGET_MISSING', params: { files: missingTargets.join(', ') } })
  }

  // Conflictos: otro mod que sigue aplicado sobre alguno de los mismos archivos de contenido.
  const blockers = new Set<string>()
  for (const f of mod.files) {
    if (isSharedTarget(f.target)) continue
    const owner = lib.owners[key(f.target)]
    if (!owner || owner.modId === mod.id) continue
    const other = lib.mods.find((m) => m.id === owner.modId)
    const otherFile = other?.files.find((x) => key(x.target) === key(f.target))
    if (other && otherFile && (await isFileActive(lib, game, other, otherFile))) blockers.add(other.name)
  }
  if (blockers.size) {
    throw new LauncherError({ code: 'CONFLICT', params: { mods: [...blockers].join(', ') } })
  }

  const touched: string[] = []
  try {
    for (const f of mod.files) {
      const k = key(f.target)
      const tp = gamePath(game, f)
      const owner = lib.owners[k]
      const present = await exists(tp)
      const current = present ? await hashFile(tp) : null

      if (isSharedTarget(f.target)) {
        // Archivo compartido: se apila sobre los demás mods; el original se guarda solo la primera vez.
        let layers = layersOf(lib, k)
        const stackIntact = layers.length > 0 && !!owner && present && current === owner.hash
        if (!stackIntact) {
          // Nadie lo tiene puesto (o Steam lo repuso): se empieza de cero con lo que hay ahora.
          layers = []
          delete lib.shared[k]
          await backUpOriginal(lib, ctx, game, f, present, current)
        }
        await atomicCopy(f.source, tp)
        touched.push(k)
        const record: OwnerRecord = { modId: mod.id, hash: await hashFile(tp), time: Date.now() }
        lib.shared[k] = [...layers.filter((l) => l.modId !== mod.id), record]
        lib.owners[k] = { ...record }
        continue
      }

      const alreadyOurs = present && owner?.modId === mod.id && owner.hash === current
      if (!alreadyOurs) await backUpOriginal(lib, ctx, game, f, present, current)

      await atomicCopy(f.source, tp)
      touched.push(k)
      lib.owners[k] = { modId: mod.id, hash: await hashFile(tp), time: Date.now() }
    }
  } catch (err) {
    // Deshace lo ya copiado usando los respaldos hechos en esta operación.
    for (const k of touched) {
      const f = mod.files.find((x) => key(x.target) === k)
      if (!f) continue
      if (isSharedTarget(f.target)) {
        const outcome = await removeSharedLayer(lib, game, k, mod.id).catch(() => 'kept' as const)
        if (outcome === 'kept') continue
      }
      const rec = lib.backups[k]
      if (!rec) continue
      if (rec.existed === false) await rm(gamePath(game, f), { force: true }).catch(() => undefined)
      else if (await exists(rec.path)) await atomicCopy(rec.path, gamePath(game, f)).catch(() => undefined)
      else continue
      delete lib.owners[k]
    }
    throw new LauncherError({ code: 'IO', params: { detail: err instanceof Error ? err.message : String(err) } })
  }
}

interface PlanItem {
  k: string
  file: ModFile
  /** Respaldo validado para reponer el original; null si el archivo sigue en uso por otro mod. */
  rec: BackupRecord | null
  shared: boolean
}

/** Revierte un mod restaurando los originales respaldados (y borrando los archivos que el mod añadió). */
export async function deactivateMod(lib: Library, modId: string, ctx: EngineContext): Promise<void> {
  const game = await assertCanWrite(ctx)
  const mod = findMod(lib, modId)

  const plan: PlanItem[] = []
  const noBackup: string[] = []
  const buildChanged: string[] = []

  /** Comprueba que el respaldo sirve para reponer el original y lo deja en el plan. */
  const planRestore = async (k: string, f: ModFile, shared: boolean): Promise<void> => {
    const rec = lib.backups[k]
    if (rec && rec.existed === false) {
      plan.push({ k, file: f, rec, shared })
    } else if (!rec || !(await exists(rec.path)) || (await hashFile(rec.path)) !== rec.hash) {
      noBackup.push(targetName(f.target))
    } else if (rec.buildId && game.buildId && rec.buildId !== game.buildId) {
      buildChanged.push(targetName(f.target))
    } else {
      plan.push({ k, file: f, rec, shared })
    }
  }

  for (const f of mod.files) {
    const k = key(f.target)

    if (isSharedTarget(f.target)) {
      const layers = layersOf(lib, k)
      if (!layers.some((l) => l.modId === mod.id)) continue
      if (!(await topIsIntact(lib, game, f))) {
        // Steam (u otro programa) ya repuso el archivo: ninguna capa sigue puesta.
        delete lib.shared[k]
        delete lib.owners[k]
        await dropBackup(lib, k)
        continue
      }
      const remaining = layers.filter((l) => l.modId !== mod.id)
      const wasTop = lib.owners[k]?.modId === mod.id
      let willEmpty = remaining.length === 0
      if (!willEmpty && wasTop) {
        willEmpty = true
        for (const layer of remaining) {
          if (await layerSource(lib, layer, k)) {
            willEmpty = false
            break
          }
        }
      }
      if (willEmpty) await planRestore(k, f, true)
      else plan.push({ k, file: f, rec: null, shared: true })
      continue
    }

    const owner = lib.owners[k]
    if (!owner || owner.modId !== mod.id) continue

    if (!(await isFileActive(lib, game, mod, f))) {
      // Steam (u otro programa) ya cambió el archivo: no hay nada que revertir.
      delete lib.owners[k]
      await dropBackup(lib, k)
      continue
    }
    await planRestore(k, f, false)
  }

  if (noBackup.length) {
    throw new LauncherError({
      code: 'NO_BACKUP',
      params: { files: noBackup.join(', ') },
      suggestSteamVerify: true
    })
  }
  if (buildChanged.length) {
    throw new LauncherError({
      code: 'BUILD_CHANGED',
      params: { files: buildChanged.join(', ') },
      suggestSteamVerify: true
    })
  }

  for (const { k, file, rec, shared } of plan) {
    try {
      if (shared && (await removeSharedLayer(lib, game, k, mod.id)) === 'kept') continue
      // Ya no queda ningún mod sobre el archivo: se repone el original.
      if (!rec) continue
      if (rec.existed === false) await rm(gamePath(game, file), { force: true })
      else await atomicCopy(rec.path, gamePath(game, file))
    } catch (err) {
      throw new LauncherError({ code: 'IO', params: { detail: err instanceof Error ? err.message : String(err) } })
    }
    await dropBackup(lib, k)
    delete lib.owners[k]
  }
}
