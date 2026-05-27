/*!
 * Copyright (c) 2021 Digital Bazaar, Inc. All rights reserved.
 */
import { VERIFICATION_RELATIONSHIPS } from './constants.js'
import type {
  IDID,
  IDidDocument,
  IKeyIdOrObject
} from '@digitalcredentials/ssi'
import type { KeyPair } from '@digitalcredentials/keypair'

export type IKeyMap = Map<string, KeyPair>

/**
 * Tests whether this DID Document contains a verification relationship
 * between the subject and a method id, for a given purpose.
 *
 * @example
 * didDocument.approvesMethodFor({
 *   methodId: 'did:ex:1234#abcd', purpose: 'authentication'
 * });
 * // -> true
 * @example
 * didDocument.approvesMethodFor({
 *   methodId: 'did:ex:1234#abcd', purpose: 'assertionMethod'
 * });
 * // -> false
 *
 * @param {object} options - Options hashmap.
 * @param {object} options.doc - DID Document.
 * @param {string} options.methodId - Verification method id (a uri).
 * @param {string} options.purpose - E.g. 'authentication', etc.
 *
 * @returns {boolean} Returns whether a method id is authorized for purpose.
 */
export function approvesMethodFor (
  { doc, methodId, purpose }: { doc: IDidDocument, methodId: string, purpose: string }): boolean {
  if (!(methodId && purpose)) {
    throw new Error('A method id and purpose is required.')
  }
  const method = _methodById({ doc, methodId })
  if (!method) {
    return false
  }
  const methods = _methodsForPurpose({ doc, purpose })

  return methods.some(method => {
    return (typeof method === 'string' && method === methodId) ||
      (typeof method === 'object' && method.id === methodId)
  })
}

/**
 * Finds a verification method for a given methodId or purpose.
 *
 * If a method id is given, returns the object for that method (for example,
 * returns the public key definition for that id).
 *
 * If a purpose (verification relationship) is given, returns the first
 * available verification method for that purpose.
 *
 * If no method is found (for the given id or purpose), returns undefined.
 *
 * @example
 * findVerificationMethod({doc, methodId: 'did:ex:123#abcd'});
 * // ->
 * {
 *   id: 'did:ex:123#abcd',
 *   controller: 'did:ex:123',
 *   type: 'Ed25519VerificationKey2020',
 *   publicKeyMultibase: '...'
 * }
 * @example
 * didDocument.findVerificationMethod({doc, purpose: 'authentication'});
 * // ->
 * {
 *   id: 'did:ex:123#abcd',
 *   controller: 'did:ex:123',
 *   type: 'Ed25519VerificationKey2020',
 *   publicKeyMultibase: '...'
 * }
 * @param {object} options - Options hashmap.
 * @param {object} options.doc - DID Document.
 *
 * One of the following is required.
 * @param {string} [options.methodId] - Verification method id.
 * @param {string} [options.purpose] - Method purpose (verification
 *   relationship).
 *
 * @returns {object} Returns the verification method, or undefined if not found.
 */
export function findVerificationMethod (
  { doc, methodId, purpose }:
  { doc: IDidDocument, methodId?: string, purpose?: string }
): IKeyIdOrObject | undefined {
  if (!doc) {
    throw new TypeError('A DID Document is required.')
  }
  if (!(methodId ?? purpose)) {
    throw new TypeError('A method id or purpose is required.')
  }

  if (methodId) {
    return _methodById({ doc, methodId })
  }

  // Id not given, find the first method by purpose
  const [method] = _methodsForPurpose({ doc, purpose })
  if (method && typeof method === 'string') {
    // This is a reference, not the full method, attempt to find it
    return _methodById({ doc, methodId: method })
  }

  return method
}

/**
 * Finds a verification method for a given id and returns it.
 *
 * @param {object} options - Options hashmap.
 * @param {object} options.doc - DID Document.
 * @param {string} options.methodId - Verification method id.
 *
 * @returns {object} Returns the verification method.
 */
export function _methodById (
  { doc, methodId }: { doc: IDidDocument, methodId: string }
): IKeyIdOrObject | undefined {
  let result

  // First, check the 'verificationMethod' bucket, see if it's listed there
  let unlistedPurposeMethods: IKeyIdOrObject[] | undefined
  if (doc.verificationMethod) {
    unlistedPurposeMethods = Array.isArray(doc.verificationMethod)
      ? doc.verificationMethod
      : [doc.verificationMethod]
    result = unlistedPurposeMethods.find((method: IKeyIdOrObject) => {
      return (typeof method === 'string' && method === methodId) ||
        (typeof method === 'object' && method.id === methodId)
    })
    if (result) {
      return result
    }
  }

  for (const purpose of VERIFICATION_RELATIONSHIPS) {
    const methods = _methodsForPurpose({ doc, purpose })
    // Iterate through each verification method in 'authentication', etc.
    for (const method of methods) {
      // Only return it if the method is defined, not referenced
      if (typeof method === 'object' && method.id === methodId) {
        result = method
        break
      }
    }
    if (result) {
      return result
    }
  }
}

/**
 * Reads a DID Document's verification relationship (by purpose) and normalizes
 * it to an array of verification methods (key ids or key objects). The DID Core
 * data model allows each relationship to be either a single value or an array.
 *
 * @param {object} options - Options hashmap.
 * @param {object} options.doc - DID Document.
 * @param {string} [options.purpose] - Verification relationship (e.g.
 *   'authentication').
 *
 * @returns {IKeyIdOrObject[]} The methods for that purpose (empty if none).
 */
function _methodsForPurpose (
  { doc, purpose }: { doc: IDidDocument, purpose?: string }
): IKeyIdOrObject[] {
  if (!purpose) {
    return []
  }
  const value = (doc as unknown as
    Record<string, IKeyIdOrObject | IKeyIdOrObject[] | undefined>)[purpose]
  if (value == null) {
    return []
  }
  return Array.isArray(value) ? value : [value]
}

/**
 * Parses the DID into various components (currently, only cares about prefix).
 *
 * @example
 * parseDid({did: 'did:v1:test:nym'});
 * // -> {prefix: 'v1'}
 *
 * @param {string} did - DID uri.
 *
 * @returns {{prefix: string}} Returns the method prefix (without `did:`).
 */
export function parseDid ({ did }: { did: IDID | string }): { prefix: string } {
  if (!did) {
    throw new TypeError('DID cannot be empty.')
  }

  const prefix = did.split(':').slice(1, 2).join(':')

  return { prefix }
}
