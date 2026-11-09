export interface ErrorReport {
  code?: string
  detail?: string
}

interface DiagnosticsInput {
  launcherVersion?: string
  gameBuild?: string | null
  gameVersion?: string | null
  modCount?: number
  userAgent: string
  error?: ErrorReport | null
  now?: Date
}

/** Texto corto para pegar en un mensaje de ayuda: versión, juego, sistema y el error. */
export function buildDiagnostics(input: DiagnosticsInput): string {
  const windows = input.userAgent.match(/Windows NT [\d.]+/)?.[0] ?? 'Windows'
  const lines = [
    `FM Launcher v${input.launcherVersion ?? '?'}`,
    `FM27: ${[input.gameVersion, input.gameBuild ? `build ${input.gameBuild}` : null].filter(Boolean).join(' · ') || 'no detectado'}`,
    `Mods: ${input.modCount ?? 0}`,
    `Sistema: ${windows}`
  ]
  if (input.error) {
    const detail = input.error.detail ? ` — ${input.error.detail}` : ''
    lines.push(`Error: ${input.error.code ?? 'UNEXPECTED'}${detail}`)
  }
  lines.push(`Fecha: ${(input.now ?? new Date()).toISOString()}`)
  return lines.join('\n')
}

/** Errores del navegador que no indican un fallo real (no deben abrir el pop-up). */
export function isBenignError(message: string): boolean {
  return /ResizeObserver loop|Script error\.?$/i.test(message)
}
