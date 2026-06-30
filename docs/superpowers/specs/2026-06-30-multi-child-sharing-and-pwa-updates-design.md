# Mehrkind-Unterstützung, Partner-Sharing & PWA-Updates — Design

**Datum:** 2026-06-30
**Status:** Genehmigt, bereit für Implementierungsplan

## Ziel

Die BabyTracker-App von einem reinen Einzelnutzer-Tracker zu einem
kind-zentrierten, teilbaren Tracker umbauen:

1. Beim ersten Start legt man ein **Kind** an (Name, Geschlecht, Geburtsdatum,
   Geburtsgewicht) und gibt die **eigene Rolle** (Mama/Papa) an.
2. **Mehrere Kinder** möglich; man kann zwischen ihnen **wechseln**. Alle
   Einträge (Stillen/Pumpen/Flasche/Gewicht) sind **pro Kind getrennt**.
3. Den **Partner einladen**, damit er dasselbe Kind sieht und gleichberechtigt
   pflegt.
4. Pro Eintrag ist sichtbar, **wer** ihn erstellt hat (Mama/Papa).
5. **Versionierung + erzwingbares PWA-Update**, das auch hartnäckiges
   iOS-Caching durchbricht.

## Getroffene Entscheidungen (aus dem Brainstorming)

- **Bestandsdaten:** Noch nicht deployed, nur Testdaten → **saubere Migration**,
  kein Erhalt nötig.
- **Einladung:** **Einladungs-Code** (kein E-Mail-Versand). Code teilen
  (WhatsApp etc.), Partner gibt ihn unter „Kind beitreten" ein.
- **Rechte:** **Beide gleichberechtigt** — sehen/anlegen/bearbeiten/löschen aller
  Einträge, Kind-Infos bearbeiten, weitere Personen einladen, Kind löschen.
- **Urheber:** Jeder Eintrag merkt sich den Ersteller und zeigt Mama/Papa-Label.
- **Kind-Wechsel:** **Umschalter oben im Header**, zeigt aktiven Kindnamen.

## Wertebereiche

- `gender`: `male | female | diverse` → UI „Junge / Mädchen / Divers".
- `role`: `mama | papa` (gespeichert als String; bei Bedarf später erweiterbar).

---

## 1. Datenmodell (Backend, Symfony/Doctrine)

### Neue Entität `Child`
- `id` (uuid)
- `name` (string)
- `gender` (string: `male|female|diverse`)
- `birthDate` (date)
- `birthWeightGrams` (int, nullable)
- `syncCounter` (bigint, default 0) — **monotone Änderungs-Sequenz pro Kind**
  (wandert vom `User` hierher)
- `createdAt` (datetime_immutable)
- `deletedAt` (datetime_immutable, nullable) — Soft-Delete

### Neue Entität `ChildMembership` (User ↔ Child, n:m)
- `id` (uuid)
- `child` (ManyToOne Child, not null)
- `user` (ManyToOne User, not null)
- `role` (string: `mama|papa`)
- `createdAt`
- **Unique(child, user)** — ein User pro Kind nur einmal Mitglied.

### Neue Entität `Invitation`
- `id` (uuid)
- `child` (ManyToOne Child, not null)
- `code` (string, unique, kurz & gut teilbar — z.B. 8 Zeichen Base32, keine
  verwechselbaren Zeichen)
- `createdBy` (ManyToOne User)
- `createdAt`
- `expiresAt` (datetime_immutable, nullable) — **24 Stunden** ab Erstellung
- `usedAt` (datetime_immutable, nullable), `usedBy` (ManyToOne User, nullable)
- **Einmal-Code**: nach Beitritt verbraucht; ein neuer Code ist generierbar.

### Logs (`NursingLog`, `PumpingLog`, `BottleLog`, `WeightLog`)
Über `SyncableTrait`:
- Scope-Feld `user` → **`child`** (ManyToOne Child, not null). Der Sync-Bereich
  ist jetzt das Kind, nicht der User.
