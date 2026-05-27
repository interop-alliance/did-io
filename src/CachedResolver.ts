/*!
 * Copyright (c) 2021 Digital Bazaar, Inc. All rights reserved.
 */
import { parseDid } from './did-io.js'
import type { IKeyMap } from './did-io.js'
import { LruCache } from '@interop/lru-memoize'
import type {
  IDID,
  IDidDocument,
  IKeyPair,
  IPublicKey
} from '@digitalcredentials/ssi'
import type { KeyPair } from '@digitalcredentials/keypair'

export interface DidGenerationResult {
  didDocument: IDidDocument
  keyPairs: IKeyMap
  methodFor: ({ purpose }: { purpose: string }) => KeyPair
}

export interface DidMethodDriver {
  method: string

  computeId: (
    { keyPair }: { keyPair: KeyPair }
  ) => Promise<IDID>

  fromKeyPair: (
    { verificationKeyPair, keyAgreementKeyPair }:
    { verificationKeyPair?: KeyPair | IKeyPair, keyAgreementKeyPair?: KeyPair | IKeyPair }
  ) => DidGenerationResult

  generate: (
    options?: { [key: string]: unknown }
  ) => Promise<DidGenerationResult>

  get: (
    options: { did?: IDID | string, url?: string, [key: string]: unknown }
  ) => Promise<IDidDocument | IPublicKey>

  publicKeyToDidDoc: (
    { publicKeyDescription }: { publicKeyDescription: KeyPair | IKeyPair | IPublicKey }
  ) => Promise<IDidDocument>

  publicMethodFor: (
    { didDocument, purpose }: { didDocument: IDidDocument, purpose: string }
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
   * @returns {Promise<IDidDocument|IPublicKey>} Resolves with fetched DID
   *   Document or public key node.
   */
  async get (
    { did, url, ...getOptions }:
    { did?: IDID | string, url?: string, [key: string]: unknown }
  ): Promise<IDidDocument | IPublicKey> {
    const didOrUrl = did ?? url
    if (!didOrUrl) {
      throw new TypeError('A string "did" or "url" parameter is required.')
    }

    const method = this._methodForDid(didOrUrl)

    return this._cache.memoize<IDidDocument | IPublicKey>({
      key: didOrUrl,
      fn: async () => await method.get({ did: didOrUrl, ...getOptions })
    })
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
      throw new Error(`Driver for DID method "${method}" not found.`)
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
      throw new Error(`Driver for DID ${did} not found.`)
    }
    return method
  }
}
