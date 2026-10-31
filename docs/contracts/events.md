# Event contract

Shared event envelope fields: event ID, type, payload version, store ID, entity type/ID, UTC occurrence time, actor (`USER`, `SYSTEM`, `AI`) and payload. The Zod contract lives in `packages/shared`.

Suggested names include `product.created`, `inventory.stock_adjusted`, `sale.completed`, `purchase_order.approved`, `goods_receipt.confirmed`, and `expense.recorded`. Domain owners publish events in the same database transaction as their business writes when possible. Delivery is at least once; consumers deduplicate by event ID. Do not include credentials, payment details, customer PII, or raw voice transcripts in generic activity payloads.

The Prisma `OutboxEvent` model establishes storage only. No dispatcher is enabled until an owning worker integrates it.
