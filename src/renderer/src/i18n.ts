import type { ErrorCode, Lang, LauncherErrorInfo } from '../../shared/types'

const es = {
  'hero.kicker': 'FOOTBALL MANAGER 27',
  'hero.ready': 'Listo para jugar',
  'hero.noGame': 'No se encontró el juego',
  'hero.running': 'El juego está en ejecución',
  'hero.stats': '{active} de {total} mods activos',
  'game.found': 'Detectado',
  'game.build': 'build {build}',
  'game.notFound': 'Sin detectar',
  'game.choose': 'Elegir carpeta…',
  play: 'Jugar FM',
  'play.running': 'FM en ejecución',

  'running.title': 'Football Manager 27 está abierto',
  'running.text':
    'Ciérralo para poder usar el launcher. Esta ventana se desbloqueará sola cuando el juego se cierre.',
  'running.banner': 'FM27 está en ejecución. Ciérralo para activar o desactivar mods.',

  'welcome.title': 'Antes de empezar',
  'welcome.text':
    'El launcher solo administra los mods que tú le agregues. Si ya instalaste mods a mano, puedes seguir con los archivos que tienes ahora o volver primero a los archivos originales del juego.',
  'welcome.continue': 'Continuar con mis archivos actuales',
  'welcome.recommended': 'Recomendado',
  'welcome.verify': 'Verificar archivos',
  'welcome.verifyHint':
    'Reemplazará los archivos actuales del juego por los originales. También quita los mods que hayas instalado a mano.',
  'welcome.footer': 'Siempre puedes restaurar los archivos originales desde Configuración.',
  'welcome.verifyStarted': 'Steam está verificando los archivos del juego. Cuando termine, vuelve aquí.',

  'add.drop': 'Suelta aquí archivos .zip, .7z, .rar, .bundle o carpetas',
  'add.hint': 'Arrastra el mod tal como lo descargaste. El launcher recuerda dónde está cada uno.',
  'add.files': 'Añadir archivos',
  'add.folder': 'Añadir carpeta',
  'add.emptyTitle': 'Agrega tu primer mod',
  'add.emptyText':
    'Arrastra el .zip tal como lo descargaste, un .bundle o una carpeta. También puedes usar los botones.',
  'add.added': 'Mods agregados: {names}.',
  'add.duplicates': 'Ya estaban en la lista (se actualizaron sus archivos): {names}.',
  'add.unknown':
    'Estos archivos no existen en la carpeta del juego, así que no se podrán activar: {files}.',
  'add.skipped':
    'Se ignoraron {count} archivos del mod por estar fuera de StreamingAssets o ser ejecutables.',

  'list.title': 'Mis mods',
  'list.search': 'Buscar en mis mods…',
  'list.noResults': 'Ningún mod coincide con tu búsqueda.',
  'filter.all': 'Todos',
  'filter.active': 'Activos',
  'filter.inactive': 'Inactivos',
  'tags.title': 'Etiquetas',
  'tags.clear': 'Quitar filtro',
  'tag.adboards': 'Vallas',
  'tag.audio': 'Audio',
  'tag.video': 'Video',
  'tag.ball': 'Balón',
  'tag.kits': 'Equipaciones',
  'tag.effects': 'Efectos',
  'tag.ui': 'Interfaz',
  'tag.fonts': 'Fuentes',
  'tag.icons': 'Iconos',
  'tag.backgrounds': 'Fondos',
  'tag.match-ui': 'Partido',
  'tag.stadium': 'Estadio',
  'tag.scenes': 'Escenas',
  'tag.environment': 'Entorno',
  'tag.lighting': 'Iluminación',
  'tag.crowd': 'Público',
  'tag.characters': 'Personajes',
  'tag.hair': 'Peinados',
  'tag.shaders': 'Shaders',
  'tag.players': 'Jugadores',
  'tag.clubs': 'Clubes',
  'tag.competitions': 'Competiciones',
  'tag.flags': 'Banderas',
  'tag.catalog': 'Catálogo',
  'tag.core': 'Núcleo',
  'tag.hint.catalog': 'Reemplaza archivos del catálogo del juego. Suele romperse tras un parche.',
  'tag.hint.core': 'Reemplaza módulos centrales del juego. Es delicado tras un parche.',

  'status.active': 'Activo',
  'status.inactive': 'Inactivo',
  'status.partial': 'Parcial',
  'status.missing': 'No encontrado',

  'mod.toggle': 'Activar o desactivar',
  'mod.on': 'Activado',
  'mod.off': 'Desactivado',
  'mod.rename': 'Renombrar',
  'mod.remove': 'Quitar',
  'mod.relocate': 'Ubicar archivo…',
  'mod.reapply': 'Volver a aplicar',
  'mod.files': 'Archivos',
  'mod.fileOne': '1 archivo',
  'mod.fileMany': '{n} archivos',
  'mod.fromArchive': 'desde {name}',
  'mod.conflict': 'Conflicto: reemplaza el mismo archivo que {mods}. Solo uno de ellos puede estar activo.',
  'mod.conflictActive': 'Conflicto: {mods} está activo y reemplaza el mismo archivo. Solo uno puede estar activo.',
  'mod.swap': 'Cambiar a este mod',
  'mod.swapHint': 'Desactiva {mods} y activa este.',
  'mod.catalogWarn':
    'Trae su propio catálogo del juego: puede no combinar con otros mods activos ({mods}) aunque no compartan archivos.',
  'mod.compatOk': 'Para tu versión',
  'mod.compatOkHint': 'El mod declara la misma versión del juego que tienes ({current}).',
  'mod.compatCloseHint':
    'Misma versión base. Solo cambia el número de compilación (mod: {declared}, tu juego: {current}), lo que normalmente no afecta.',
  'mod.compatDiff':
    'Hecho para {declared}; tu juego es {current}. Probablemente funcione; si notas algo raro, desactívalo.',
  'mod.missingFile': 'No se pudo encontrar el archivo en la ruta indicada.',
  'mod.noTarget': 'Un archivo de este mod no existe en la carpeta del juego.',
  'mod.outdated': 'El archivo del mod cambió desde que se activó. Vuelve a aplicarlo para usar la versión nueva.',
  'mod.removeConfirm': '¿Quitar "{name}" de la lista? Los archivos que descargaste no se borran.',

  'settings.title': 'Configuración',
  'settings.language': 'Idioma',
  'settings.gameDir': 'Carpeta de FM27',
  'settings.gameDirAuto': 'Detectada automáticamente',
  'settings.gameDirChange': 'Cambiar…',
  'settings.gameDirReset': 'Detectar automáticamente',
  'settings.backups': 'Guardar respaldos de los archivos originales',
  'settings.backupsHint':
    'Con los respaldos desactivados no se podrá volver al archivo original sin verificar los archivos en Steam.',
  'settings.backupDir': 'Carpeta de respaldos',
  'settings.backupDirDefault': 'Por defecto',
  'settings.backupDirOpen': 'Abrir',
  'settings.backupDirReset': 'Usar la de por defecto',
  'settings.restore': 'Restaurar archivos originales',
  'settings.verify': 'Verificar archivos en Steam',
  'settings.verifyHint':
    'Reemplaza los archivos actuales del juego por los originales (esto también quita los mods).',
  'settings.close': 'Cerrar',
  'settings.version': 'Versión {version}',

  'footer.verify': 'Verificar archivos en Steam',
  'footer.verifyHint': 'Restaura los archivos originales del juego',

  'feedback.corner': '¡Agradecemos tus comentarios!',
  'feedback.title': '¡Agradecemos tus comentarios!',
  'feedback.titleError': 'Algo no salió bien',
  'feedback.text': 'Si tuviste un error o tienes una idea para mejorar el launcher, puedes escribirnos:',
  'feedback.textError':
    'Lo sentimos. Si tuviste un error, puedes enviarnos tu comentario por cualquiera de estos canales:',
  'feedback.twitter': 'Twitter / X',
  'feedback.github': 'GitHub',
  'feedback.githubSoon': 'Próximamente',
  'feedback.open': 'Abrir',
  'feedback.details': 'Detalles del error',
  'feedback.copy': 'Copiar detalles',
  'feedback.copied': 'Copiado',
  'feedback.copyHint':
    'Pega los detalles en tu mensaje para que podamos ayudarte mejor. Pueden incluir rutas de tu PC.',
  'feedback.close': 'Cerrar',
  'feedback.reload': 'Reiniciar la ventana',
  'btn.verify': 'Verificar archivos en Steam',
  'btn.dismiss': 'Cerrar',

  'error.GAME_RUNNING': 'Cierra FM27 antes de activar o desactivar mods.',
  'error.GAME_NOT_FOUND': 'No se encontró la carpeta de FM27. Elígela en Configuración.',
  'error.MOD_NOT_FOUND': 'No se encontró ese mod.',
  'error.SOURCE_MISSING': 'No se pudo encontrar el archivo del mod: {files}.',
  'error.TARGET_MISSING': 'Estos archivos no existen en la carpeta del juego: {files}.',
  'error.CONFLICT':
    'Conflicto: {mods} ya reemplaza el mismo archivo. Solo uno puede estar activo; desactívalo primero.',
  'error.NO_BACKUP':
    'No hay respaldo del archivo original ({files}), así que no se puede revertir desde aquí. Usa "Verificar archivos en Steam".',
  'error.BUILD_CHANGED':
    'El juego se actualizó después de activar el mod ({files}), así que el respaldo ya no sirve. Usa "Verificar archivos en Steam".',
  'error.MOD_ACTIVE': 'Desactiva el mod antes de quitarlo de la lista.',
  'error.NOTHING_ADDED': 'No se encontraron mods utilizables (.bundle o carpetas fm_Data) en lo que elegiste.',
  'error.INVALID_GAME_DIR': 'Esa carpeta no parece ser una instalación de FM27.',
  'error.WRONG_FILE': 'Ese no es el archivo correcto: debe llamarse {expected}.',
  'error.ARCHIVE_FAILED': 'No se pudo abrir "{name}". ¿Está dañado o protegido? ({detail})',
  'error.IO': 'Ocurrió un error con los archivos: {detail}'
}

