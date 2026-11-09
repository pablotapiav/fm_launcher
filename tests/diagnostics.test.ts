import { describe, expect, it } from 'vitest'
import { buildDiagnostics, isBenignError } from '../src/renderer/src/diagnostics'
import { GITHUB_URL, linkUrl, TWITTER_HANDLE } from '../src/shared/links'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Electron/45 Safari/537.36'
const NOW = new Date('2026-11-08T12:00:00Z')

describe('diagnóstico para comentarios', () => {
  it('incluye versión, juego, sistema y el error', () => {
    const text = buildDiagnostics({
      launcherVersion: '0.1.0',
      gameVersion: '27.0.0+2493426',
      gameBuild: '26340721',
      modCount: 3,
      userAgent: UA,
      error: { code: 'IO', detail: 'EBUSY: resource busy' },
      now: NOW
    })
    expect(text).toBe(
      [
        'FM Launcher v0.1.0',
        'FM27: 27.0.0+2493426 · build 26340721',
        'Mods: 3',
        'Sistema: Windows NT 10.0',
        'Error: IO — EBUSY: resource busy',
        'Fecha: 2026-11-08T12:00:00.000Z'
      ].join('\n')
    )
  })

  it('funciona sin error y sin juego detectado', () => {
    const text = buildDiagnostics({ userAgent: UA, now: NOW })
    expect(text).toContain('FM27: no detectado')
    expect(text).not.toContain('Error:')
  })

  it('un fallo sin código se informa como inesperado', () => {
    expect(buildDiagnostics({ userAgent: UA, error: { detail: 'boom' }, now: NOW })).toContain('Error: UNEXPECTED — boom')
  })

  it('ignora errores benignos del navegador', () => {
    expect(isBenignError('ResizeObserver loop completed with undelivered notifications.')).toBe(true)
    expect(isBenignError('TypeError: x is undefined')).toBe(false)
  })
})

describe('enlaces de contacto', () => {
  it('Twitter está configurado y GitHub queda vacío hasta tener el repositorio', () => {
    expect(TWITTER_HANDLE).toBe('@fm_chile')
    expect(linkUrl('twitter')).toBe('https://x.com/fm_chile')
    expect(linkUrl('github')).toBe(GITHUB_URL || null)
  })
})
