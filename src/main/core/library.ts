import { readFile, rename } from 'node:fs/promises'
import type { Lang, Library, Mod, Settings } from '../../shared/types'
import { atomicWrite, key } from './fsutil'
import { BUNDLE_DIR_REL } from './paths'

export function defaultLanguage(locale: string): Lang {
  return locale.toLowerCase().startsWith('en') ? 'en' : 'es'
}

export function defaultSettings(): Settings {
  return {
    language: 'es',
    gameDir: null,
    backupsEnabled: true,
    backupDir: null,
    introAcknowledged: false
  }
}

export function emptyLibrary(): Library {
  return { version: 2, settings: defaultSettings(), mods: [], backups: {}, owners: {} }
}

/** La versión 1 guardaba solo el nombre del bundle (siempre en aa/StandaloneWindows64). */
function migrateV1(parsed: { mods?: Mod[]; backups?: Library['backups']; owners?: Library['owners'] }): void {
  const fix = (target: string): string => (target.includes('/') ? target : `${BUNDLE_DIR_REL}/${target}`)
  for (const mod of parsed.mods ?? []) {
    for (const f of mod.files) {
      f.target = fix(f.target)
      f.mirrored = f.mirrored ?? false
    }
  }
  const remap = <T extends { target?: string }>(record: Record<string, T> | undefined): Record<string, T> => {
    const out: Record<string, T> = {}
    for (const [k, v] of Object.entries(record ?? {})) {
      if (v.target) v.target = fix(v.target)
      out[key(k.includes('/') ? k : fix(k))] = v
    }
    return out
  }
  parsed.backups = remap(parsed.backups)
  for (const rec of Object.values(parsed.backups)) rec.existed = rec.existed ?? true
  parsed.owners = remap(parsed.owners as Record<string, { target?: string }>) as Library['owners']
}

/** Guarda y carga la biblioteca (mods, ajustes, respaldos) como un JSON. */
export class LibraryStore {
  constructor(private readonly file: string) {}

  async load(): Promise<Library> {
    let raw: string
    try {
      raw = await readFile(this.file, 'utf8')
    } catch {
      return emptyLibrary()
    }
    try {
      const parsed = JSON.parse(raw) as Partial<Library> & { version?: number }
      if (parsed.version !== 2) migrateV1(parsed)
      const base = emptyLibrary()
      return {
        version: 2,
        settings: { ...base.settings, ...(parsed.settings ?? {}) },
        mods: Array.isArray(parsed.mods) ? parsed.mods : [],
        backups: parsed.backups ?? {},
        owners: parsed.owners ?? {}
      }
    } catch {
      // JSON dañado: se conserva una copia y se parte de cero.
      await rename(this.file, `${this.file}.corrupt-${Date.now()}`).catch(() => undefined)
      return emptyLibrary()
    }
  }

  async save(lib: Library): Promise<void> {
    await atomicWrite(this.file, JSON.stringify(lib, null, 2))
  }
}
