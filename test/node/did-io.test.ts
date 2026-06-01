/*!
 * Copyright (c) 2021 Digital Bazaar, Inc. All rights reserved.
 */
import { describe, it, beforeEach, expect } from 'vitest'
import type { IDidDocument } from '@interop/data-integrity-core'

import {
  findVerificationMethod,
  approvesMethodFor,
  parseDid
} from '../../src/index.js'

const MOCK_KEY = {
  id: 'did:ex:123#abcd',
  controller: 'did:ex:123',
  type: 'Ed25519VerificationKey2020',
  publicKeyMultibase: '...'
}

describe('parseDid', () => {
  it('should return main did method identifier', () => {
    const { prefix } = parseDid({ did: 'did:v1:test:nym:abcd' })
    expect(prefix).toBe('v1')
  })
})

describe('didIo utility functions', () => {
  describe('findVerificationMethod', () => {
    const did = 'did:ex:123'
    let key: typeof MOCK_KEY

    beforeEach(() => {
      key = { ...MOCK_KEY }
    })

    it('should return undefined if key is not found by id', () => {
      const doc = {
        id: did,
        verificationMethod: [key],
        authentication: [key.id]
      } as unknown as IDidDocument

      const result = findVerificationMethod({ doc, methodId: 'a key id' })
      expect(result).toBeUndefined()
    })

    it('should return undefined if key is not found by purpose', () => {
      const doc = {
        id: did,
        authentication: [key],
        assertionMethod: []
      } as unknown as IDidDocument

      expect(findVerificationMethod({ doc, purpose: 'assertionMethod' }))
        .toBeUndefined()
      expect(findVerificationMethod({ doc, purpose: 'capabilityInvocation' }))
        .toBeUndefined()
    })

    it('should find by id in verificationMethod', () => {
      const doc = {
        id: did,
        verificationMethod: [key],
        authentication: [key.id]
      } as unknown as IDidDocument

      const result = findVerificationMethod({ doc, methodId: key.id })
      expect(result).toEqual(MOCK_KEY)
    })

    it('should find by id if defined in purpose', () => {
      const doc = {
        id: did,
        authentication: [key]
      } as unknown as IDidDocument

      const result = findVerificationMethod({ doc, methodId: key.id })
      expect(result).toEqual(MOCK_KEY)
    })

    it('should find by id if referenced', () => {
      const doc = {
        id: did,
        authentication: [key.id],
        assertionMethod: [key]
      } as unknown as IDidDocument

      const result = findVerificationMethod({ doc, methodId: key.id })
      expect(result).toEqual(MOCK_KEY)
    })

    it('should find by purpose in verificationMethod', () => {
      const doc = {
        id: did,
        verificationMethod: [key],
        authentication: [key.id]
      } as unknown as IDidDocument

      const result = findVerificationMethod({ doc, purpose: 'authentication' })
      expect(result).toEqual(MOCK_KEY)
    })

    it('should find by purpose if defined in purpose', () => {
      const doc = {
        id: did,
        authentication: [key]
      } as unknown as IDidDocument

      const result = findVerificationMethod({ doc, purpose: 'authentication' })
      expect(result).toEqual(MOCK_KEY)
    })

    it('should find by purpose if referenced', () => {
      const doc = {
        id: did,
        authentication: [key.id],
        assertionMethod: [key]
      } as unknown as IDidDocument

      const result = findVerificationMethod({ doc, purpose: 'authentication' })
      expect(result).toEqual(MOCK_KEY)
    })
  })

  describe('approvesMethodFor', () => {
    const did = 'did:ex:123'
    let key: typeof MOCK_KEY

    beforeEach(() => {
      key = { ...MOCK_KEY }
    })

    it('should return false if method not in document', () => {
      const doc = {
        id: did
      } as unknown as IDidDocument

      const result = approvesMethodFor({
        doc, methodId: key.id, purpose: 'authentication'
      })
      expect(result).toBe(false)
    })

    it('should return false if method not approved', () => {
      const doc = {
        id: did,
        verificationMethod: [key]
      } as unknown as IDidDocument & { assertionMethod?: string[] }

      expect(approvesMethodFor({
        doc, methodId: key.id, purpose: 'authentication'
      })).toBe(false)

      doc.assertionMethod = [key.id]
      expect(approvesMethodFor({
        doc, methodId: key.id, purpose: 'authentication'
      })).toBe(false)
    })

    it('should return true if method is approved (referenced)', () => {
      const doc = {
        id: did,
        verificationMethod: [key],
        authentication: [key.id]
      } as unknown as IDidDocument

      expect(approvesMethodFor({
        doc, methodId: key.id, purpose: 'authentication'
      })).toBe(true)
    })
  })
})
