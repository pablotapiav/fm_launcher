import AdmZip from 'adm-zip'
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { LauncherError } from './errors'
import { isBlockedFile } from './paths'

export const ARCHIVE_EXTS = ['.zip', '.7z', '.rar']

export const isArchive = (file: string): boolean => ARCHIVE_EXTS.includes(path.extname(file).toLowerCase())

/** Tamaño máximo de una nota de instalación que se extrae para leerla. */
export const MAX_NOTE_BYTES = 200 * 1024

/** Límite de seguridad contra "zip bombs": 6 GB descomprimidos. */
const MAX_TOTAL_BYTES = 6 * 1024 ** 3

function safeName(name: string): string {
  return name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim().slice(0, 60) || 'mod'
}

/** Carpeta de destino estable para un archivo comprimido (el mismo zip siempre cae en el mismo lugar). */
export function archiveDestName(archive: string): string {
  const base = path.basename(archive, path.extname(archive))
  const hash = createHash('sha1').update(path.resolve(archive).toLowerCase()).digest('hex').slice(0, 8)
  return `${safeName(base)}-${hash}`
}

async function extractZip(archive: string, dest: string): Promise<void> {
  const zip = new AdmZip(archive)
  const root = path.resolve(dest)
  let total = 0
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue
    const name = entry.entryName.replace(/\\/g, '/')
    const parts = name.split('/').filter(Boolean)
    // Solo lo que puede ser parte de un mod: bundles sueltos o la estructura fm_Data,
    // más las notas de instalación (texto corto) para leer la versión del juego que declaran.
    const lower = name.toLowerCase()
    const isNote = /\.(txt|md|nfo)$/.test(lower) && parts.length <= 3 && entry.header.size <= MAX_NOTE_BYTES
    const wanted = lower.endsWith('.bundle') || parts.some((p) => p.toLowerCase() === 'fm_data') || isNote
    if (!wanted || isBlockedFile(name)) continue

    const out = path.resolve(root, ...parts)
    if (!out.startsWith(root + path.sep)) continue // zip-slip: ruta que se sale del destino

    total += entry.header.size
    if (total > MAX_TOTAL_BYTES) throw new Error('archive too large')
    await mkdir(path.dirname(out), { recursive: true })
    await writeFile(out, entry.getData())
  }
}

/** .7z y .rar: se usa tar.exe (bsdtar) que viene con Windows 10/11. */
function extractWithTar(archive: string, dest: string): Promise<void> {
  const tar = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe')
  return new Promise((resolve, reject) => {
    execFile(tar, ['-xf', archive, '-C', dest], { windowsHide: true, maxBuffer: 64 * 1024 * 1024 }, (err) =>
      err ? reject(err) : resolve()
    )
  })
}

async function pruneBlocked(dir: string): Promise<void> {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) await pruneBlocked(full)
    else if (isBlockedFile(e.name)) await rm(full, { force: true })
  }
}

/**
 * Descomprime un .zip/.7z/.rar dentro de `modsRoot` y devuelve la carpeta resultante.
 * Nunca ejecuta nada del archivo; los scripts y ejecutables se descartan.
 */
export async function extractArchive(archive: string, modsRoot: string): Promise<string> {
  const dest = path.join(modsRoot, archiveDestName(archive))
  const tmp = `${dest}.extracting`
  await rm(tmp, { recursive: true, force: true })
  await mkdir(tmp, { recursive: true })
  try {
    if (path.extname(archive).toLowerCase() === '.zip') await extractZip(archive, tmp)
    else {
      await extractWithTar(archive, tmp)
      await pruneBlocked(tmp)
    }
    await rm(dest, { recursive: true, force: true })
    await rename(tmp, dest)
    return dest
  } catch (err) {
    await rm(tmp, { recursive: true, force: true })
    throw new LauncherError({
      code: 'ARCHIVE_FAILED',
      params: { name: path.basename(archive), detail: err instanceof Error ? err.message : String(err) }
    })
  }
}
