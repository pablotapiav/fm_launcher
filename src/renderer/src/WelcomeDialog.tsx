import Icon from './Icon'
import type { Translate } from './i18n'

interface Props {
  t: Translate
  onContinue: () => void
  onVerify: () => void
}

/** Pop-up de la primera vez que se abre el launcher. */
export default function WelcomeDialog({ t, onContinue, onVerify }: Props): React.JSX.Element {
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <div className="welcome">
        <div className="dialog welcome-card">
          <div className="welcome-icon">
            <Icon name="shield" size={26} />
          </div>
          <h2 id="welcome-title">{t('welcome.title')}</h2>
          <p className="welcome-text">{t('welcome.text')}</p>

          <button type="button" className="btn-cta" onClick={onContinue} autoFocus>
            <span>{t('welcome.continue')}</span>
            <small>{t('welcome.recommended')}</small>
          </button>

          <div className="welcome-alt">
            <button type="button" className="btn-quiet" onClick={onVerify}>
              {t('welcome.verify')}
            </button>
            <p className="hint">{t('welcome.verifyHint')}</p>
          </div>
        </div>
        <p className="welcome-footer">
          <Icon name="info" size={14} /> {t('welcome.footer')}
        </p>
      </div>
    </div>
  )
}
