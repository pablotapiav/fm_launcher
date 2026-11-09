import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

/**
 * Política de seguridad de contenido de la interfaz: solo scripts y estilos propios, sin red ni objetos
 * incrustados. Va como <meta> porque las cabeceras HTTP no se aplican a páginas file://.
 */
const POLICY = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'none'",
  "object-src 'none'",
  "frame-src 'none'",
  "base-uri 'none'",
  "form-action 'none'"
].join('; ')

/** Solo en el build: en desarrollo, Vite necesita scripts en línea para recargar en caliente. */
const csp = {
  name: 'fm-launcher-csp',
  apply: 'build' as const,
  transformIndexHtml: (html: string): string =>
    html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${POLICY}" />`)
}

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    plugins: [react(), csp]
  }
})