export type Key = keyof typeof es

const en: Record<Key, string> = {
  'hero.kicker': 'FOOTBALL MANAGER 27',
  'hero.ready': 'Ready to play',
  'hero.noGame': 'Game not found',
  'hero.running': 'The game is running',
  'hero.stats': '{active} of {total} mods active',
  'game.found': 'Detected',
  'game.build': 'build {build}',
  'game.notFound': 'Not detected',
  'game.choose': 'Choose folder…',
  play: 'Play FM',
  'play.running': 'FM running',

  'running.title': 'Football Manager 27 is running',
  'running.text':
    'Close it to use the launcher. This window will unlock by itself once the game is closed.',
  'running.banner': 'FM27 is running. Close it to enable or disable mods.',

  'welcome.title': 'Before you start',
  'welcome.text':
    'The launcher only manages the mods you add to it. If you already installed mods by hand, you can keep the files you have now or go back to the original game files first.',
  'welcome.continue': 'Continue with my current files',
  'welcome.recommended': 'Recommended',
  'welcome.verify': 'Verify files',
  'welcome.verifyHint':
    'This replaces the current game files with the originals. It also removes any mods you installed by hand.',
  'welcome.footer': 'You can always restore the original files from Settings.',
  'welcome.verifyStarted': 'Steam is verifying the game files. Come back here when it finishes.',

  'add.drop': 'Drop .zip, .7z, .rar, .bundle files or folders here',
  'add.hint': 'Drag the mod just as you downloaded it. The launcher remembers where each one is.',
  'add.files': 'Add files',
  'add.folder': 'Add folder',
  'add.emptyTitle': 'Add your first mod',
  'add.emptyText': 'Drag the .zip just as you downloaded it, a .bundle or a folder. You can also use the buttons.',
  'add.added': 'Mods added: {names}.',
  'add.duplicates': 'Already in the list (their files were refreshed): {names}.',
  'add.unknown': "These files don't exist in the game folder, so they can't be enabled: {files}.",
  'add.skipped': '{count} mod files were ignored because they are outside StreamingAssets or executable.',

  'list.title': 'My mods',
  'list.search': 'Search my mods…',
  'list.noResults': 'No mod matches your search.',
  'filter.all': 'All',
  'filter.active': 'Active',
  'filter.inactive': 'Inactive',
  'tags.title': 'Tags',
  'tags.clear': 'Clear filter',
  'tag.adboards': 'Adboards',
  'tag.audio': 'Audio',
  'tag.video': 'Video',
  'tag.ball': 'Ball',
  'tag.kits': 'Kits',
  'tag.effects': 'Effects',
  'tag.ui': 'Interface',
  'tag.fonts': 'Fonts',
  'tag.icons': 'Icons',
  'tag.backgrounds': 'Backgrounds',
  'tag.match-ui': 'Match',
  'tag.stadium': 'Stadium',
  'tag.scenes': 'Scenes',
  'tag.environment': 'Environment',
  'tag.lighting': 'Lighting',
  'tag.crowd': 'Crowd',
  'tag.characters': 'Characters',
  'tag.hair': 'Hair',
  'tag.shaders': 'Shaders',
  'tag.players': 'Players',
  'tag.clubs': 'Clubs',
  'tag.competitions': 'Competitions',
  'tag.flags': 'Flags',
  'tag.catalog': 'Catalog',
  'tag.core': 'Core',
  'tag.hint.catalog': 'Replaces game catalog files. Often breaks after a patch.',
  'tag.hint.core': 'Replaces core game modules. Sensitive after a patch.',

  'status.active': 'Active',
  'status.inactive': 'Inactive',
  'status.partial': 'Partial',
  'status.missing': 'Not found',

  'mod.toggle': 'Enable or disable',
  'mod.on': 'Enabled',
  'mod.off': 'Disabled',
  'mod.rename': 'Rename',
  'mod.remove': 'Remove',
  'mod.relocate': 'Locate file…',
  'mod.reapply': 'Apply again',
  'mod.files': 'Files',
  'mod.fileOne': '1 file',
  'mod.fileMany': '{n} files',
  'mod.fromArchive': 'from {name}',
  'mod.conflict': 'Conflict: it replaces the same file as {mods}. Only one of them can be active.',
  'mod.conflictActive': 'Conflict: {mods} is active and replaces the same file. Only one can be active.',
  'mod.swap': 'Switch to this mod',
  'mod.swapHint': 'Disables {mods} and enables this one.',
  'mod.catalogWarn':
    'It ships its own game catalog: it may not combine with other active mods ({mods}) even if they share no files.',
  'mod.compatOk': 'For your version',
  'mod.compatOkHint': 'The mod declares the same game version you have ({current}).',
  'mod.compatCloseHint':
    'Same base version. Only the build number differs (mod: {declared}, your game: {current}), which normally makes no difference.',
  'mod.compatDiff':
    'Made for {declared}; your game is {current}. It will probably work; if something looks off, disable it.',
  'mod.missingFile': 'The file could not be found at the saved path.',
  'mod.noTarget': "A file of this mod doesn't exist in the game folder.",
  'mod.outdated': 'The mod file changed since it was enabled. Apply it again to use the new version.',
  'mod.removeConfirm': 'Remove "{name}" from the list? The files you downloaded are not deleted.',

  'settings.title': 'Settings',
  'settings.language': 'Language',
  'settings.gameDir': 'FM27 folder',
  'settings.gameDirAuto': 'Detected automatically',
  'settings.gameDirChange': 'Change…',
  'settings.gameDirReset': 'Detect automatically',
  'settings.backups': 'Keep backups of the original files',
  'settings.backupsHint':
    "With backups turned off you won't be able to get the original file back without verifying the game files in Steam.",
  'settings.backupDir': 'Backup folder',
  'settings.backupDirDefault': 'Default',
  'settings.backupDirOpen': 'Open',
  'settings.backupDirReset': 'Use the default',
  'settings.restore': 'Restore original files',
  'settings.verify': 'Verify files in Steam',
  'settings.verifyHint': 'Replaces the current game files with the originals (this also removes your mods).',
  'settings.close': 'Close',
  'settings.version': 'Version {version}',

  'footer.verify': 'Verify files in Steam',
  'footer.verifyHint': 'Restores the original game files',

  'feedback.corner': 'We appreciate your feedback!',
  'feedback.title': 'We appreciate your feedback!',
  'feedback.titleError': 'Something went wrong',
  'feedback.text': 'If you hit an error or have an idea to improve the launcher, write to us:',
  'feedback.textError': "We're sorry. If you hit an error, you can send us your comment through any of these channels:",
  'feedback.twitter': 'Twitter / X',
  'feedback.github': 'GitHub',
  'feedback.githubSoon': 'Coming soon',
  'feedback.open': 'Open',
  'feedback.details': 'Error details',
  'feedback.copy': 'Copy details',
  'feedback.copied': 'Copied',
  'feedback.copyHint':
    'Paste the details into your message so we can help you better. They may include paths from your PC.',
  'feedback.close': 'Close',
  'feedback.reload': 'Reload the window',
  'btn.verify': 'Verify files in Steam',
  'btn.dismiss': 'Dismiss',

  'error.GAME_RUNNING': 'Close FM27 before enabling or disabling mods.',
  'error.GAME_NOT_FOUND': 'The FM27 folder was not found. Choose it in Settings.',
  'error.MOD_NOT_FOUND': 'That mod was not found.',
  'error.SOURCE_MISSING': 'The mod file could not be found: {files}.',
  'error.TARGET_MISSING': "These files don't exist in the game folder: {files}.",
  'error.CONFLICT':
    'Conflict: {mods} already replaces the same file. Only one can be active; disable it first.',
  'error.NO_BACKUP':
    'There is no backup of the original file ({files}), so it can\'t be reverted from here. Use "Verify files in Steam".',
  'error.BUILD_CHANGED':
    'The game was updated after the mod was enabled ({files}), so the backup is no longer valid. Use "Verify files in Steam".',
  'error.MOD_ACTIVE': 'Disable the mod before removing it from the list.',
  'error.NOTHING_ADDED': 'No usable mods (.bundle or fm_Data folders) were found in what you chose.',
  'error.INVALID_GAME_DIR': "That folder doesn't look like an FM27 installation.",
  'error.WRONG_FILE': "That's not the right file: it must be named {expected}.",
  'error.ARCHIVE_FAILED': 'Could not open "{name}". Is it damaged or protected? ({detail})',
  'error.IO': 'A file error occurred: {detail}'
}

const dictionaries: Record<Lang, Record<Key, string>> = { es, en }

export type Translate = (key: Key, params?: Record<string, string>) => string

export function makeTranslator(lang: Lang): Translate {
  const dict = dictionaries[lang]
  return (key, params) => {
    let text = dict[key]
    if (params) for (const [k, v] of Object.entries(params)) text = text.split(`{${k}}`).join(v)
    return text
  }
}

export function errorText(t: Translate, error: LauncherErrorInfo): string {
  const key = `error.${error.code satisfies ErrorCode}` as Key
  return t(key, error.params)
}
