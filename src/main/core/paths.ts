import path from 'node:path'

/** Los mods solo pueden tocar archivos dentro de esta carpeta del juego. */
export const SAFE_ROOT = 'fm_Data/StreamingAssets/'
/** Carpeta donde viven la mayoría de los bundles de la interfaz. */
export const BUNDLE_DIR_REL = 'fm_Data/StreamingAssets/aa/StandaloneWindows64'

/** Nunca se copian ni se ejecutan archivos como estos. */
const BLOCKED_EXT = new Set([
  '.exe', '.dll', '.bat', '.cmd', '.ps1', '.vbs', '.vbe', '.js', '.jse', '.wsf',
  '.msi', '.scr', '.lnk', '.com', '.sh', '.py'
])

export function isBlockedFile(name: string): boolean {
  return BLOCKED_EXT.has(path.extname(name).toLowerCase())
}

/**
 * Normaliza una ruta relativa al juego y comprueba que sea segura:
 * dentro de fm_Data/StreamingAssets, sin "..", sin letras de unidad y sin ejecutables.
 * Devuelve null si no lo es.
 */
export function toTargetPath(rel: string): string | null {
  const parts = rel.split(/[\\/]+/).filter(Boolean)
  if (parts.length === 0) return null
  if (parts.some((p) => p === '.' || p === '..' || p.includes(':'))) return null
  const norm = parts.join('/')
  if (!norm.toLowerCase().startsWith(SAFE_ROOT.toLowerCase())) return null
  if (isBlockedFile(parts[parts.length - 1])) return null
  return norm
}

/**
 * Archivos del catálogo del juego. Casi todos los mods con contenido nuevo traen su propia copia, y en la
 * práctica conviven: no se tratan como conflicto. Si varios mods los traen, gana el último activado.
 */
const SHARED_NAMES = new Set(['catalog_info.bin', 'catalog_info.hash', 'catalog.bin', 'catalog.hash'])

export function isSharedTarget(target: string): boolean {
  return SHARED_NAMES.has(targetName(target).toLowerCase())
}

export function targetAbs(gameDir: string, target: string): string {
  return path.join(gameDir, ...target.split('/'))
}

export function targetName(target: string): string {
  return target.slice(target.lastIndexOf('/') + 1)
}
