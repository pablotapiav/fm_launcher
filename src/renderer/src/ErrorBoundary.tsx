import { Component, type ErrorInfo, type ReactNode } from 'react'
import { buildDiagnostics } from './diagnostics'
import FeedbackDialog from './FeedbackDialog'
import { makeTranslator } from './i18n'

interface State {
  error: Error | null
}

/** Si la interfaz se rompe, en vez de quedar en blanco muestra el pop-up de comentarios. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ui]', error, info.componentStack)
  }

  render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children

    const t = makeTranslator(navigator.language.toLowerCase().startsWith('en') ? 'en' : 'es')
    return (
      <FeedbackDialog
        t={t}
        error={{ code: 'UI_CRASH', detail: `${error.name}: ${error.message}` }}
        diagnostics={buildDiagnostics({
          userAgent: navigator.userAgent,
          error: { code: 'UI_CRASH', detail: `${error.name}: ${error.message}` }
        })}
        onClose={() => this.setState({ error: null })}
        onReload={() => window.location.reload()}
      />
    )
  }
}
