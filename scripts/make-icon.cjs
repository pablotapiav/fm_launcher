// Genera build/icon.png (512x512) con Electron: npx electron scripts/make-icon.cjs
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

app.commandLine.appendSwitch('force-device-scale-factor', '1')
app.disableHardwareAcceleration()

const html = `<!doctype html><meta charset="utf-8"><style>
  html,body{margin:0;background:transparent;overflow:hidden}
  .icon{position:relative;width:512px;height:512px;border-radius:116px;overflow:hidden;
    background:
      radial-gradient(420px 300px at 0% 100%, rgba(123,69,245,.75), transparent 70%),
      radial-gradient(360px 260px at 100% 0%, rgba(61,123,255,.5), transparent 70%),
      radial-gradient(240px 180px at 85% 90%, rgba(255,140,60,.22), transparent 70%),
      linear-gradient(160deg,#150a3f,#06031a)}
  .icon::after{content:"";position:absolute;inset:0;border-radius:116px;box-shadow:inset 0 0 0 3px rgba(255,255,255,.12)}
  .b{position:absolute;width:104px;height:104px;border:0 solid transparent}
  .tl{top:58px;left:58px;border-width:18px 0 0 18px;border-image:linear-gradient(135deg,#ff3cb0,#c52bdc) 1}
  .tr{top:58px;right:58px;border-width:18px 18px 0 0;border-image:linear-gradient(225deg,#ff3cb0,#c52bdc) 1}
  .bl{bottom:58px;left:58px;border-width:0 0 18px 18px;border-image:linear-gradient(45deg,#9a40f0,#c52bdc) 1}
  .br{bottom:58px;right:58px;border-width:0 18px 18px 0;border-image:linear-gradient(315deg,#9a40f0,#7b45f5) 1}
  .t{position:absolute;inset:0;display:grid;place-items:center;
    font:800 212px/1 Bahnschrift,'Segoe UI',sans-serif;font-stretch:75%;letter-spacing:2px;color:#fff;
    text-shadow:0 0 50px rgba(255,47,160,.55),0 6px 0 rgba(0,0,0,.25);padding-bottom:6px}
</style>
<div class="icon"><i class="b tl"></i><i class="b tr"></i><i class="b bl"></i><i class="b br"></i><div class="t">LFM</div></div>`

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 512,
    height: 512,
    show: false,
    frame: false,
    transparent: true,
    useContentSize: true,
    webPreferences: { offscreen: true }
  })
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
  await new Promise((r) => setTimeout(r, 800))
  let img = await win.webContents.capturePage({ x: 0, y: 0, width: 512, height: 512 })
  const size = img.getSize()
  if (size.width !== 512) img = img.resize({ width: 512, height: 512, quality: 'best' })
  const out = path.join(__dirname, '..', 'build', 'icon.png')
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, img.toPNG())
  console.log('icono generado', out, size)
  app.quit()
})
