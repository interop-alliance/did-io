/*!
 * Copyright (c) 2021 Digital Bazaar, Inc. All rights reserved.
 */
import { parseDid } from './did-io.js'
import type { IKeyMap } from './did-io.js'
import { LruCache } from '@interop/lru-memoize'
import { DIDResolutionError } from '@interop/data-integrity-core'
import type {
  AbstractKeyPair,
  IDID,
  IDIDDocument,
  IDIDResolutionOptions,
  IDIDResolutionResult,
  IKeyPair,
  IPublicKey
} from '@interop/data-integrity-core'

export interface DidGenerationResult {
  didDocument: IDIDDocument
  keyPairs: IKeyMap
  methodFor: ({ purpose }: { purpose: string }) => AbstractKeyPair
}

export interface DidMethodDriver {
  method: string

  fromKeyPair: (
    { verificationKeyPair, keyAgreementKeyPair }:
    { verificationKeyPair?: AbstractKeyPair | IKeyPair, keyAgreementKeyPair?: AbstractKeyPair | IKeyPair }
  ) => Promise<DidGenerationResult>

  generate: (
    options?: { [key: string]: unknown }
  ) => Promise<DidGenerationResult>

  get: (
    options: { did?: IDID | string, url?: string, [key: string]: unknown }
  ) => Promise<IDIDDocument | IPublicKey>

  /**
   * Optional spec-shaped resolution: returns a DID Resolution Result envelope
   * (`didDocument` + `didResolutionMetadata` + `didDocumentMetadata`) instead
   * of throwing on resolution failure. Drivers that do not implement it are
   * adapted from `get()` by `CachedResolver.resolveDID()`.
   */
  resolveDID?: (
    options: { did: IDID | string } & IDIDResolutionOptions
  ) => Promise<IDIDResolutionResult>

  publicKeyToDidDoc: (
    { publicKeyDescription }: { publicKeyDescription: AbstractKeyPair | IKeyPair | IPublicKey }
  ) => Promise<{ didDocument: IDIDDocument }>

  publicMethodFor: (
    { didDocument, purpose }: { didDocument: IDIDDocument, purpose: string }
  ) => IPublicKey
}

export interface CachedResolverOptions {
  max?: number
  ttl?: number
  updateAgeOnGet?: boolean
  cache?: { memoize: LruCache['memoize'] }
  [key: string]: unknown
}

export class CachedResolver {
  _cache: { memoize: LruCache['memoize'] }
  _methods: Map<string, DidMethodDriver>
  /**
   * @param {object} [options={}] - Options hashmap.
   * @param {number} [options.max=100] - Max number of items in the cache.
   * @param {number} [options.ttl=5000] - Max age of a cache item, in ms.
   * @param {boolean} [options.updateAgeOnGet=false] - When using time-expiring
   *   entries with `ttl`, setting this to true will make each entry's
   *   effective time update to the current time whenever it is retrieved from
   *   cache, thereby extending the expiration date of the entry.
   * @param {object} [options.cache] - A custom cache instance to use instead of
   *   creating a default `LruCache`. Must implement `memoize({ key, fn })`.
   *   Useful when the app already has an `LruCache` configured with custom
   *   settings, or uses a different compatible cache implementation.
   * @param {object} [options.cacheOptions] - Additional `lru-cache` options.
   */
  constructor ({
    max = 100, ttl = 5000, updateAgeOnGet = false, cache,
    ...cacheOptions
  }: CachedResolverOptions = {}) {
    this._cache = cache ?? new LruCache(
      { max, ttl, updateAgeOnGet, ...cacheOptions } as
        ConstructorParameters<typeof LruCache>[0]
    )
    this._methods = new Map()
  }

  use (driver: DidMethodDriver): void {
    this._methods.set(driver.method, driver)
  }

  /**
   * Gets the DID Document, by selecting a registered driver based on the DID
   * prefix (DID method).
   * Either `did` or `url` param is required.
   *
   * @param {object} options - Options hashmap.
   * @param {string} [options.did] - DID uri.
   * @param {string} [options.url] - Typically, a key ID or other DID-related
   *   url. This is used to improve code readability.
   * @param {object} [options.getOptions] - Options passed through to the
   *   driver's get() operation.
   *
   * @returns {Promise<IDIDDocument|IPublicKey>} Resolves with fetched DID
   *   Document or public key node.
   */
  async get (
    { did, url, ...getOptions }:
    { did?: IDID | string, url?: string, [key: string]: unknown }
  ): Promise<IDIDDocument | IPublicKey> {
    const didOrUrl = did ?? url
    if (!didOrUrl) {
      throw new TypeError('A string "did" or "url" parameter is required.')
    }

    const method = this._methodForDid(didOrUrl)

    return this._cache.memoize<IDIDDocument | IPublicKey>({
      key: didOrUrl,
      fn: async () => await method.get({ did: didOrUrl, ...getOptions })
    })
  }

