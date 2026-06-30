# Task C2 Report — Header Child-Switcher + „Kind verwalten" Sheet

## Status: DONE

---

## Files Created

| File | Purpose |
|------|---------|
| `frontend/src/ui/ChildSwitcher.tsx` | Trigger button + sheet portal + ManageChild mounting |
| `frontend/src/ui/ManageChild.tsx` | Full management sheet (edit, members, invite, delete/leave) |
| `frontend/src/ui/ChildSwitcher.test.tsx` | Verbatim test from brief |

---

## ChildSwitcher Structure

- **Props:** `{ token: string; onAddChild: () => void }`
- **Consumes:** `useChildren()` — `children`, `activeChild`, `setActiveChild`, `refresh`
- **Trigger button:** plain `<button>` whose text content is `activeChild?.name ?? 'Kind wählen'` — accessible name resolves to the child name, satisfying `getByRole('button', { name: /Mia/ })`. SVG chevron has `aria-hidden="true"` so it does not pollute the name.
- **Sheet:** rendered via `createPortal(…, document.body)` matching the ConfirmDialog pattern. Opens on trigger click; closes via backdrop button or the ✕ close button.
- **Children list:** maps `children` array — each child gets a flex row with:
  - A `<button>` whose text is `c.name` (accessible name = child name) → calls `handleSelect(c.id)` which calls `void setActiveChild(id)` (fire-and-forget, no awaited promise in the click handler) then `setOpen(false)`.
  - A `"Verwalten"` button → calls `handleManage(child)` which sets `managingChild` state and closes the sheet.
- **Add / join buttons:** "Kind hinzufügen" and "Kind beitreten" both call `onAddChild()` then close the sheet.
- **ManageChild mounting:** rendered outside the portal when `managingChild !== null`; `onChanged` calls `void refresh()` then clears `managingChild`.

## ManageChild Structure

- **Props:** `{ child: Child; token: string; onClose: () => void; onChanged: () => void }`
- Renders in a `createPortal` (centered, fixed, backdrop, animate-pop) matching ConfirmDialog styling.

### Edit Form
- Controlled fields: `name`, `gender`, `birthDate`, `birthWeightGrams` — all pre-filled from `child` prop.
- Save handler: `patchChild(token, child.id, patch)` → `db.children.put(res.child)` → `onChanged()`. Errors shown in a red banner; `saving` state drives the Button `loading` spinner.

### Members Section
- Maps `child.members` — shows email + role (`Mama` / `Papa`). Only rendered when `members.length > 0`.

### Partner einladen (Invite)
- `handleInvite()` calls `createInvitation(token, child.id)` and stores `inviteCode` + `inviteExpiry` in state.
- When a code exists, shows a monospace code block with a **Kopieren** button and a **Neu generieren** button for regeneration.
- Copy: guarded by `if (navigator.clipboard)` before calling `writeText` — falls back silently in environments where clipboard is unavailable (e.g. non-secure contexts, jsdom tests).
- `copied` state shows "Kopiert ✓" for 2 s then resets.
- `inviteExpiry` is formatted with `toLocaleDateString('de-DE')`.

### Kind löschen / Kind verlassen
- Both trigger `ConfirmDialog` (via local boolean state `confirmDelete` / `confirmLeave`).
- Delete: `deleteChild(token, child.id)` → `db.children.delete(child.id)` → `onChanged()` + `onClose()`.
- Leave: `leaveChild(token, child.id)` → `db.children.delete(child.id)` → `onChanged()` + `onClose()`.
- Errors caught and displayed in the red banner; no swallowed silent failures.

### ConfirmDialog nesting
- ConfirmDialog renders into `document.body` via its own portal (z-50), so it correctly overlays ManageChild's own sheet (also z-50). Both portals sit in the same stacking context — the ConfirmDialog portal is appended later, so it paints on top.

---

## Error Handling on Mutations

All four mutation handlers (`handleSave`, `handleInvite`, `handleDelete`, `handleLeave`) follow the same pattern:
```
setError(null)
try { await mutation(); ...local db update; onChanged() }
catch (e) { setError(e instanceof Error ? e.message : 'Fehler ...') }
finally { setBusy(false) }
```
No errors are swallowed silently. The `void` keyword is only used at the call site in event handlers (standard fire-and-forget pattern for async handler functions); errors still surface via the catch block inside those async functions.

