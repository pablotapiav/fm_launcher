import { useState } from 'react'
import type { ModView } from '../../shared/types'
import Icon from './Icon'
import type { Translate } from './i18n'

interface Props {
  mod: ModView
  t: Translate
  /** El juego está abierto, no se encontró o hay otra operación en curso. */
  locked: boolean
  gameFound: boolean
  onActivate: () => void
  onDeactivate: () => void
  onSwap: () => void
  onRename: (name: string) => void
  onRemove: () => void
  onRelocate: (target: string) => void
}

const splitTarget = (target: string): { dir: string; name: string } => {
  const i = target.lastIndexOf('/')
  return { dir: target.slice(0, i + 1), name: target.slice(i + 1) }
}

export default function ModCard({
  mod,
  t,
  locked,
  gameFound,
  onActivate,
  onDeactivate,
  onSwap,
  onRename,
  onRemove,
  onRelocate
}: Props): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(mod.name)

  const isOn = mod.status === 'active'
  const names = (list: { name: string }[]): string => list.map((m) => m.name).join(', ')
  const outdated = mod.files.some((f) => f.outdated)
  const missing = mod.files.filter((f) => !f.sourceExists)
  const noTarget = gameFound ? mod.files.filter((f) => !f.targetExists && f.state !== 'active') : []

  const commitRename = (): void => {
    setEditing(false)
    if (draft.trim() && draft.trim() !== mod.name) onRename(draft.trim())
    else setDraft(mod.name)
  }

  return (
    <article className={`mod status-${mod.status}`}>
      <div className="mod-icon" aria-hidden="true">
        <Icon name="package" size={22} />
      </div>

      <div className="mod-body">
        <div className="mod-title">
          {editing ? (
            <input
              className="rename"
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename()
                if (e.key === 'Escape') {
                  setDraft(mod.name)
                  setEditing(false)
                }
              }}
            />
          ) : (
            <h3 onDoubleClick={() => setEditing(true)} title={mod.name}>
              {mod.name}
            </h3>
          )}
          <span className={`badge ${mod.status}`}>{t(`status.${mod.status}` as 'status.active')}</span>
        </div>

        <p className="mod-meta">
          {mod.files.length === 1 ? t('mod.fileOne') : t('mod.fileMany', { n: String(mod.files.length) })}
          {mod.origin && <> · {t('mod.fromArchive', { name: mod.origin })}</>}
        </p>

        {(mod.tags.length > 0 || mod.compat.state === 'match') && (
          <div className="tags">
            {mod.compat.state === 'match' && (
              <span
                className="tag g-data"
                title={
                  mod.compat.exact
                    ? t('mod.compatOkHint', { current: mod.compat.current ?? '' })
                    : t('mod.compatCloseHint', {
                        declared: mod.compat.declared ?? '',
                        current: mod.compat.current ?? ''
                      })
                }
              >
                <Icon name="check" size={11} />
                {t('mod.compatOk')}
              </span>
            )}
            {mod.tags.map((tag) => (
              <span
                key={tag.id}
                className={`tag g-${tag.group}`}
                title={tag.group === 'warn' ? t(`tag.hint.${tag.id}` as 'tag.hint.core') : undefined}
              >
                {tag.group === 'warn' && <Icon name="alert" size={11} />}
                {t(`tag.${tag.id}` as 'tag.ui')}
              </span>
            ))}
          </div>
        )}

        {mod.blockedBy.length > 0 && !isOn && (
          <div className="alert warn conflict">
            <Icon name="alert" size={15} />
            <span className="alert-text">{t('mod.conflictActive', { mods: names(mod.blockedBy) })}</span>
            <button
              type="button"
              className="btn small swap"
              disabled={locked}
              title={t('mod.swapHint', { mods: names(mod.blockedBy) })}
              onClick={onSwap}
            >
              <Icon name="refresh" size={13} /> {t('mod.swap')}
            </button>
          </div>
        )}
        {mod.compat.state === 'different' && (
          <p className="alert info">
            <Icon name="info" size={15} />{' '}
            {t('mod.compatDiff', { declared: mod.compat.declared ?? '?', current: mod.compat.current ?? '?' })}
          </p>
        )}
        {mod.conflictsWith.length > 0 && mod.blockedBy.length === 0 && (
          <p className="alert warn">
            <Icon name="alert" size={15} /> {t('mod.conflict', { mods: names(mod.conflictsWith) })}
          </p>
        )}
        {outdated && (
          <p className="alert warn">
            <Icon name="refresh" size={15} /> {t('mod.outdated')}
          </p>
        )}
        {missing.length > 0 && (
          <p className="alert bad">
            <Icon name="x" size={15} /> {t('mod.missingFile')}
          </p>
        )}
        {noTarget.length > 0 && (
          <p className="alert warn">
            <Icon name="alert" size={15} /> {t('mod.noTarget')}
          </p>
        )}

        <details className="files">
          <summary>
            <Icon name="chevron" size={14} /> {t('mod.files')}
          </summary>
          <ul>
            {mod.files.map((f) => {
              const { dir, name } = splitTarget(f.target)
              return (
                <li key={f.target} className={f.sourceExists ? '' : 'gone'}>
                  <div className="file-info">
                    <span className="file-name">
                      <span className="file-dir">{dir}</span>
                      {name}
                    </span>
                    <span className="path" title={f.source}>
                      {f.source}
                    </span>
                  </div>
                  {!f.sourceExists && (
                    <button type="button" className="btn small" onClick={() => onRelocate(f.target)}>
                      {t('mod.relocate')}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </details>
      </div>

      <div className="mod-side">
        <div className="toggle-wrap">
          <span className={`toggle-label ${isOn ? 'on' : ''}`}>{isOn ? t('mod.on') : t('mod.off')}</span>
          <button
            type="button"
            role="switch"
            aria-checked={isOn}
            aria-label={t('mod.toggle')}
            title={t('mod.toggle')}
            className={`switch ${isOn ? 'on' : ''}`}
            disabled={locked}
            onClick={isOn ? onDeactivate : onActivate}
          >
            <span className="knob" />
          </button>
        </div>
        <div className="mod-tools">
          {outdated && !locked && (
            <button type="button" className="icon-btn" title={t('mod.reapply')} aria-label={t('mod.reapply')} onClick={onActivate}>
              <Icon name="refresh" size={16} />
            </button>
          )}
          <button type="button" className="icon-btn" title={t('mod.rename')} aria-label={t('mod.rename')} onClick={() => setEditing(true)}>
            <Icon name="pencil" size={16} />
          </button>
          <button type="button" className="icon-btn danger" title={t('mod.remove')} aria-label={t('mod.remove')} onClick={onRemove}>
            <Icon name="trash" size={16} />
          </button>
        </div>
      </div>
    </article>
  )
}
