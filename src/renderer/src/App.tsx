import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AddReport, AppState, Result, Settings } from '../../shared/types'
import Icon from './Icon'
import ModCard from './ModCard'
import SettingsDialog from './SettingsDialog'
import WelcomeDialog from './WelcomeDialog'
import FeedbackDialog from './FeedbackDialog'
import { buildDiagnostics, isBenignError, type ErrorReport } from './diagnostics'
import { errorText, makeTranslator } from './i18n'

interface Notice {
  kind: 'error' | 'info' | 'warn'
  text: string
  verify?: boolean
}

type Filter = 'all' | 'active' | 'inactive'

const api = window.api

export default function App(): React.JSX.Element {
  const [state, setState] = useState<AppState | null>(null)
  const [notices, setNotices] = useState<Notice[]>([])
  const [busy, setBusy] = useState(false)
  /** true mientras el juego estaba abierto al iniciar el launcher: bloquea toda la ventana. */
  const [startupBlock, setStartupBlock] = useState<boolean | null>(null)
  const [dragging, setDragging] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  /** Pop-up de comentarios: null = cerrado; con `error` se abrió por un fallo. */
  const [feedback, setFeedback] = useState<{ error: ErrorReport | null } | null>(null)

  /** Abre el pop-up por un fallo (si ya está abierto, no lo reemplaza). */
  const openFeedbackForError = useCallback((error: ErrorReport) => {
    setFeedback((prev) => prev ?? { error })
  }, [])

  // Fallos inesperados de la interfaz o del proceso principal.
  useEffect(() => {
    const onError = (e: ErrorEvent): void => {
      if (!isBenignError(e.message)) openFeedbackForError({ code: 'UNEXPECTED', detail: e.message })
    }
    const onRejection = (e: PromiseRejectionEvent): void => {
      const reason = e.reason instanceof Error ? `${e.reason.name}: ${e.reason.message}` : String(e.reason)
      if (!isBenignError(reason)) openFeedbackForError({ code: 'UNEXPECTED', detail: reason })
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    const offFatal = api.onFatalError((message) => openFeedbackForError({ code: 'UNEXPECTED', detail: message }))
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
      offFatal()
    }
  }, [openFeedbackForError])

  const t = useMemo(() => makeTranslator(state?.settings.language ?? 'es'), [state?.settings.language])

  const refresh = useCallback(async () => {
    const s = await api.getState()
    setState(s)
    setStartupBlock((prev) => (prev === null ? s.gameRunning : prev && s.gameRunning))
  }, [])

  // Carga inicial, y revisión de rutas cada vez que se vuelve a la ventana.
  useEffect(() => {
    void refresh()
    const onFocus = (): void => void refresh()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refresh])

  useEffect(() => {
    return api.onGameRunning((running) => {
      setState((prev) => (prev ? { ...prev, gameRunning: running } : prev))
      if (!running) setStartupBlock(false)
      void refresh()
    })
  }, [refresh])

  useEffect(() => {
    if (state) document.documentElement.lang = state.settings.language
  }, [state])

  const reportAdd = useCallback(
    (report: AddReport) => {
      const items: Notice[] = []
      if (report.added.length) items.push({ kind: 'info', text: t('add.added', { names: report.added.join(', ') }) })
      if (report.duplicates.length) {
        items.push({ kind: 'info', text: t('add.duplicates', { names: report.duplicates.join(', ') }) })
      }
      if (report.unknownTargets.length) {
        items.push({ kind: 'warn', text: t('add.unknown', { files: report.unknownTargets.join(', ') }) })
      }
      if (report.skipped.length) {
        items.push({ kind: 'warn', text: t('add.skipped', { count: String(report.skipped.length) }) })
      }
      setNotices(items)
    },
    [t]
  )

  /** Ejecuta una acción del proceso principal, muestra su error si lo hay y refresca el estado. */
  const run = useCallback(
    async <T,>(action: Promise<Result<T> | null>, onOk?: (data: T) => void): Promise<void> => {
      setBusy(true)
      try {
        const res = await action
        if (res) {
          if (res.ok) {
            if (onOk) onOk(res.data)
            else setNotices([])
          } else {
            setNotices([{ kind: 'error', text: errorText(t, res.error), verify: res.error.suggestSteamVerify }])
            // Los errores esperados (conflicto, juego abierto…) se explican en el aviso; un fallo real
            // de archivos o de descompresión además abre el pop-up para enviar comentarios.
            if (res.error.code === 'IO' || res.error.code === 'ARCHIVE_FAILED') {
              const p = res.error.params ?? {}
              openFeedbackForError({
                code: res.error.code,
                detail: [p.name, p.detail].filter(Boolean).join(': ')
              })
            }
          }
        }
      } finally {
        await refresh()
        setBusy(false)
      }
    },
    [t, refresh, openFeedbackForError]
  )

  const addPaths = useCallback((paths: string[]) => run(api.addPaths(paths), reportAdd), [run, reportAdd])

  // Arrastrar y soltar sobre toda la ventana.
  useEffect(() => {
    const over = (e: DragEvent): void => {
      e.preventDefault()
      setDragging(true)
    }
    const leave = (e: DragEvent): void => {
      if (e.relatedTarget === null) setDragging(false)
    }
    const drop = (e: DragEvent): void => {
      e.preventDefault()
      setDragging(false)
      const files = Array.from(e.dataTransfer?.files ?? [])
      const paths = files.map((f) => api.getPathForFile(f)).filter(Boolean)
      if (paths.length) void addPaths(paths)
    }
    window.addEventListener('dragover', over)
    window.addEventListener('dragleave', leave)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragover', over)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('drop', drop)
    }
  }, [addPaths])

  const changeSettings = (patch: Partial<Settings>): void => void run(api.setSettings(patch))

  const visibleMods = useMemo(() => {
    if (!state) return []
    const q = query.trim().toLowerCase()
    return state.mods.filter((m) => {
      if (filter === 'active' && !(m.status === 'active' || m.status === 'partial')) return false
      if (filter === 'inactive' && (m.status === 'active' || m.status === 'partial')) return false
      if (tagFilter && !m.tags.some((tag) => tag.id === tagFilter)) return false
      return !q || m.name.toLowerCase().includes(q) || (m.origin ?? '').toLowerCase().includes(q)
    })
  }, [state, query, filter, tagFilter])

  /** Etiquetas presentes en la biblioteca, con cuántos mods tiene cada una. */
  const tagCounts = useMemo(() => {
    const counts = new Map<string, { group: string; n: number }>()
    for (const m of state?.mods ?? []) {
      for (const tag of m.tags) {
        const cur = counts.get(tag.id)
        if (cur) cur.n += 1
        else counts.set(tag.id, { group: tag.group, n: 1 })
      }
    }
    return [...counts.entries()].sort((a, b) => b[1].n - a[1].n)
  }, [state?.mods])

  if (!state) return <div className="loading" />

  const locked = busy || state.gameRunning || !state.game
  const activeCount = state.mods.filter((m) => m.status === 'active').length

  if (startupBlock) {
    return (
      <div className="blocker">
        <div className="blocker-box">
          <div className="pulse" />
          <h1>{t('running.title')}</h1>
          <p>{t('running.text')}</p>
        </div>
      </div>
    )
  }

  const heroTitle = !state.game ? t('hero.noGame') : state.gameRunning ? t('hero.running') : t('hero.ready')

  return (
    <div className="app">
      <header className="topbar">
        <div className="logo">
          <span className="logo-mark">LFM</span>
          <span className="logo-text">LAUNCHER</span>
        </div>
        <button type="button" className="btn" onClick={() => setShowSettings(true)}>
          <Icon name="settings" size={16} /> {t('settings.title')}
        </button>
      </header>

      <div className="scroll">
        <section className="hero">
          <i className="bracket tl" />
          <i className="bracket tr" />
          <i className="bracket bl" />
          <i className="bracket br" />
          <div className="hero-info">
            <p className="kicker">{t('hero.kicker')}</p>
            <h1 className="hero-title">{heroTitle}</h1>
            <div className="chips">
              <span className={`chip ${state.game ? 'ok' : 'bad'}`}>
                <span className="dot" />
                {state.game ? t('game.found') : t('game.notFound')}
                {state.game?.buildId && <span className="chip-dim"> · {t('game.build', { build: state.game.buildId })}</span>}
              </span>
              {state.mods.length > 0 && (
                <span className="chip">
                  {t('hero.stats', { active: String(activeCount), total: String(state.mods.length) })}
                </span>
              )}
              {!state.game && (
                <button type="button" className="link" onClick={() => void run(api.pickGameDir())}>
                  {t('game.choose')}
                </button>
              )}
            </div>
          </div>
          <button
            type="button"
            className="play"
            disabled={!state.game || state.gameRunning}
            onClick={() => void run(api.launchGame())}
          >
            <span className="play-icon">
              <Icon name="play" size={22} />
            </span>
            <span className="play-text">{state.gameRunning ? t('play.running') : t('play')}</span>
          </button>
        </section>

        {state.gameRunning && (
          <div className="notice warn">
            <span>{t('running.banner')}</span>
          </div>
        )}

        {notices.map((n, i) => (
          <div key={i} className={`notice ${n.kind}`}>
            <span>{n.text}</span>
            <span className="notice-actions">
              {n.verify && (
                <button type="button" className="btn small" onClick={() => void api.steamVerify()}>
                  {t('btn.verify')}
                </button>
              )}
              <button
                type="button"
                className="icon-btn"
                aria-label={t('btn.dismiss')}
                onClick={() => setNotices((l) => l.filter((_, j) => j !== i))}
              >
                <Icon name="x" size={15} />
              </button>
            </span>
          </div>
        ))}

        <main>
          <div className="toolbar">
            <h2 className="list-title">
              {t('list.title')} <span className="count">{state.mods.length}</span>
            </h2>
            {state.mods.length > 0 && (
              <>
                <label className="search">
                  <Icon name="search" size={15} />
                  <input
                    type="text"
                    value={query}
                    placeholder={t('list.search')}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
                <div className="segmented" role="group">
                  {(['all', 'active', 'inactive'] as Filter[]).map((f) => (
                    <button
                      key={f}
                      type="button"
                      className={filter === f ? 'on' : ''}
                      onClick={() => setFilter(f)}
                    >
                      {t(`filter.${f}` as 'filter.all')}
                    </button>
                  ))}
                </div>
              </>
            )}
            <span className="grow" />
            <button type="button" className="btn" disabled={busy} onClick={() => void run(api.pickFiles(), reportAdd)}>
              <Icon name="plus" size={16} /> {t('add.files')}
            </button>
            <button type="button" className="btn" disabled={busy} onClick={() => void run(api.pickFolder(), reportAdd)}>
              <Icon name="folder" size={16} /> {t('add.folder')}
            </button>
          </div>

          {tagCounts.length > 0 && (
            <div className="tagbar" role="group" aria-label={t('tags.title')}>
              {tagCounts.map(([id, info]) => (
                <button
                  key={id}
                  type="button"
                  className={`tag g-${info.group} pick ${tagFilter === id ? 'on' : ''}`}
                  aria-pressed={tagFilter === id}
                  onClick={() => setTagFilter(tagFilter === id ? null : id)}
                >
                  {t(`tag.${id}` as 'tag.ui')} <span className="tag-n">{info.n}</span>
                </button>
              ))}
              {tagFilter && (
                <button type="button" className="btn-quiet small-quiet" onClick={() => setTagFilter(null)}>
                  {t('tags.clear')}
                </button>
              )}
            </div>
          )}

          {state.mods.length === 0 ? (
            <div className={`empty ${dragging ? 'over' : ''}`}>
              <div className="empty-icon">
                <Icon name="upload" size={30} />
              </div>
              <h3>{t('add.emptyTitle')}</h3>
              <p>{t('add.emptyText')}</p>
            </div>
          ) : (
            <>
              <div className={`dropstrip ${dragging ? 'over' : ''}`}>
                <Icon name="upload" size={16} /> {t('add.drop')}
              </div>
              {visibleMods.length === 0 ? (
                <p className="no-results">{t('list.noResults')}</p>
              ) : (
                <div className="list">
                  {visibleMods.map((mod) => (
                    <ModCard
                      key={mod.id}
                      mod={mod}
                      t={t}
                      locked={locked}
                      gameFound={!!state.game}
                      onActivate={() => void run(api.activate(mod.id))}
                      onDeactivate={() => void run(api.deactivate(mod.id))}
                      onSwap={() => void run(api.swapMod(mod.id))}
                      onRename={(name) => void run(api.renameMod(mod.id, name))}
                      onRemove={() => {
                        if (window.confirm(t('mod.removeConfirm', { name: mod.name }))) void run(api.removeMod(mod.id))
                      }}
                      onRelocate={(target) => void run(api.relocateFile(mod.id, target))}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      <footer className="foot">
        <button type="button" className="foot-link feedback-link" onClick={() => setFeedback({ error: null })}>
          <Icon name="message" size={14} /> {t('feedback.corner')}
        </button>
        <span className="foot-right">
          <span>FM Launcher · v{state.version}</span>
          <button type="button" className="foot-link" title={t('footer.verifyHint')} onClick={() => void api.steamVerify()}>
            <Icon name="shield" size={14} /> {t('footer.verify')}
          </button>
        </span>
      </footer>

      {dragging && <div className="drag-veil">{t('add.drop')}</div>}

      {!state.settings.introAcknowledged && (
        <WelcomeDialog
          t={t}
          onContinue={() => changeSettings({ introAcknowledged: true })}
          onVerify={() => {
            void api.steamVerify()
            setNotices([{ kind: 'info', text: t('welcome.verifyStarted') }])
            changeSettings({ introAcknowledged: true })
          }}
        />
      )}

      {feedback && (
        <FeedbackDialog
          t={t}
          error={feedback.error}
          diagnostics={buildDiagnostics({
            launcherVersion: state.version,
            gameBuild: state.game?.buildId,
            gameVersion: state.game?.version,
            modCount: state.mods.length,
            userAgent: navigator.userAgent,
            error: feedback.error
          })}
          onClose={() => setFeedback(null)}
        />
      )}

      {showSettings && (
        <SettingsDialog
          state={state}
          t={t}
          onClose={() => setShowSettings(false)}
          onChange={changeSettings}
          onPickGameDir={() => void run(api.pickGameDir())}
          onPickBackupDir={() => void run(api.pickBackupDir())}
          onOpenBackupDir={() => void api.openBackupDir()}
          onVerify={() => void api.steamVerify()}
        />
      )}
    </div>
  )
}