- Neu: **`createdBy`** (ManyToOne User, nullable). Wird **serverseitig** beim
  ersten Anlegen aus dem JWT-User gesetzt und danach **nicht** mehr geändert
  (ehrliche Urheber-Anzeige; Client-Wert wird beim Insert ignoriert).
- `serverSeq` jetzt **pro Kind** eindeutig: Unique(child_id, server_seq) statt
  (user_id, server_seq).

### Migration
Eine Doctrine-Migration: neue Tabellen `child`, `child_membership`,
`invitation`; Logs-Tabellen um `child_id` + `created_by_id` erweitern, alte
`user_id`-Spalte/Constraint entfernen, Unique-Constraint auf
(child_id, server_seq) umstellen; `app_user.sync_counter` entfernen. Da keine
Bestandsdaten erhalten werden müssen, darf die Migration vorhandene Test-Logs
verwerfen.

---

## 2. Sync-Umbau (Kern)

**Heute:** `User.syncCounter` ist der globale Cursor; Logs hängen am `user`;
Client führt einen einzelnen `cursor` in Meta.

**Neu:** Der Cursor wird **pro Kind** geführt.

### Server (`SyncService`)
- Request-Payload: `{ cursors: { [childId]: number }, changes: [...] }`.
  Jede Änderung trägt ihre `childId`.
- Beim Anwenden: Für jede Änderung **prüfen, dass der User Mitglied des
  betroffenen Kindes ist** (sonst überspringen → keine Fremd-Kind-Schreibrechte).
  `createdBy` beim Neuanlegen = authentifizierter User. `serverSeq` aus dem
  **Kind**-Zähler (`Child.bumpSyncCounter()`), pessimistisches Lock auf dem Kind.
- Response: `{ cursors, changes, children }`
  - `cursors`: pro zugänglichem Kind der aktuelle Zählerstand.
  - `changes`: alle Logs über alle zugänglichen Kinder mit `serverSeq >
    cursors[childId]` (pro Kind gefiltert), inkl. `childId` und `createdById`.
  - `children`: **autoritative Liste** aller Kinder, bei denen der User Mitglied
    ist — je Kind die Stammdaten **und** die Mitglieder (`userId`, `role`,
    `email`/Anzeigename). So lernt der Client neue Kinder, Partner-Rollen und
    aktualisierte Kind-Infos. Ein frisch beigetretenes Kind hat clientseitig
    Cursor 0 → `pullSince(child, 0)` liefert die **gesamte Historie**.

### Auth-Response
`POST /api/register` und `/api/login` liefern künftig `{ token, userId }`. Der
Client speichert `userId` in Meta (`myUserId`) für die lokale Urheber-Zuordnung.

---

## 3. API (neue Endpunkte)

- `POST /api/children` — Body: `name, gender, birthDate, birthWeightGrams, role`.
  Legt Kind + eigene Membership (mit Rolle) an. Antwort: Kind inkl. Mitglieder.
- `PATCH /api/children/{id}` — Kind-Infos bearbeiten (jedes Mitglied; gleiche
  Rechte).
- `DELETE /api/children/{id}` — Soft-Delete (jedes Mitglied).
- `POST /api/children/{id}/invitations` — erzeugt/erneuert Einladungs-Code,
  liefert `{ code, expiresAt }`.
- `POST /api/invitations/{code}/accept` — Body: `role`. Fügt aktuellen User als
  Mitglied hinzu (Validierung: Code existiert, nicht abgelaufen, nicht
  verbraucht, User noch nicht Mitglied). Antwort: Kind inkl. Mitglieder.
- `DELETE /api/children/{id}/members/me` — Kind verlassen (entfernt eigene
  Membership). Lokale Daten des Kindes werden clientseitig entfernt.
