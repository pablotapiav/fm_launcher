import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { copyFile, mkdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

const hashCache = new Map<string, { key: string; hash: string }>()

/** SHA-1 de un archivo, con caché por tamaño y fecha de modificación. */
export async function hashFile(file: string): Promise<string> {
  const st = await stat(file)
  const cacheKey = `${st.size}:${st.mtimeMs}`
  const cached = hashCache.get(file)
  if (cached && cached.key === cacheKey) return cached.hash
  const hash = await new Promise<string>((resolve, reject) => {
    const h = createHash('sha1')
    const s = createReadStream(file)
    s.on('error', reject)
    s.on('data', (chunk) => h.update(chunk))
    s.on('end', () => resolve(h.digest('hex')))
  })
  hashCache.set(file, { key: cacheKey, hash })
  return hash
}

export async function exists(file: string): Promise<boolean> {
  try {
    await stat(file)
    return true
  } catch {
    return false
  }
}

/** Copia a un archivo temporal junto al destino y luego lo renombra, para no dejar archivos a medias. */
export async function atomicCopy(from: string, to: string): Promise<void> {
  await mkdir(path.dirname(to), { recursive: true })
  const tmp = `${to}.fmlauncher.tmp`
  try {
    await copyFile(from, tmp)
    await rename(tmp, to)
  } catch (err) {
    await rm(tmp, { force: true })
    throw err
  }
}

export async function atomicWrite(file: string, content: string): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true })
  const tmp = `${file}.tmp`
  await writeFile(tmp, content, 'utf8')
  await rename(tmp, file)
}

/** Las rutas de Windows no distinguen mayúsculas: las claves se normalizan. */
export function key(name: string): string {
  return name.toLowerCase()
}
