import { expect, test } from 'vitest'
import { isWellFormedJwt } from './token'

test('accepts a three-segment base64url token', () => {
  expect(isWellFormedJwt('eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhQGIuYyJ9.aB-_cD0123')).toBe(true)
})

test('rejects malformed tokens (the real corruption cases)', () => {
  expect(isWellFormedJwt('')).toBe(false)
  expect(isWellFormedJwt('not.a')).toBe(false)            // only two segments
  expect(isWellFormedJwt('"eyJ.abc.def"')).toBe(false)    // stray quotes → invalid base64url
  expect(isWellFormedJwt('eyJ.ab c.def')).toBe(false)     // whitespace
  expect(isWellFormedJwt('eyJ.ab+c/d.def')).toBe(false)   // standard base64, not base64url
  expect(isWellFormedJwt('a..b')).toBe(false)             // empty segment
})
