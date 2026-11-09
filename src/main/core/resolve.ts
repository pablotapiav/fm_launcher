import { readdir } from 'node:fs/promises'
import path from 'node:path'
import type { GameInfo } from '../../shared/types'
import { exists } from './fsutil'
import { BUNDLE_DIR_REL, SAFE_ROOT, targetAbs } from './paths'

const KNOWN_DIRS = [BUNDLE_DIR_REL, 'fm_Data/StreamingAssets/AddrData']
const MAX_DEPTH = 4

async function search(dir: string, rel: string, name: string, depth: number): Promise<string | null> {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return null
  }
  for (const e of entries) {
    if (e.isFile() && e.name.toLowerCase() === name) return `${rel}/${e.name}`
  }
  if (depth >= MAX_DEPTH) return null
  for (const e of entries) {
    if (e.isDirectory()) {
      const found = await search(path.join(dir, e.name), `${rel}/${e.name}`, name, depth + 1)
      if (found) return found
    }
  }
  return null
}

/**
 * Busca dentro del juego dónde vive un archivo por su nombre. Se usa con .bundle sueltos,
 * que no dicen en qué carpeta van. Devuelve la ruta relativa al juego o null.
 */
export async function findInGame(game: GameInfo, fileName: string): Promise<string | null> {
  const lower = fileName.toLowerCase()
  for (const dir of KNOWN_DIRS) {
    const candidate = `${dir}/${fileName}`
    if (await exists(targetAbs(game.gameDir, candidate))) return candidate
  }
  const root = SAFE_ROOT.replace(/\/$/, '')
  return search(targetAbs(game.gameDir, root), root, lower, 0)
}
