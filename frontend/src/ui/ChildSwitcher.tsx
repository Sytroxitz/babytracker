import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { Child } from '../types'
import { useChildren } from '../children/useChildren'
import { ManageChild } from './ManageChild'

interface Props {
  token: string
  onAddChild: () => void
}

export function ChildSwitcher({ token, onAddChild }: Props) {
  const { children, activeChild, setActiveChild, refresh } = useChildren()
  const [open, setOpen] = useState(false)
  const [managingChild, setManagingChild] = useState<Child | null>(null)

  function handleSelect(id: string) {
    void setActiveChild(id)
    setOpen(false)
  }

  function handleManage(child: Child) {
    setManagingChild(child)
    setOpen(false)
  }

  return (
    <>
      {/* Trigger button — accessible name = active child name */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="flex items-center gap-1.5 text-sm font-medium text-neutral-100 hover:text-white px-2.5 py-1.5 rounded-xl hover:bg-white/8 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50"
      >
        {activeChild?.name ?? 'Kind wählen'}
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          aria-hidden="true"
          className="h-3.5 w-3.5 text-neutral-500"
        >
          <path d="M4 6l4 4 4-4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Sheet — rendered in a portal so it sits above everything */}
      {open &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Kind wechseln"
            className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center animate-fade-in"
          >
            {/* Backdrop */}
            <button
              type="button"
              aria-hidden="true"
              tabIndex={-1}
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-default"
            />

            {/* Panel */}
            <div className="relative w-full max-w-sm bg-neutral-900/95 border border-white/10 rounded-3xl p-4 shadow-2xl animate-pop">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-neutral-200">Kind wechseln</h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Schließen"
                  className="h-8 w-8 grid place-items-center rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-neutral-100 transition"
                >
                  ✕
                </button>
              </div>

              {/* Child list */}
              <div className="flex flex-col gap-1.5 mb-4">
                {children.map((c) => (
                  <div key={c.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSelect(c.id)}
                      className={`flex-1 min-h-12 rounded-2xl text-left px-4 text-base font-medium transition active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 ${
                        c.id === activeChild?.id
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white/5 text-neutral-200 hover:bg-white/10'
                      }`}
                    >
                      {c.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleManage(c)}
                      className="min-h-12 px-3 rounded-2xl bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-neutral-200 text-sm font-medium transition active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50"
                    >
                      Verwalten
                    </button>
                  </div>
                ))}
              </div>

              {/* Add / join actions */}
              <div className="flex flex-col gap-2 border-t border-white/8 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    onAddChild()
                    setOpen(false)
                  }}
                  className="min-h-12 rounded-2xl bg-indigo-600/15 text-indigo-400 hover:bg-indigo-600/25 text-sm font-semibold transition active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50"
                >
                  + Kind hinzufügen
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onAddChild()
                    setOpen(false)
                  }}
                  className="min-h-12 rounded-2xl bg-white/5 text-neutral-300 hover:bg-white/10 text-sm font-semibold transition active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50"
                >
                  Kind beitreten
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* ManageChild sheet — opens when a "Verwalten" button is clicked */}
      {managingChild && (
        <ManageChild
          child={managingChild}
          token={token}
          onClose={() => setManagingChild(null)}
          onChanged={() => {
            void refresh()
            setManagingChild(null)
          }}
        />
      )}
    </>
  )
}
