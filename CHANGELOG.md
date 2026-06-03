# @interop/did-io ChangeLog

## 4.0.2 - 2026-06-03

### Fixed
- Add default export to `package.json`.

## 4.0.1 - 2026-06-01

### Fixed
- Align the `DidMethodDriver` interface with the actual driver implementations
  (`@interop/did-method-key`, `@interop/did-web-resolver`), so drivers can now
  declare `implements DidMethodDriver`:
  - `fromKeyPair` is now `async` (returns `Promise<DidGenerationResult>` instead
    of a synchronous `DidGenerationResult`).
  - `publicKeyToDidDoc` now returns `Promise<{ didDocument: IDidDocument }>`
    instead of `Promise<IDidDocument>`, matching what the drivers return.
  - Removed `computeId` from the interface. It was never called by
    `CachedResolver` (or any other consumer), so it should not have been a
    required member of `DidMethodDriver`. Driver implementations may still
    expose it as their own method.

## 4.0.0 - 2026-06-01

### Changed
- **BREAKING**: Swap dependencies to `@interop/data-integrity-core`, dropping
  `@digitalcredentials/ssi` and `@digitalcredentials/keypair` (both now folded
  into `data-integrity-core`). Mirrors `@interop/ed25519-verification-key@7.0.0`.
- **BREAKING**: `IKeyMap` is now `Map<string, AbstractKeyPair>` (was
  `Map<string, KeyPair>`), holding live `AbstractKeyPair` instances from
  `@interop/data-integrity-core`.
- **BREAKING**: `DidGenerationResult.methodFor` and `DidMethodDriver.computeId`
  now use the `AbstractKeyPair` type. `DidMethodDriver.fromKeyPair` and
  `publicKeyToDidDoc` inputs accept `AbstractKeyPair | IKeyPair`.
- **BREAKING**: `findVerificationMethod` (and internal helpers) now return
  `IVerificationMethodEntry` (was `IKeyIdOrObject`).

## 3.0.0 - 2026-05-27

### Changed
- **BREAKING**: `IKeyMap` is now `Map<string, KeyPair>` (was
  `Record<string, IKeyPair>`), holding live `KeyPair` instances from
  `@digitalcredentials/keypair` instead of plain key descriptors. Aligns with
  downstream method drivers (e.g. `@interop/did-method-key`).
- **BREAKING**: `DidGenerationResult.methodFor` and `DidMethodDriver.computeId`
  now use the live `KeyPair` type. `DidMethodDriver.fromKeyPair` and
  `publicKeyToDidDoc` inputs widened to accept `KeyPair | IKeyPair`.
- **BREAKING**: Remove `initKeys()` and the `IKeyMapInput` type.

## 2.0.0-2.0.1 - 2026-05-26

### Changed
- Forked from `@digitalbazaar/did-io@1.0.0`.
- **BREAKING**: Convert to TypeScript.
- **BREAKING**: Update to latest `lru-cache` package, deprecate `maxAge` option
  (uses `ttl` instead).

### Added
- Import `generate()` and a pass-through `cache` param from `@digitalbazaar/did-io@2.0.0`.

## 1.0.1 - 2021-10-01

### Changed
- Remove use of runtime `esm` compiler, for TypeScript and ReactNative compat.

## 1.0.0 - 2021-04-06

This version is a major breaking release, based on cumulative experience in
the field with DID method drivers. See Upgrading from `8.x` section for
instructions.

### Changed
- **BREAKING**: Rename NPM package name from `did-io` to `@digitalbazaar/did-io`.
- **BREAKING**: `.use()` no longer requires a method id first param. New usage:
  `.use(driver)`.
- Add a `CachedResolver` class (extracted from `did:key` method driver) to
  server as the driver harness.
- **BREAKING**: Change module export signature. (see Upgrading section below
  on usage.)
- **BREAKING**: No longer export a `DidDocument` class. DID documents are now
  expected to be plain JS/parsed JSON objects, instead of `DidDocument`
  instances.

### Upgrading from `8.x`

See [Upgrading v0.8 to v1.0.0 checklist](docs/upgrading-0.8-to-1.0.md) in `docs/`.

## 0.8.3 - 2020-08-19

### Fixed
- Engine specification format in package.json (Node 12+).

## 0.8.2 - 2020-05-12

### Added
- Remove `forceConstruct` flag (move it down to individual drivers).

## 0.8.1 - 2020-05-01

### Added
- Add a `forceConstruct` optimization flag.

## 0.8.0 - 2020-04-10

### Changed

- **BREAKING**: Update API to Chai-like `dids.use(method, driver)` architecture
  (no methods will be bundled with did-io by default).
- **BREAKING**: Updated terminology to match latest VeresOne DID method specs:
  `grantCapability -> capabilityDelegation`,
  `invokeCapability -> capabilityInvocation`
- **BREAKING**: Renamed `secretKey` to `privateKey`, to match Digital
  Bazaar conventions. (Migrating from v0.7.0 will require renaming the relevant properties in existing DID Docs.)

## 0.7.0 - 2018-09-10

### Changed (BREAKING changes)
- Node requirement bumped to 8.3
- Updated license to match newer projects
- Library updated to run against Veres One testnet
- Port DID creation and management code from `did-client`
- Port web ledger client and key management code from `did-veres-one` and
  `did-veres-one-client`
- Changed DID storage method - private keys, metadata and DID Docs stored
  separately, on disk

## 0.6.7 - 2017-07-11

### Added
- Add support for new DID format as described in the [DID specification].

## 0.6.6 - 2016-08-01

- See git history for changes previous to this release.

[DID specification]: https://opencreds.github.io/did-spec/#the-generic-did-scheme
