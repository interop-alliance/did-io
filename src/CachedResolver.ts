/*!
 * Copyright (c) 2021 Digital Bazaar, Inc. All rights reserved.
 */
import { parseDid, IKeyMap } from './did-io.js'
import { LruCache } from '@digitalcredentials/lru-memoize'
import { IDID, IDidDocument, IKeyPair, IPublicKey } from '@digitalcredentials/ssi'

export interface DidGenerationResult {
  didDocument: IDidDocument
  keyPairs: IKeyMap
  methodFor: ({ purpose }: { purpose: string }) => IKeyPair
}

export interface DidMethodDriver {
  computeId: (
    { keyPair }: { keyPair: IKeyPair }
  ) => Promise<IDID>

  fromKeyPair: (
    { verificationKeyPair, keyAgreementKeyPair }:
    { verificationKeyPair?: IKeyPair, keyAgreementKeyPair?: IKeyPair }
  ) => DidGenerationResult

  get: (
    { did, url }: { did?: IDID, url?: string }
  ) => IDidDocument | IPublicKey

  publicKeyToDidDoc: (
    { publicKeyDescription }: { publicKeyDescription: IKeyPair | IPublicKey }
  ) => Promise<IDidDocument>

  publicMethodFor: (
    { didDocument, purpose }: { didDocument: IDidDocument, purpose: string }
  ) => IPublicKey
}

export class CachedResolver {
  _cache
  _methods
  /**
   * @param {object} [options={}] - Options hashmap.
   * @param {number} [options.max=100] - Max number of items in the cache.
   * @param {number} [options.maxAge=5000] - Max age of a cache item, in ms.
   * @param {boolean} [options.updateAgeOnGet=false] - When using time-expiring
   *   entries with `maxAge`, setting this to true will make each entry's
   *   effective time update to the current time whenever it is retrieved from
   *   cache, thereby extending the expiration date of the entry.
   * @param {object} [options.cacheOptions] - Additional `lru-cache` options.
   */
  constructor ({
    max = 100, maxAge = 5000, updateAgeOnGet = false,
    ...cacheOptions
  } = {}) {
    this._cache = new LruCache({ max, maxAge, updateAgeOnGet, ...cacheOptions })
    this._methods = new Map()
  }

  use (driver: any): void {
    const methodName = driver.method
    this._methods.set(methodName, driver)
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
  async get ({ did, url, ...getOptions }: { did: IDID, url: string }): Promise<IDidDocument | IPublicKey> {
    did = did || url
    if (!did) {
      throw new TypeError('A string "did" or "url" parameter is required.')
    }

    const method = this._methodForDid(did)

    return this._cache.memoize({
      key: did,
      fn: () => method.get({ did, ...getOptions })
    })
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
