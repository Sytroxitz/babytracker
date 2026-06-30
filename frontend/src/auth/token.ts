/**
 * Cheap structural check that a stored token is a well-formed JWT
 * (three non-empty base64url segments). Guards against corrupted/legacy values
 * in local storage that the backend rejects with "Invalid JWT Token" — those
 * would otherwise leave the user "logged in" with an unusable session.
 */
export function isWellFormedJwt(token: string): boolean {
  const parts = token.split('.')
  return parts.length === 3 && parts.every((p) => /^[A-Za-z0-9_-]+$/.test(p))
}
