// Dónde pueden escribirnos los usuarios. Para cambiar un enlace, se edita solo este archivo.

export const TWITTER_HANDLE = '@fm_chile'
export const TWITTER_URL = 'https://x.com/fm_chile'

/** URL del repositorio en GitHub. Si se deja vacío, la interfaz muestra "Próximamente". */
export const GITHUB_URL: string = 'https://github.com/pablotapiav/fm_launcher'

export type LinkKind = 'twitter' | 'github'

/** Solo se abren enlaces conocidos (nunca una URL que llegue desde la interfaz). */
export function linkUrl(kind: LinkKind): string | null {
  if (kind === 'twitter') return TWITTER_URL
  return GITHUB_URL || null
}
