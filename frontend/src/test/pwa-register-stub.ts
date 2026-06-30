// Test stub for the `virtual:pwa-register` module (provided by vite-plugin-pwa
// only during dev/build). Aliased in vitest.config.ts so modules importing it
// resolve under Vitest.
export function registerSW(
  _options?: unknown,
): (reloadPage?: boolean) => Promise<void> {
  return async () => {}
}
