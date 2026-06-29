export function nowIso(): string {
  return new Date().toISOString()
}

/** True, wenn a zeitlich strikt nach b liegt. Parst beide (Z vs +00:00-sicher). */
export function isAfter(a: string, b: string): boolean {
  return Date.parse(a) > Date.parse(b)
}
