import type { Mod, ModTag } from '../../shared/types'
import { targetName } from './paths'

type Group = ModTag['group']

/** Cada etiqueta pertenece a un grupo que decide su color en la interfaz. */
const GROUPS: Record<string, Group> = {
  adboards: 'media',
  audio: 'media',
  video: 'media',
  ball: 'media',
  kits: 'media',
  effects: 'media',
  ui: 'interface',
  fonts: 'interface',
  icons: 'interface',
  backgrounds: 'interface',
  'match-ui': 'interface',
  stadium: 'world',
  scenes: 'world',
  environment: 'world',
  lighting: 'world',
  crowd: 'world',
  characters: 'world',
  hair: 'world',
  shaders: 'world',
  players: 'data',
  clubs: 'data',
  competitions: 'data',
  flags: 'data',
  core: 'warn'
}

/** Reglas sobre el nombre de cada archivo; los nombres de bundle de FM27 son bastante descriptivos. */
const FILE_RULES: [RegExp, string[]][] = [
  [/^adboards/, ['adboards']],
  [/^audio/, ['audio']],
  [/^(match-)?crowd/, ['crowd']],
  [/^balls/, ['ball']],
  [/^(kits2d|kits3d|sleeves)/, ['kits']],
  [/^(players|portraits)/, ['players']],
  [/^club/, ['clubs']],
  [/^comp-/, ['competitions']],
  [/^(flag|pitchflags)/, ['flags']],
  [/^(stadiums|stadiumbuilder)/, ['stadium']],
  [/^scenes_/, ['scenes']],
  [/^art-characters.*(hair|facialhair)/, ['characters', 'hair']],
  [/^art-characters/, ['characters']],
  [/^art-lighting/, ['lighting']],
  [/^(art-environments|art-props)/, ['environment']],
  [/^shaders/, ['shaders']],
  [/^videos/, ['video']],
  [/^vfx/, ['effects']],
  [/^ui-fonts/, ['ui', 'fonts']],
  [/^(ui-icons|ui-iconspriteatlases)/, ['ui', 'icons']],
  [/^ui-backgrounds/, ['ui', 'backgrounds']],
  [/^(ui-match|ui-prematch)/, ['ui', 'match-ui']],
  [/^ui-/, ['ui']],
  // El catálogo lo trae casi todo mod con contenido nuevo: no dice nada del mod, así que no lleva etiqueta.
  [/^catalog/, []],
  [/^gamemodules/, ['core']]
]

/** Solo se usan si los archivos no dicen nada: el nombre del mod o del zip. */
const NAME_RULES: [RegExp, string][] = [
  [/adboard|valla|publicidad|advert/, 'adboards'],
  [/audio|sound|sonido|chant|c[aá]ntico|hinchada|commentary|comentar/, 'audio'],
  [/skin|interfaz|\bui\b|theme|\btema\b/, 'ui'],
  [/\bkits?\b|camiseta|jersey|equipaci/, 'kits'],
  [/stadium|estadio/, 'stadium'],
  [/\bballs?\b|bal[oó]n/, 'ball'],
  [/\bfaces?\b|\bcaras?\b|portrait|retrato/, 'players'],
  [/logo|escudo|badge|crest/, 'clubs'],
  [/\bhair\b|pelo|peinado/, 'hair'],
  [/video|v[ií]deo/, 'video'],
  [/lighting|iluminaci/, 'lighting']
]

/**
 * Etiquetas de un mod, deducidas de los archivos que reemplaza (y, si eso no basta,
 * del nombre). Las de grupo "warn" avisan de archivos delicados que suelen romperse con los parches.
 */
export function computeTags(mod: Pick<Mod, 'name' | 'files' | 'origin'>): ModTag[] {
  const ids: string[] = []
  const add = (id: string): void => {
    if (!ids.includes(id)) ids.push(id)
  }

  for (const f of mod.files) {
    const name = targetName(f.target).toLowerCase()
    for (const [re, tags] of FILE_RULES) {
      if (re.test(name)) {
        tags.forEach(add)
        break
      }
    }
  }

  if (!ids.some((id) => GROUPS[id] !== 'warn')) {
    const text = `${mod.name} ${mod.origin ?? ''}`.toLowerCase()
    for (const [re, id] of NAME_RULES) if (re.test(text)) add(id)
  }

  // Las etiquetas de aviso van al final.
  ids.sort((a, b) => Number(GROUPS[a] === 'warn') - Number(GROUPS[b] === 'warn'))
  return ids.map((id) => ({ id, group: GROUPS[id] }))
}
