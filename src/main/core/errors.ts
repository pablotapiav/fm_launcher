import type { LauncherErrorInfo } from '../../shared/types'

/** Error esperado de la lógica del launcher; la interfaz lo traduce por su código. */
export class LauncherError extends Error {
  readonly info: LauncherErrorInfo
  constructor(info: LauncherErrorInfo) {
    super(info.code)
    this.info = info
  }
}
