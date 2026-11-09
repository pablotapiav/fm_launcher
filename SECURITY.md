# Seguridad / Security

## Cómo reportar un problema de seguridad

Si encontraste una vulnerabilidad en FM Launcher, **no la publiques en un *Issue***: así la verían todos antes de que haya arreglo.

- Usa **[Security → Report a vulnerability](../../security/advisories/new)** en este repositorio (reporte privado), o
- escribe un mensaje directo a **[@fm_chile](https://x.com/fm_chile)** en X (Twitter).

Incluye qué pasa, cómo reproducirlo y la versión del launcher. Se responde lo antes posible y se te avisa cuando haya una versión corregida.

> If you found a vulnerability, please don't open a public Issue. Use **Security → Report a vulnerability** on this repo (private report) or send a direct message to [@fm_chile](https://x.com/fm_chile) on X.

## Qué se considera un problema de seguridad

Por ejemplo, un mod o archivo comprimido que logre:

- escribir o borrar archivos **fuera** de `fm_Data\StreamingAssets` del juego o de la carpeta de datos del launcher;
- ejecutar código (el launcher nunca debería ejecutar nada de un mod);
- leer archivos del equipo que no debería leer.

Los errores comunes (un mod que no funciona, un conflicto, un fallo de la interfaz) van en un *Issue* normal.

## Versiones con soporte

Solo la última versión publicada en [Releases](../../releases/latest).

## Comprobar que tu descarga es auténtica

Los programas de este proyecto **no están firmados digitalmente** (por eso Windows muestra un aviso). Para comprobar que el archivo es exactamente el que se compiló en GitHub:

1. Descarga `SHA256SUMS.txt` de la misma Release.
2. En PowerShell, dentro de la carpeta de la descarga:

   ```powershell
   Get-FileHash .\FM-Launcher-Setup.exe -Algorithm SHA256
   ```

3. El valor debe coincidir con el de `SHA256SUMS.txt`.

Descarga siempre desde la página de [Releases](../../releases) de este repositorio.

## Qué hace (y qué no) el launcher

- No se conecta a internet por su cuenta ni envía datos.
- Solo copia archivos dentro de `fm_Data\StreamingAssets` del juego, con respaldo, y solo los que tú agregas.
- Al abrir un `.zip`, `.7z` o `.rar` **nunca ejecuta** nada de su interior; descarta scripts y ejecutables y bloquea rutas que se salgan de la carpeta de destino.
- La interfaz corre aislada (sin acceso a Node, con política de seguridad de contenido estricta y sin permisos del navegador).