- Reines **Lesen** der Kinder/Mitglieder läuft sonst über die Sync-Response;
  ein separates `GET /api/children` ist optional (z.B. für initialen Load vor
  dem ersten Sync) und kann dieselbe `children`-Struktur liefern.

Alle Endpunkte erfordern JWT; Mitgliedschaft wird serverseitig geprüft.

---

## 4. Client (Dexie + UI)

### Dexie-Schema (neue Version)
- Neue Tabelle **`children`**: `{ id, name, gender, birthDate, birthWeightGrams,
  createdAt, deletedAt, members: [{ userId, role, displayName }] }`
  (Members denormalisiert eingebettet — der lokale Store ist ein Cache).
- **`logs`** erhält Felder `childId` und `createdByUserId`; neuer Index
  `[childId+occurredAt]` für effizientes Filtern/Sortieren pro Kind.
- **Meta**: `activeChildId`, `cursors` (Map `childId→seq`, ersetzt einzelnes
  `cursor`), `myUserId`.

### Cross-Account-Guard (`account.ts`)
Beim Wechsel auf einen anderen Account zusätzlich `children` leeren und
`cursors`/`activeChildId` zurücksetzen (analog zur bestehenden Logs-Bereinigung).

### Sync-Client (`syncEngine.ts`)
- Liest `cursors`-Map; sendet alle dirty Logs (inkl. `childId`) + `cursors`.
- Antwort: Logs mergen (Last-Write-Wins wie bisher, aber Schlüssel bleibt `id`),
  `cursors` je Kind aktualisieren, `children`-Tabelle aus `children` der Antwort
  überschreiben. Verlassene/entfernte Kinder lokal bereinigen.

### Onboarding-Wizard (bei 0 Kindern)
Vollbild-Flow nach Login, wenn der User noch kein Kind hat:
- **Kind anlegen**: Name, Geschlecht (Junge/Mädchen/Divers), Geburtsdatum,
  Geburtsgewicht + eigene Rolle (Mama/Papa) → `POST /api/children`.
- Alternative **„Ich wurde eingeladen"**: Code eingeben →
  `POST /api/invitations/{code}/accept` (Rolle wählen) → beitreten.
Erst nach erfolgreichem Anlegen/Beitreten erscheint die Haupt-App.

### Header-Umschalter
- Im Header (ersetzt den statischen Titelbereich) ein Button mit dem
  **aktiven Kindnamen** (dezent bei nur einem Kind).
- Tippen öffnet ein **Auswahl-Sheet**: Liste der Kinder (Wechsel setzt
  `activeChildId`), „Kind hinzufügen", „Kind beitreten", „Verwalten".

### „Kind verwalten"-Sheet
- Kind-Infos bearbeiten (`PATCH`), Mitglieder + Rollen anzeigen.
- **„Partner einladen"** → `POST .../invitations` → Code anzeigen (Kopieren/
  Teilen, neu erzeugen).
- **Kind löschen** (`DELETE`).
- **„Kind verlassen"** (`DELETE .../members/me`).

### Views filtern nach aktivem Kind
- `repository.ts`-Queries bekommen einen `childId`-Parameter; QuickEntry,
  Timeline, Stats, Weight zeigen nur Einträge von `activeChildId`.
- Neue Einträge: `childId = activeChildId`, `createdByUserId = myUserId`.
- **Timeline**: kleines „Mama"/„Papa"-Label aus `createdByUserId` → Rolle des
  Mitglieds (Lookup über `children.members`).

---

## 5. Versionierung + erzwingbares PWA-Update

### Automatische Versionsnummer (kein manuelles Hochzählen)
- Vite injiziert beim Build `__APP_VERSION__` aus **Git**:
  - Build-Nummer = `git rev-list --count HEAD` (monoton steigend, z.B. `143`)
  - Short-SHA = `git rev-parse --short HEAD`
  - Commit-Datum = `git log -1 --format=%cI`
  - Anzeige: **„Version 143 · a1b2c3d · 30.06.2026"**.
  - **Fallback** (kein Git verfügbar, z.B. CI-Tarball): `package.json`-Version +
    Build-Timestamp. Build darf nie an fehlendem Git scheitern.
