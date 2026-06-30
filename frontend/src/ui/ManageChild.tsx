import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { Child, Gender } from '../types'
import { patchChild, deleteChild, leaveChild, createInvitation } from '../api/client'
import { db } from '../db/database'
import { Button } from './components/Button'
import { ConfirmDialog } from './components/ConfirmDialog'

interface Props {
  child: Child
  token: string
  onClose: () => void
  onChanged: () => void
}

const ROLE_LABEL: Record<string, string> = { mama: 'Mama', papa: 'Papa' }

export function ManageChild({ child, token, onClose, onChanged }: Props) {
  // Form state — prefilled from child prop
  const [name, setName] = useState(child.name)
  const [gender, setGender] = useState<Gender>(child.gender)
  const [birthDate, setBirthDate] = useState(child.birthDate)
  const [birthWeightGrams, setBirthWeight] = useState(
    child.birthWeightGrams != null ? String(child.birthWeightGrams) : '',
  )
  const [saving, setSaving] = useState(false)

  // Invite state
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [inviteExpiry, setInviteExpiry] = useState<string | null>(null)
  const [inviting, setInviting] = useState(false)
  const [copied, setCopied] = useState(false)

  // Danger-zone busy flags
  const [deleting, setDeleting] = useState(false)
  const [leaving, setLeaving] = useState(false)

  // Confirmation dialogs
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)

  // Shared error display
  const [error, setError] = useState<string | null>(null)

  // ── handlers ──────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const res = await patchChild(token, child.id, {
        name: name.trim() || child.name,
        gender,
        birthDate,
        birthWeightGrams: birthWeightGrams ? Number(birthWeightGrams) : null,
      })
      await db.children.put(res.child)
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Speichern')
    } finally {
      setSaving(false)
    }
  }

  async function handleInvite() {
    setInviting(true)
    setError(null)
    setCopied(false)
    try {
      const res = await createInvitation(token, child.id)
      setInviteCode(res.code)
      setInviteExpiry(res.expiresAt)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Erstellen des Einladungs-Codes')
    } finally {
      setInviting(false)
    }
  }

  async function handleCopy() {
    if (!inviteCode) return
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(inviteCode)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch {
      setError('Kopieren fehlgeschlagen')
    }
  }

  async function handleDelete() {
    if (deleting) return
    setDeleting(true)
    setError(null)
    try {
      await deleteChild(token, child.id)
      await db.children.delete(child.id)
      onChanged()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Löschen')
    } finally {
      setDeleting(false)
    }
  }

  async function handleLeave() {
    if (leaving) return
    setLeaving(true)
    setError(null)
    try {
      await leaveChild(token, child.id)
      await db.children.delete(child.id)
      onChanged()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Verlassen')
    } finally {
      setLeaving(false)
    }
  }

  // ── render ────────────────────────────────────────────────────

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${child.name} verwalten`}
      className="fixed inset-0 z-50 grid place-items-center p-5 animate-fade-in"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-default"
      />

      {/* Panel */}
      <div className="relative w-full max-w-sm bg-neutral-900/95 border border-white/10 rounded-3xl p-5 shadow-2xl animate-pop overflow-y-auto max-h-[90dvh]">
        {/* Title row */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{child.name} verwalten</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="h-8 w-8 grid place-items-center rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-neutral-100 transition"
          >
            ✕
          </button>
        </div>

        {/* ── Edit form ── */}
        <section className="flex flex-col gap-3 mb-5">
          <div className="flex flex-col gap-1">
            <label htmlFor="mc-name" className="text-sm font-medium text-neutral-300">
              Name
            </label>
            <input
              id="mc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="field"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="mc-gender" className="text-sm font-medium text-neutral-300">
              Geschlecht
            </label>
            <select
              id="mc-gender"
              value={gender}
              onChange={(e) => setGender(e.target.value as Gender)}
              className="field"
            >
              <option value="female">Mädchen</option>
              <option value="male">Junge</option>
              <option value="diverse">Divers</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="mc-birthdate" className="text-sm font-medium text-neutral-300">
              Geburtsdatum
            </label>
            <input
              id="mc-birthdate"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="field"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="mc-weight" className="text-sm font-medium text-neutral-300">
              Geburtsgewicht (g)
            </label>
            <input
              id="mc-weight"
              inputMode="numeric"
              value={birthWeightGrams}
              onChange={(e) => setBirthWeight(e.target.value)}
              placeholder="z. B. 3200"
              className="field"
            />
          </div>

          <Button
            type="button"
            loading={saving}
            onClick={() => void handleSave()}
            className="w-full"
          >
            Speichern
          </Button>
        </section>

        {/* ── Members ── */}
        {child.members.length > 0 && (
          <section className="mb-5">
            <h3 className="text-sm font-medium text-neutral-400 mb-2">Mitglieder</h3>
            <ul className="flex flex-col gap-1.5">
              {child.members.map((m) => (
                <li
                  key={m.userId}
                  className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2"
                >
                  <span className="text-sm text-neutral-200 truncate">{m.email}</span>
                  <span className="text-xs text-neutral-500 ml-2 shrink-0">
                    {ROLE_LABEL[m.role] ?? m.role}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Invite ── */}
        <section className="mb-5">
          <h3 className="text-sm font-medium text-neutral-400 mb-2">Partner einladen</h3>

          {inviteCode ? (
            <div className="flex flex-col gap-2">
              {/* Code display */}
              <div className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-3 py-2">
                <span className="font-mono text-lg tracking-widest text-neutral-100 flex-1 select-all">
                  {inviteCode}
                </span>
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold px-2 py-1 rounded-lg hover:bg-white/8 transition"
                >
                  {copied ? 'Kopiert ✓' : 'Kopieren'}
                </button>
              </div>

              {inviteExpiry && (
                <p className="text-xs text-neutral-500">
                  Gültig bis:{' '}
                  {new Date(inviteExpiry).toLocaleDateString('de-DE', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })}
                </p>
              )}

              <Button
                type="button"
                variant="secondary"
                loading={inviting}
                onClick={() => void handleInvite()}
                className="w-full"
              >
                Neu generieren
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="secondary"
              loading={inviting}
              onClick={() => void handleInvite()}
              className="w-full"
            >
              Partner einladen
            </Button>
          )}
        </section>

        {/* ── Error ── */}
        {error && (
          <p className="animate-slide-down flex items-start gap-2 rounded-xl bg-red-500/12 border border-red-500/25 text-red-300 text-sm px-3 py-2.5 mb-4">
            <span aria-hidden="true">⚠️</span>
            <span>{error}</span>
          </p>
        )}

        {/* ── Danger zone ── */}
        <div className="flex flex-col gap-2 border-t border-white/8 pt-4">
          <button
            type="button"
            onClick={() => setConfirmLeave(true)}
            disabled={leaving}
            className="min-h-12 rounded-2xl bg-white/5 text-neutral-300 hover:bg-white/10 text-sm font-medium transition active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Kind verlassen
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            disabled={deleting}
            className="min-h-12 rounded-2xl bg-red-600/15 text-red-400 hover:bg-red-600/25 text-sm font-medium transition active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Kind löschen
          </button>
        </div>
      </div>

      {/* Confirmation dialogs (rendered on top via their own portal-in-portal) */}
      {confirmDelete && (
        <ConfirmDialog
          title="Kind löschen?"
          description={`„${child.name}" und alle Einträge werden dauerhaft gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.`}
          confirmLabel="Löschen"
          onConfirm={() => {
            setConfirmDelete(false)
            void handleDelete()
          }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}

      {confirmLeave && (
        <ConfirmDialog
          title="Kind verlassen?"
          description={`Du verlässt „${child.name}". Deine Einträge bleiben erhalten, du verlierst jedoch den Zugang.`}
          confirmLabel="Verlassen"
          onConfirm={() => {
            setConfirmLeave(false)
            void handleLeave()
          }}
          onCancel={() => setConfirmLeave(false)}
        />
      )}
    </div>,
    document.body,
  )
}
