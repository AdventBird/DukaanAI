# Shared types

`packages/shared/src/index.ts` is the shared contract entry point. It exports the Zod `AuthContext`, API error codes/envelopes, and versioned `DomainEvent` envelope. Add module-specific schemas under namespaced files and re-export them here; coordinate breaking changes before merging.

Money is represented as decimal strings, quantities follow the domain unit contract, and IDs are opaque strings. Do not expose internal database rows as public DTOs.
