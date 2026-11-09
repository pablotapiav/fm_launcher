import { execFile } from 'node:child_process'

/** True si fm.exe está en ejecución. */
export function isGameRunning(): Promise<boolean> {
  if (process.platform !== 'win32') return Promise.resolve(false)
  return new Promise((resolve) => {
    execFile(
      'tasklist',
      ['/FI', 'IMAGENAME eq fm.exe', '/NH', '/FO', 'CSV'],
      { windowsHide: true },
      (err, stdout) => resolve(!err && stdout.toLowerCase().includes('"fm.exe"'))
    )
  })
}