- Zusätzlich wird **`version.json`** (`{ version, builtAt }`) ins Build-Root
  geschrieben. Die App pollt sie **network-first** → kennt die **neueste
  verfügbare** Version (Nummer fürs Banner), unabhängig vom SW-Timing.

### Hartes Update-Verhalten (gegen iOS-Caching)
- Kontrollierter Flow über `virtual:pwa-register`:
  `registerSW({ onNeedRefresh, onRegisteredSW })`.
- Workbox: `skipWaiting: true`, `clientsClaim: true`,
  `cleanupOutdatedCaches: true` → neuer SW übernimmt sofort, alte Caches weg.
- **Periodische Update-Checks**: `registration.update()` in einem Intervall
  **und** bei `visibilitychange`/`focus` — genau die Momente, die iOS-PWAs sonst
  verschlafen.

### UI
- **Update-Banner** (Stil wie das bestehende „Sitzung abgelaufen"-Banner):
  „Neue Version verfügbar (145) – jetzt aktualisieren" → Button ruft
  `updateServiceWorker(true)` (skipWaiting + Reload).
- **„Nach Updates suchen"-Button** in „Verwalten"/Einstellungen, mit Anzeige der
  aktuellen Version. **Harter Reset** als Notnagel: alle Caches via
  `caches.keys()` löschen → `location.reload()`.

---

## 6. Tests

### Backend
- `SyncService`: pro-Kind-Cursor korrekt; **Membership-Isolation** (kein
  Schreib-/Lesezugriff auf fremde Kinder); `createdBy` wird gesetzt und nicht
  überschrieben; neuer Member zieht volle Historie (Cursor 0).
- Child-CRUD: Anlegen erzeugt Membership mit Rolle; PATCH/DELETE durch jedes
  Mitglied erlaubt, durch Nicht-Mitglied verboten.
- Invitation: Code erzeugen; `accept` fügt Membership hinzu; abgelaufener/
  verbrauchter/ungültiger Code wird abgelehnt; Doppel-Beitritt verhindert.
- Auth-Response enthält `userId`.

### Frontend
- per-Kind-Cursor-Merge (`syncEngine`): mehrere Kinder, getrennte Cursor.
- Kind-Wechsel filtert Einträge korrekt (`repository`/Views).
- Onboarding-Gate: 0 Kinder → Wizard; nach Anlegen → App.
- Beitritt über Code zieht Historie; Urheber-Label zeigt korrekte Rolle.
- Cross-Account-Guard leert auch `children`/`cursors`.
- Version-String aus Git-Werten inkl. Fallback; `onNeedRefresh` schaltet
  Banner-State; Update-Button löst `updateServiceWorker` aus;
  `version.json`-Vergleich erkennt „neuer verfügbar".

---

## Implementierungs-Reihenfolge (grob)

1. Backend-Entitäten (`Child`, `ChildMembership`, `Invitation`) + Logs-Umbau +
   Migration.
2. Sync-Umbau (`SyncService`, pro-Kind-Cursor, Membership-Prüfung, `children`
   in Response) + Auth-Response `userId`.
3. Child-/Invitation-API-Endpunkte.
4. Client-Datenmodell (Dexie-Version, Meta, Cross-Account-Guard) + Sync-Client.
5. Onboarding-Wizard + Header-Umschalter + „Kind verwalten"-Sheet.
6. View-Filterung nach `activeChildId` + Urheber-Label.
7. Versionierung + PWA-Update (Vite-Inject, version.json, SW-Flow, Banner,
   Update-Button).

Die Schritte 1–6 hängen eng zusammen (die Scope-Änderung zieht sich durch
Backend, Sync und alle Views); Schritt 7 ist davon unabhängig und könnte auch
separat umgesetzt werden.
