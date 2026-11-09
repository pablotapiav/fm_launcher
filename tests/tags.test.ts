import { describe, expect, it } from 'vitest'
import { computeTags } from '../src/main/core/tags'

const AA = 'fm_Data/StreamingAssets/aa/StandaloneWindows64'
const AD = 'fm_Data/StreamingAssets/AddrData'

const mod = (name: string, targets: string[], origin?: string) => ({
  name,
  origin,
  files: targets.map((target) => ({ source: `C:\\x\\${target}`, target, mirrored: true }))
})

const ids = (m: ReturnType<typeof mod>): string[] => computeTags(m).map((t) => t.id)

describe('etiquetas inteligentes', () => {
  it('detecta vallas publicitarias y no etiqueta el catálogo (el mod real de ADBOARDS)', () => {
    const tags = computeTags(
      mod('ADBOARDS FM 27 CHILE & CONMEBOL', [
        `${AD}/adboards_assets_all.bundle`,
        `${AD}/catalog_info.bin`,
        `${AD}/catalog_info.hash`
      ])
    )
    expect(tags).toEqual([{ id: 'adboards', group: 'media' }])
  })

  it('un mod de interfaz de partido', () => {
    expect(ids(mod('Match Data Buttons', [`${AA}/ui-visualtreeassets_assets_matchvisualtreeassetpreload.bundle`]))).toEqual(['ui'])
    expect(ids(mod('Marcador', [`${AA}/ui-match_assets_all.bundle`]))).toEqual(['ui', 'match-ui'])
  })

  it('audio y público', () => {
    expect(ids(mod('Sonido', [`${AD}/audio_assets_all.bundle`]))).toEqual(['audio'])
    expect(ids(mod('Hinchada', [`${AA}/match-crowd_assets_assets_data_match_crowd_fm27_runtime.bundle`]))).toEqual(['crowd'])
  })

  it('los shaders de público no cuentan como audio ni como público', () => {
    expect(ids(mod('Shader', [`${AA}/shaders_assets_crowdpeopledirectinstanced.bundle`]))).toEqual(['shaders'])
  })

  it('pelo, estadios, balones, equipaciones y datos', () => {
    expect(ids(mod('Peinados', [`${AA}/art-characters-female-hair_assets_hairlongfemale_01.bundle`]))).toEqual(['characters', 'hair'])
    expect(ids(mod('Estadios', [`${AA}/stadiums-models_assets_10-20k_all.bundle`]))).toEqual(['stadium'])
    expect(ids(mod('Balón', [`${AD}/balls3d_assets_all.bundle`]))).toEqual(['ball'])
    expect(ids(mod('Kits', [`${AD}/kits2d-eng_assets_all.bundle`, `${AD}/kits3d-eng_assets_all.bundle`]))).toEqual(['kits'])
    expect(ids(mod('Datos', [`${AD}/players-eng_assets_all.bundle`, `${AD}/club-eng_assets_all.bundle`, `${AD}/comp-eng_assets_all.bundle`]))).toEqual(['players', 'clubs', 'competitions'])
  })

  it('combina varias etiquetas sin etiquetar el catálogo', () => {
    const tags = ids(
      mod('Pack completo', [
        `${AD}/catalog_info.bin`,
        `${AD}/adboards_assets_all.bundle`,
        `${AD}/audio_assets_all.bundle`,
        `${AA}/ui-fonts_assets_all.bundle`
      ])
    )
    expect(tags).toEqual(['adboards', 'audio', 'ui', 'fonts'])
  })

  it('si los archivos no dicen nada, usa el nombre del mod o del zip', () => {
    expect(ids(mod('Vallas Chile', [`${AA}/zzz_unknown.bundle`]))).toEqual(['adboards'])
    expect(ids(mod('Pack', [`${AA}/zzz_unknown.bundle`], 'Mi Skin Oscuro.zip'))).toEqual(['ui'])
    expect(ids(mod('Misterio', [`${AA}/zzz_unknown.bundle`]))).toEqual([])
  })

  it('el nombre no pisa lo que dicen los archivos', () => {
    expect(ids(mod('Super Stadium Pack', [`${AD}/adboards_assets_all.bundle`]))).toEqual(['adboards'])
  })
})
