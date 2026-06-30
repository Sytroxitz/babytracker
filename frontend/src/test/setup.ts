import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// `virtual:pwa-register` resolves to a stub via the alias in vitest.config.ts.

afterEach(() => cleanup())
