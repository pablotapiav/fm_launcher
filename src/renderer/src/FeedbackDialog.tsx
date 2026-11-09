import { useState } from 'react'
import { GITHUB_URL, TWITTER_HANDLE } from '../../shared/links'
import type { ErrorReport } from './diagnostics'
import Icon from './Icon'
import type { Translate } from './i18n'

interface Props {
  t: Translate
  /** Si viene, el pop-up se abrió por un fallo: se muestran sus detalles. */
  error: ErrorReport | null
  /** Texto de diagnóstico que el usuario puede copiar y pegar en su mensaje. */
  diagnostics: string
  onClose: () => void
  /** Solo en la pantalla de fallo grave: reinicia la ventana. */
  onReload?: () => void
}

/** Pop-up para enviar comentarios: se abre ante un fallo o desde la esquina inferior izquierda. */
export default function FeedbackDialog({ t, error, diagnostics, onClose, onReload }: Props): React.JSX.Element {
  const [copied, setCopied] = useState(false)

  const copy = (): void => {
    void window.api.copyText(diagnostics).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="overlay feedback-overlay" role="dialog" aria-modal="true" aria-labelledby="feedback-title">
      <div className="dialog feedback">
        <div className={`welcome-icon ${error ? 'is-error' : ''}`}>
          <Icon name={error ? 'alert' : 'message'} size={26} />
        </div>
        <h2 id="feedback-title">{error ? t('feedback.titleError') : t('feedback.title')}</h2>
        <p className="welcome-text">{error ? t('feedback.textError') : t('feedback.text')}</p>

        <ul className="contact">
          <li>
            <div>
              <span className="contact-name">{t('feedback.twitter')}</span>
              <span className="contact-value">{TWITTER_HANDLE}</span>
            </div>
            <button type="button" className="btn small" onClick={() => void window.api.openLink('twitter')}>
              {t('feedback.open')} <Icon name="external" size={13} />
            </button>
          </li>
          <li>
            <div>
              <span className="contact-name">{t('feedback.github')}</span>
              <span className="contact-value">
                {GITHUB_URL ? GITHUB_URL.replace(/^https?:\/\//, '') : t('feedback.githubSoon')}
              </span>
            </div>
            <button
              type="button"
              className="btn small"
              disabled={!GITHUB_URL}
              onClick={() => void window.api.openLink('github')}
            >
              {t('feedback.open')} <Icon name="external" size={13} />
            </button>
          </li>
        </ul>

        {error && (
          <div className="error-box">
            <div className="error-box-head">
              <span className="field-label">{t('feedback.details')}</span>
              <button type="button" className="btn small" onClick={copy}>
                <Icon name={copied ? 'check' : 'copy'} size={13} /> {copied ? t('feedback.copied') : t('feedback.copy')}
              </button>
            </div>
            <pre>{diagnostics}</pre>
            <p className="hint">{t('feedback.copyHint')}</p>
          </div>
        )}

        <div className="dialog-foot feedback-foot">
          {onReload ? (
            <button type="button" className="btn" onClick={onReload}>
              <Icon name="refresh" size={15} /> {t('feedback.reload')}
            </button>
          ) : (
            <span />
          )}
          <button type="button" className="btn-primary" onClick={onClose} autoFocus>
            {t('feedback.close')}
          </button>
        </div>
      </div>
    </div>
  )
}
