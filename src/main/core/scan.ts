import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import type { DeclaredCompat } from '../../shared/types'
import { isArchive, MAX_NOTE_BYTES } from './archive'
import { toTargetPath } from './paths'

export interface CandidateFile {
  source: string
  /** Ruta relativa al juego si viene de la estructura del mod; null si hay que buscarla por nombre. */
  target: string | null
  mirrored: boolean
}

export interface Candidate {
  name: string
  origin?: string
  declared?: DeclaredCompat
  files: CandidateFile[]
}

export interface ScanResult {
  candidates: Candidate[]
  /** Rutas que no contienen nada utilizable. */
  ignored: string[]
  /** Archivos de un mod descartados por estar fuera de StreamingAssets o ser ejecutables. */
  skipped: string[]
}

export interface ScanOptions {
  /** Descomprime un archivo y devuelve la carpeta resultante. Sin esto, los comprimidos se ignoran. */
  extract?: (archive: string) => Promise<string>
}

const MAX_DEPTH = 4

/** Versión interna ("27.0.0+2493426") o build de Steam ("build 26340721") dentro de un texto. */
export function parseDeclaredCompat(text: string): DeclaredCompat | undefined {
  const version = text.match(/\b27\.\d+\.\d+\+\d+\b/)?.[0]
  const buildId = text.match(/\bbuild(?:\s*id)?\W{0,12}(\d{8})\b/i)?.[1]
  if (!version && !buildId) return undefined
  return { ...(version ? { version } : {}), ...(buildId ? { buildId } : {}) }
}

/** Lee las notas (.txt/.md/.nfo) de una carpeta de mod y extrae la versión del juego que declaran. */
export async function readDeclaredCompat(dir: string, depth = 0): Promise<DeclaredCompat | undefined> {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return undefined
  }
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isFile() && /\.(txt|md|nfo)$/i.test(e.name)) {
      try {
        if ((await stat(full)).size > MAX_NOTE_BYTES) continue
        const found = parseDeclaredCompat(await readFile(full, 'utf8'))
        if (found) return found
      } catch {
        /* nota ilegible: se ignora */
      }
    }
  }
  if (depth < 2) {
    for (const e of entries) {
      if (e.isDirectory() && e.name.toLowerCase() !== 'fm_data') {
        const found = await readDeclaredCompat(path.join(dir, e.name), depth + 1)
        if (found) return found
      }
    }
  }
  return undefined
}

const isBundle = (file: string): boolean => file.toLowerCase().endsWith('.bundle')

async function listFiles(dir: string, relParts: string[], out: { abs: string; rel: string[] }[]): Promise<void> {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name)
    if (e.isDirectory()) await listFiles(abs, [...relParts, e.name], out)
    else if (e.isFile()) out.push({ abs, rel: [...relParts, e.name] })
  }
}

/** Un mod que copia la estructura del juego: <raíz>/fm_Data/StreamingAssets/... */
async function collectMirrored(root: string, fmDataName: string, skipped: string[]): Promise<CandidateFile[]> {
  const all: { abs: string; rel: string[] }[] = []
  await listFiles(path.join(root, fmDataName), [], all)
  const files: CandidateFile[] = []
  for (const f of all) {
    const rel = ['fm_Data', ...f.rel].join('/')
    const target = toTargetPath(rel)
    if (target) files.push({ source: f.abs, target, mirrored: true })
    else skipped.push(rel)
  }
  return files.sort((a, b) => a.target!.localeCompare(b.target!))
}

async function walk(dir: string, depth: number, out: Candidate[], skipped: string[]): Promise<void> {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return
  }

  const fmData = entries.find((e) => e.isDirectory() && e.name.toLowerCase() === 'fm_data')
  if (fmData) {
    const files = await collectMirrored(dir, fmData.name, skipped)
    if (files.length) out.push({ name: path.basename(dir), files })
    return
  }

  const bundles = entries.filter((e) => e.isFile() && isBundle(e.name)).map((e) => path.join(dir, e.name))
  if (bundles.length) {
    out.push({
      name: path.basename(dir),
      files: bundles.sort().map((source) => ({ source, target: null, mirrored: false }))
    })
  }
  if (depth >= MAX_DEPTH) return
  for (const e of entries) {
    if (e.isDirectory()) await walk(path.join(dir, e.name), depth + 1, out, skipped)
  }
}

/**
 * Convierte lo que el usuario arrastra o elige en mods candidatos:
 * - un .bundle suelto es un mod por sí solo;
 * - una carpeta con .bundle es un mod con todos ellos;
 * - una carpeta (o zip/7z/rar) que contiene fm_Data es un mod que copia la estructura del juego;
 * - un comprimido se descomprime primero y se analiza su contenido.
 */
export async function scanPaths(paths: string[], opts: ScanOptions = {}): Promise<ScanResult> {
  const candidates: Candidate[] = []
  const ignored: string[] = []
  const skipped: string[] = []

  for (const p of paths) {
    let st
    try {
      st = await stat(p)
    } catch {
      ignored.push(p)
      continue
    }

    if (st.isDirectory()) {
      const before = candidates.length
      await walk(p, 0, candidates, skipped)
      if (candidates.length === before) ignored.push(p)
      const declared = candidates.length > before ? await readDeclaredCompat(p) : undefined
      if (declared) for (const c of candidates.slice(before)) c.declared = declared
    } else if (isBundle(p)) {
      candidates.push({
        name: path.basename(p, path.extname(p)),
        files: [{ source: p, target: null, mirrored: false }]
      })
    } else if (isArchive(p) && opts.extract) {
      const dir = await opts.extract(p)
      const found: Candidate[] = []
      await walk(dir, 0, found, skipped)
      if (found.length === 0) ignored.push(p)
      const base = path.basename(p, path.extname(p))
      const declared = found.length ? await readDeclaredCompat(dir) : undefined
      for (const c of found) {
        candidates.push({
          ...c,
          name: found.length === 1 ? base : `${base} · ${c.name}`,
          origin: p,
          ...(declared ? { declared } : {})
        })
      }
    } else {
      ignored.push(p)
    }
  }
  return { candidates, ignored, skipped }
}
