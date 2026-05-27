import { test, expect } from '@playwright/test'

test('did-io utilities work in browser', async ({ page }) => {
  await page.goto('/test/index.html')
  const result = await page.evaluate(async () => {
    const { parseDid } = await import('/src/index.ts')
    return parseDid({ did: 'did:v1:test:nym:abcd' }).prefix
  })
  expect(result).toBe('v1')
})
