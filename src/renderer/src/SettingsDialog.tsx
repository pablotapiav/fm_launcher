import type { AppState, Lang, Settings } from '../../shared/types'
import Icon from './Icon'
import type { Translate } from './i18n'

interface Props {
  state: AppState
  t: Translate
  onClose: () => void
  onChange: (patch: Partial<Settings>) => void
  onPickGameDir: () => void
  onPickBackupDir: () => void
  onOpenBackupDir: () => void
  onVerify: () => void
}

export default function SettingsDialog({
  state,
  t,
  onClose,
  onChange,
  onPickGameDir,
  onPickBackupDir,
  onOpenBackupDir,
  onVerify
}: Props): React.JSX.Element {
  const { settings } = state

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={t('settings.title')}>
      <div className="dialog settings">
        <header className="dialog-head">
          <h2>{t('settings.title')}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t('settings.close')}>
            <Icon name="x" />
          </button>
        </header>

        <section>
          <label className="field-label" htmlFor="lang">
            {t('settings.language')}
          </label>
          <select id="lang" value={settings.language} onChange={(e) => onChange({ language: e.target.value as Lang })}>
            <option value="es">Español</option>
            <option value="en">English</option>
          </select>
        </section>

        <section>
          <span className="field-label">{t('settings.gameDir')}</span>
          <p className="path-line">{state.game?.gameDir ?? t('game.notFound')}</p>
          {!settings.gameDir && <p className="hint">{t('settings.gameDirAuto')}</p>}
          <div className="row">
            <button type="button" className="btn" onClick={onPickGameDir}>
              <Icon name="folder" size={16} /> {t('settings.gameDirChange')}
            </button>
            {settings.gameDir && (
              <button type="button" className="btn-quiet" onClick={() => onChange({ gameDir: null })}>
                {t('settings.gameDirReset')}
              </button>
            )}
          </div>
        </section>

        <section>
          <label className="check">
            <input
              type="checkbox"
              checked={settings.backupsEnabled}
              onChange={(e) => onChange({ backupsEnabled: e.target.checked })}
            />
            <span>{t('settings.backups')}</span>
          </label>
          {!settings.backupsEnabled && (
            <p className="inline-warn">
              <Icon name="alert" size={14} /> {t('settings.backupsHint')}
            </p>
          )}

          <span className="field-label">{t('settings.backupDir')}</span>
          <p className="path-line">
            {state.backupDir}
            {!settings.backupDir && ` (${t('settings.backupDirDefault')})`}
          </p>
          <div className="row">
            <button type="button" className="btn" onClick={onPickBackupDir}>
              <Icon name="folder" size={16} /> {t('settings.gameDirChange')}
            </button>
            <button type="button" className="btn-quiet" onClick={onOpenBackupDir}>
              {t('settings.backupDirOpen')}
            </button>
            {settings.backupDir && (
              <button type="button" className="btn-quiet" onClick={() => onChange({ backupDir: null })}>
                {t('settings.backupDirReset')}
              </button>
            )}
          </div>
        </section>

        <section>
          <span className="field-label">{t('settings.restore')}</span>
          <p className="hint">{t('settings.verifyHint')}</p>
          <div className="row">
            <button type="button" className="btn" onClick={onVerify}>
              <Icon name="shield" size={16} /> {t('settings.verify')}
            </button>
          </div>
        </section>

        <footer className="dialog-foot">
          <span className="hint">{t('settings.version', { version: state.version })}</span>
          <button type="button" className="btn-primary" onClick={onClose}>
            {t('settings.close')}
          </button>
        </footer>
      </div>
    </div>
  )
}
