/*!
 * Copyright (c) 2021 Digital Bazaar, Inc. All rights reserved.
 */
import { describe, it, beforeEach, expect, vi } from 'vitest'
import type { IDidDocument } from '@interop/data-integrity-core'

import { CachedResolver } from '../../src/index.js'
import type { DidMethodDriver } from '../../src/index.js'

const MOCK_DID = 'did:ex:1234'
const MOCK_DID_DOCUMENT = { id: MOCK_DID } as unknown as IDidDocument

function makeDriver (method = 'ex'): DidMethodDriver {
  return {
    method,
    computeId: vi.fn(),
    fromKeyPair: vi.fn(),
    generate: vi.fn(async () => ({
      didDocument: MOCK_DID_DOCUMENT,
      keyPairs: new Map(),
      methodFor: vi.fn()
    })),
    get: vi.fn(async () => MOCK_DID_DOCUMENT),
    publicKeyToDidDoc: vi.fn(),
    publicMethodFor: vi.fn()
  } as unknown as DidMethodDriver
}

function cacheOptions (resolver: CachedResolver): { ttl: number, max: number } {
  return (resolver._cache as unknown as {
    options: { ttl: number, max: number }
  }).options
}

describe('CachedResolver', () => {
  describe('constructor', () => {
    it('should default the cache ttl', () => {
      const resolver = new CachedResolver()
      expect(cacheOptions(resolver).ttl).toBe(5000)
    })

    it('should use an explicit ttl', () => {
      const resolver = new CachedResolver({ ttl: 60000 })
      expect(cacheOptions(resolver).ttl).toBe(60000)
    })

    it('should use an explicit max', () => {
      const resolver = new CachedResolver({ max: 50 })
      expect(cacheOptions(resolver).max).toBe(50)
    })

    it('should use an injected custom cache', () => {
      const cache = { memoize: vi.fn() }
      const resolver = new CachedResolver({ cache })
      expect(resolver._cache).toBe(cache)
    })
  })

  describe('use()', () => {
    it('should register a driver by method name', () => {
      const resolver = new CachedResolver()
      const driver = makeDriver('ex')
      resolver.use(driver)
      expect(resolver._methods.get('ex')).toBe(driver)
    })
  })

  describe('get()', () => {
    let resolver: CachedResolver
    let driver: DidMethodDriver

    beforeEach(() => {
      resolver = new CachedResolver()
      driver = makeDriver('ex')
      resolver.use(driver)
    })

    it('should resolve via the registered driver', async () => {
      const result = await resolver.get({ did: MOCK_DID })
      expect(result).toEqual(MOCK_DID_DOCUMENT)
      expect(driver.get).toHaveBeenCalledOnce()
    })

    it('should accept a url alias for did', async () => {
      const result = await resolver.get({ url: MOCK_DID })
      expect(result).toEqual(MOCK_DID_DOCUMENT)
    })

    it('should return the cached result on a second call', async () => {
      await resolver.get({ did: MOCK_DID })
      await resolver.get({ did: MOCK_DID })
      expect(driver.get).toHaveBeenCalledOnce()
    })

    it('should throw if neither did nor url is given', async () => {
      await expect(resolver.get({})).rejects.toThrow(TypeError)
    })

    it('should throw if no driver is registered for the method', async () => {
      await expect(resolver.get({ did: 'did:nope:1234' }))
        .rejects.toThrow(/not found/)
    })
  })

  describe('generate()', () => {
    it('should delegate to the registered driver', async () => {
      const resolver = new CachedResolver()
      const driver = makeDriver('ex')
      resolver.use(driver)

      const result = await resolver.generate({ method: 'ex', keyType: 'k' })
      expect(result.didDocument).toEqual(MOCK_DID_DOCUMENT)
      expect(driver.generate).toHaveBeenCalledWith({ keyType: 'k' })
    })

    it('should throw if no driver is registered for the method', async () => {
      const resolver = new CachedResolver()
      await expect(resolver.generate({ method: 'nope' }))
        .rejects.toThrow(/not found/)
    })
  })
})