  /**
   * Resolves a DID to a DID Resolution Result envelope, per the DID
   * Resolution spec: resolution failures are reported on
   * `didResolutionMetadata.error` (with RFC 9457 `problemDetails` where
   * available) rather than thrown. Only a missing `did` argument (a
   * programmer error, not a resolution failure) throws.
   *
   * Delegates to the driver's own `resolveDID()` when implemented (memoized
   * under a `resolveDID:` cache key -- note this caches error envelopes for
   * the cache ttl, unlike `get()`, whose rejections are not cached).
   * Otherwise adapts the driver's throw-based `get()`: a thrown
   * `DIDResolutionError` maps to its `code`/`problemDetails`, and any other
   * error is classified `internalError`.
   *
   * @param {object} options - Options hashmap.
   * @param {string} options.did - DID uri (bare DID, no fragment).
   *   Remaining properties are DID resolution options passed to the driver.
   *
   * @returns {Promise<IDIDResolutionResult>} Resolves with the resolution
   *   result envelope; on failure, `didDocument` is `null` and the reason is
   *   in `didResolutionMetadata`.
   */
  async resolveDID (
    { did, ...options }: { did: IDID | string } & IDIDResolutionOptions
  ): Promise<IDIDResolutionResult> {
    if (!did) {
      throw new TypeError('A string "did" parameter is required.')
    }
    let driver: DidMethodDriver
    try {
      driver = this._methodForDid(did)
    } catch (cause) {
      return new DIDResolutionError(`Driver for DID ${did} not found.`, {
        code: 'methodNotSupported',
        problemDetails: {
          type: 'https://www.w3.org/ns/did#METHOD_NOT_SUPPORTED',
          title: 'The DID method is not supported.',
          detail: `Driver for DID ${did} not found.`
        },
        cause
      }).toResolutionResult()
    }
    const { resolveDID } = driver
    if (resolveDID) {
      return this._cache.memoize<IDIDResolutionResult>({
        key: `resolveDID:${did}`,
        fn: async () => await resolveDID.call(driver, { did, ...options })
      })
    }
    try {
      const didDocument = await this.get({ did, ...options }) as IDIDDocument
      return {
        didResolutionMetadata: {},
        didDocument,
        didDocumentMetadata: {}
      }
    } catch (cause) {
      if (cause instanceof DIDResolutionError) {
        return cause.toResolutionResult()
      }
      const detail = cause instanceof Error ? cause.message : String(cause)
      return new DIDResolutionError(detail, {
        code: 'internalError',
        problemDetails: {
          type: 'https://www.w3.org/ns/did#INTERNAL_ERROR',
          title: 'An internal error occurred during resolution.',
          detail
        },
        cause
      }).toResolutionResult()
    }
  }

  /**
   * Generates a new DID Document and corresponding keys, by selecting a
   * registered driver based on the DID method name.
   *
   * @param {object} options - Options hashmap.
   * @param {string} options.method - DID method id (e.g. 'key', 'v1', 'web').
   * @param {object} [options.args] - Options passed through to the DID driver.
   *
   * @returns {Promise<DidGenerationResult>}
   */
  async generate (
    { method, ...args }: { method: string, [key: string]: unknown }
  ): Promise<DidGenerationResult> {
    const driver = this._methods.get(method)
    if (!driver) {
      const err = new Error(`Driver for DID method "${method}" not found.`)
      err.name = 'NotSupportedError'
      throw err
    }
    return driver.generate(args)
  }

  /**
   * @param {string} did - DID uri.
   *
   * @returns {DidMethodDriver} - DID Method driver.
   * @private
   */
  _methodForDid (did: IDID | string): DidMethodDriver {
    const { prefix } = parseDid({ did })
    const method = this._methods.get(prefix)
    if (!method) {
      const err = new Error(`Driver for DID ${did} not found.`)
      err.name = 'NotSupportedError'
      throw err
    }
    return method
  }
}
