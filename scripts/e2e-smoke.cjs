// Prueba de punta a punta de la aplicación compilada (necesita pantalla):
//   npx electron-vite build && npx electron scripts/e2e-smoke.cjs
// Usa una carpeta de datos temporal: no toca tu biblioteca ni tu juego.
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fm-e2e-'))
app.setPath('userData', tmp)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? 'OK ' : 'FALLA'}  ${name}${extra ? ' — ' + extra : ''}`)
}

const consoleErrors = []
app.on('browser-window-created', (_e, w) => {
  w.webContents.on('console-message', (event) => {
    const level = event.level ?? event
    const message = event.message ?? ''
    if (String(level).includes('error') || level === 3) consoleErrors.push(String(message))
  })
})

require('../out/main/index.js')

app.whenReady().then(async () => {
  await sleep(4000)
  const win = BrowserWindow.getAllWindows()[0]
  try {
    check('se abre la ventana principal', !!win)

    const hasUi = await win.webContents.executeJavaScript(
      "!!document.querySelector('.play') && !!document.querySelector('.topbar')"
    )
    check('la interfaz se dibuja (botón Jugar FM y barra superior)', hasUi)

    const state = await win.webContents.executeJavaScript('window.api.getState()')
    check('la interfaz puede llamar al proceso principal (IPC)', !!state && Array.isArray(state.mods), `mods: ${state?.mods?.length}`)

    const evalBlocked = await win.webContents.executeJavaScript(
      "(() => { try { eval('1+1'); return false } catch { return true } })()"
    )
    check('la CSP bloquea eval()', evalBlocked)

    const fetchBlocked = await win.webContents.executeJavaScript(
      "fetch('https://example.com').then(() => false, () => true)"
    )
    check('la CSP bloquea conexiones de red', fetchBlocked)

    // Una página ajena con el mismo preload no debe poder usar los comandos.
    const stranger = new BrowserWindow({
      show: false,
      webPreferences: { preload: path.join(__dirname, '..', 'out', 'preload', 'index.js'), sandbox: true }
    })
    await stranger.loadURL('data:text/html,<p>ajena</p>')
    const rejected = await stranger.webContents.executeJavaScript(
      "window.api.getState().then(() => false, () => true)"
    )
    check('un remitente no autorizado es rechazado', rejected)

    const badSetting = await win.webContents.executeJavaScript(
      "window.api.setSettings({ gameDir: 'no-es-absoluta' }).then((r) => r.ok === false)"
    )
    check('un ajuste no válido es rechazado', badSetting)

    const unknownSetting = await win.webContents.executeJavaScript(
      "window.api.setSettings({ inventado: true }).then((r) => r.ok === false)"
    )
    check('un ajuste desconocido es rechazado', unknownSetting)

    const csp = consoleErrors.filter((m) => /Content Security Policy|Refused to/i.test(m) && !/eval|example\.com/i.test(m))
    check('sin violaciones de CSP en la carga normal', csp.length === 0, csp[0] ?? '')
  } catch (err) {
    check('la prueba terminó sin excepciones', false, String(err))
  }
  const failed = results.filter((r) => !r).length
  console.log(failed === 0 ? '\nTodo bien.' : `\n${failed} comprobación(es) fallaron.`)
  try {
    fs.rmSync(tmp, { recursive: true, force: true })
  } catch {
    /* Chromium puede seguir usando la carpeta temporal: no importa */
  }
  app.exit(failed === 0 ? 0 : 1)
})
