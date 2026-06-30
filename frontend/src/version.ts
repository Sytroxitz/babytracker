declare const __APP_VERSION__: string
declare const __APP_BUILD__: number

/** Human-readable build string. Falls back to the short SHA when no build count. */
export function buildVersionString(p: { build: number; sha: string; date: string }): string {
  const b = p.build > 0 ? String(p.build) : p.sha
  return `Version ${b} · ${p.sha} · ${p.date}`
}

export const APP_VERSION: string =
  typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'Version dev'
export const APP_BUILD: number =
  typeof __APP_BUILD__ === 'number' ? __APP_BUILD__ : 0