---

## TDD Evidence

1. **Step 1 — failing test written:** `ChildSwitcher.test.tsx` created (verbatim from brief).
2. **Step 2 — confirmed red:**
   ```
   FAIL src/ui/ChildSwitcher.test.tsx
   Error: Failed to resolve import "./ChildSwitcher" from "src/ui/ChildSwitcher.test.tsx". Does the file exist?
   ```
3. **Step 3 — implementation written:** `ChildSwitcher.tsx` + `ManageChild.tsx`.
4. **Step 4 — confirmed green:**
   ```
   ✓ src/ui/ChildSwitcher.test.tsx > shows active child name and lists children to switch 102ms
   Test Files  1 passed (1)
        Tests  1 passed (1)
   Duration  1.98s
   ```
   Output pristine — no `act()` warnings, no console noise.

---

## Focused Test Result

```
✓ src/ui/ChildSwitcher.test.tsx > shows active child name and lists children to switch 102ms
Test Files  1 passed (1)  /  Tests  1 passed (1)
```

---

## Accessible Names — Self-Review

| Element | Accessible name strategy | Test assertion |
|---------|--------------------------|----------------|
| Trigger button | Text content = `activeChild.name` ("Mia") | `getByRole('button', { name: /Mia/ })` ✓ |
| Child list button | Text content = `c.name` ("Tom") | `getByRole('button', { name: /Tom/ })` ✓ |
| SVG chevron | `aria-hidden="true"` — excluded from name computation | — |

---

## Concerns

None. The implementation is complete and the focused test is green and pristine. Clipboard guard is in place. `db.children.delete` uses Dexie's primary-key delete (string ID) which is the correct API. The ConfirmDialog portal-in-portal layering relies on DOM append order (later = on top), which is standard and correct for same-`z-index` portals in jsdom and browsers.

---

## Commit

```
cad3162 feat(frontend): header child switcher + manage child sheet
```

Branch: `feat/multi-child-sharing`

---

## Fix C2: danger-zone busy guard + ManageChild test

### Guards added

- Added `const [deleting, setDeleting] = useState(false)` and `const [leaving, setLeaving] = useState(false)`.
- `handleDelete`: early-return guard `if (deleting) return`, `setDeleting(true)` before first await, reset in `finally`.
- `handleLeave`: same pattern with `leaving` / `setLeaving`.
- "Kind löschen" button: `disabled={deleting}` (also adds `disabled:opacity-50 disabled:cursor-not-allowed` CSS).
- "Kind verlassen" button: `disabled={leaving}` (same CSS).

### Minor — role label

Replaced `m.role === 'mama' ? 'Mama' : 'Papa'` with `const ROLE_LABEL: Record<string, string> = { mama: 'Mama', papa: 'Papa' }` (defined at module scope) and renders `{ROLE_LABEL[m.role] ?? m.role}`.

### Minor — clipboard failure

`handleCopy` catch block now calls `setError('Kopieren fehlgeschlagen')` instead of silently swallowing the error. The existing `if (navigator.clipboard)` guard is retained.

### New test — ManageChild.test.tsx

Two focused tests covering the riskiest path:

1. **delete confirm flow**: clicks "Kind löschen" → ConfirmDialog appears → clicks "Löschen" → asserts `api.deleteChild` called with `('t1', child.id)` and `onChanged` fired.
2. **busy guard / double-delete prevention**: uses a deferred promise for `deleteChild`; after confirm, asserts the trigger button has `disabled` attribute (proving the dialog cannot be reopened for a second call); resolves the promise and asserts `deleteChild` called exactly once.

### Focused test results

```
✓ src/ui/ManageChild.test.tsx > ManageChild > delete confirm flow calls deleteChild and onChanged fires on success 133ms
✓ src/ui/ManageChild.test.tsx > ManageChild > trigger button is disabled while delete is in flight (prevents double-delete) 47ms
Test Files  1 passed (1)  /  Tests  2 passed (2)  — output pristine

✓ src/ui/ChildSwitcher.test.tsx > shows active child name and lists children to switch 117ms
Test Files  1 passed (1)  /  Tests  1 passed (1)  — no regressions
```

### Commit

```
50654bd fix(frontend): busy guard on delete/leave + role label + clipboard feedback + ManageChild test
```
