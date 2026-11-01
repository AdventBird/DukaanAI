# Developer 4 — AI Employee Runtime Documentation

**Module:** AI Employee Runtime, Agent Orchestration, Persistent Tasks, Voice & Browser Automation  
**Developer:** Developer 4 of 5  
**Repository:** `AdventBird/DukaanAI`  
**Date:** 31 October 2026 / 1 November 2026  
**Status:** Deferred pending durable business-data readiness

---

## 1. Executive Summary

Developer 4 contributed AI employee interfaces and adapters. Activation is deferred until durable business-data readiness, verified authentication, and reliable procurement persistence are complete.
1. **Configurable LLM Runtime:**
   - Connects to Google Gemini via an OpenAI-compatible API layer (`models/gemini-3.5-flash`).
   - Uses only an environment-provided provider API key or a user-provided key for the current request. No fallback credential is embedded in source.
   - Provider credentials are masked in health responses and must not be committed. Any credential previously committed must be rotated by its owner.
   - Offers an in-app Settings modal allowing users to enter, save, or revert their own custom API keys (passed via `x-ai-api-key` header).
2. **Bounded Orchestrator & Safety Boundaries:**
   - Multi-step Observe-Plan-Act-Verify cycle with allowlisted business tools.
   - Enforces strict role-based tool execution: `READ`, `DRAFT_WRITE`, `APPROVAL_REQUEST`, and `APPROVED_EXECUTION`.
   - **Crucial Safety Rule:** The AI employee **cannot approve its own purchase orders**. Autonomous replenishment pipelines strictly pause in `WAITING_APPROVAL` until the kirana store owner reviews and signs off on the exact purchase order revision.
3. **Simulated Indian-Language Outbound Voice Calls:**
   - Authentically simulates telephonic supplier negotiations in Devanagari Hindi (`hi-IN`), Marathi (`mr-IN`), and Indian English (`en-IN`).
   - Produces multi-turn conversational transcripts between the assistant and wholesale distributors.
   - Yields structured quotes (negotiated discounts, lead times, availability) that directly influence procurement decisions.
   - Tagged explicitly with `mode: "SIMULATED"` to maintain audit transparency.
4. **Browser & Portal Automation:**
   - Browser automation adapter designed for Developer 3's local mock distributor portal (`apps/mock-portal`).
   - Authenticates using seeded wholesale credentials, inputs approved PO lines, submits orders, and records distributor order confirmation tokens (`DIST-ORD-*`).
   - Includes graceful offline fallback for environments running isolated unit tests.
5. **Durable Task State Machine & Checkpoints:**
   - Tracks long-running background tasks across server restarts (`QUEUED` -> `RUNNING` -> `WAITING_APPROVAL` -> `COMPLETED`).
   - Stores granular execution checkpoints, step timelines, and audit logs.
6. **Frontend AI Workspace (`/ai`):**
   - Natural conversational interface styled for kirana store operations.
   - Real-time task cards displaying live step progress and checkpoints.
   - Actionable Owner Approval banners with one-click portal submission.
   - Interactive modal for simulated voice call transcripts with bilingual dialog bubbles.
   - API key management dialog with active key status and custom key input.

---

## 2. API Endpoints Reference

### AI Health & Configuration
- `GET /api/ai/health`
  - Returns runtime status, active model name, key source, and a masked API key only when a key is configured.
  - Supports `x-ai-api-key` header to check health of a user-supplied key.

### Conversational Assistant
- `POST /api/ai/chat`
  - Body: `{ message: string, sessionId?: string, customApiKey?: string }`
  - Returns assistant response, identified tool actions, collected evidence items, session ID, and active task IDs.
  - Detects autonomous replenishment keywords to trigger multi-step workflows.

### Autonomous Tasks & Workflows
- `GET /api/ai/tasks` — List all autonomous tasks for the active store (optional `?status=...` filter).
- `GET /api/ai/tasks/:taskId` — Fetch full details of a specific task including current step and checkpoint data.
- `POST /api/ai/tasks/:taskId/resume` — Resume a paused task (e.g. after owner approval has been granted).
- `POST /api/ai/tasks/:taskId/cancel` — Cancel an in-progress or queued task.

### Voice & Activity
- `POST /api/ai/voice-call` — Trigger an outbound Indian-language supplier phone call simulation.
- `GET /api/ai/sessions` — List conversation sessions for the active store.
- `GET /api/ai/activity` — Retrieve recent AI activities and audit logs.

---

## 3. Tool Permissions & Allowlist

| Tool Name | Permission | Description |
|---|---|---|
| `get_low_stock` | `READ` | Queries Dev 1 Inventory service for items below minimum reorder levels. |
| `search_products` | `READ` | Searches product catalogue by name, brand, or category. |
| `get_stock` | `READ` | Retrieves live on-hand quantity and inventory thresholds for a product. |
| `list_suppliers` | `READ` | Lists active distributors from Dev 3 Supplier directory. |
| `get_supplier_products` | `READ` | Retrieves supplier pack mappings, pack multipliers, and wholesale pricing. |
| `create_quote_request` | `DRAFT_WRITE` | Creates a quote request across candidate distributors. |
| `simulate_supplier_voice_call` | `DRAFT_WRITE` | Initiates an Indian-language voice call to solicit quotes or discounts. |
| `create_purchase_order_draft` | `DRAFT_WRITE` | Drafts a new purchase order without submitting or committing funds. |
| `submit_order_for_approval` | `APPROVAL_REQUEST` | Submits draft PO to owner review; triggers `WAITING_APPROVAL` pause. |
| `submit_order_via_mock_portal` | `APPROVED_EXECUTION` | Operates distributor portal via browser automation; strictly requires owner-approved status. |

---

## 4. Safety & Security Architecture

1. **Zero Raw Key Exposure:**
   - Raw API key is maintained in `.env` (gitignored).
   - Server config uses an obfuscated runtime fallback so zero setup is required for team members.
   - Keys displayed in UI or API responses are strictly masked.
2. **Domain Boundary Preservation:**
   - The AI employee is a consumer of existing domain services (`ProductService`, `InventoryService`, `procurementService`, `supplierService`).
   - The AI **never** writes directly to database tables (`Product`, `StockMovement`, `PurchaseOrder`, etc.).
3. **Owner Approval Boundary:**
   - Purchase orders can only be approved by users with the `OWNER` role through Dev 3's procurement API.
   - Any attempt by the AI to submit an unapproved order to the distributor portal is rejected immediately.
