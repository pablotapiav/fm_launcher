// Genera docs/screenshot.png con datos de ejemplo:
//   npx electron-vite build && npx electron scripts/make-screenshot.cjs
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

app.commandLine.appendSwitch('force-device-scale-factor', '1')

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1040,
    height: 800,
    show: false,
    useContentSize: true,
    backgroundColor: '#06031a',
    webPreferences: {
      offscreen: true,
      sandbox: true,
      contextIsolation: true,
      preload: path.join(__dirname, 'screenshot-mock.cjs')
    }
  })
  await win.loadFile(path.join(__dirname, '..', 'out', 'renderer', 'index.html'))
  await new Promise((r) => setTimeout(r, 1500))
  const img = await win.webContents.capturePage()
  const out = path.join(__dirname, '..', 'docs', 'screenshot.png')
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, img.toPNG())
  console.log('captura generada', out, img.getSize())
  app.quit()
})
