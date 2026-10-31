# Mock Distributor Portal — Browser Automation Contract

**Module:** Developer 3 (Supplier Management, Procurement & Mock Distributor Portal)  
**Consumer:** Developer 4 (AI Employee & Playwright Browser Automation)  
**Location:** `apps/mock-portal`  
**Default URL:** `http://localhost:3002`  

---

## 1. Overview & Purpose

The Mock Distributor Portal simulates realistic Indian B2B wholesale distributor portals (such as Metro Cash & Carry, Jumbotail, or regional FMCG distributors) without requiring live external accounts or risking actual financial transactions.

It exposes:
1. Web pages with stable, semantic `data-testid` attributes designed specifically for Playwright / computer-use agents.
2. Seeded demo supplier credentials.
3. Live catalogue pricing, pack conversions, MOQ, and stock availability.
4. Deterministic scenario switches (price hikes and stock shortages) to demonstrate AI comparison logic shifting decisions during live demos.
5. Direct order submission that issues a unique distributor order reference (`DIST-ORD-XXXXXX`).

---

## 2. Seeded Demo Accounts

| Distributor | Username | Password | Default Lead Time | Strategy |
|---|---|---|---|---|
| **Metro Cash & Carry** | `metro_partner` | `demo_password123` | 2 days | Large cartons (24 units), bulk discount |
| **Anand Agencies** | `anand_wholesaler` | `anand_demo456` | 1 day | Smaller boxes (12 units), fast local delivery |

---

## 3. Playwright Stable Selectors

All key interactive elements include fixed `data-testid` selectors:

| Selector | Element Type | Description |
|---|---|---|
| `[data-testid="supplier-login"]` | `div` (form container) | Login container |
| `[data-testid="supplier-username"]` | `input[name="username"]` | Distributor username input |
| `[data-testid="supplier-password"]` | `input[name="password"]` | Password input |
| `[data-testid="supplier-login-submit"]` | `button[type="submit"]` | Sign in button |
| `[data-testid="catalogue-search"]` | `input` | Search catalogue input |
| `[data-testid="quote-request-table"]` | `tr` | Each product row in quotation table |
| `[data-testid="quote-unit-price"]` | `td` | Quoted pack price (e.g. `₹216.00`) |
| `[data-testid="quote-availability"]` | `td` | Availability badge (`In Stock` / `OUT OF STOCK`) |
| `[data-testid="purchase-order-reference"]` | `input[name="poReference"]` | DukaanAI PO reference input |
| `[data-testid="purchase-order-submit"]` | `button[type="submit"]` | Submit PO to distributor |
| `[data-testid="order-status"]` | `span.badge` | Order acknowledgment status (`ACKNOWLEDGED`) |

---

## 4. Seeded Demo Scenarios for Dev 4

The portal supports dynamic scenario toggling to demonstrate autonomous agent decision changes during live demonstrations:

### Scenario A: NORMAL (Baseline)
- Metro Parle-G: **₹216.00 / carton of 24 units** (₹9.00 / unit), In Stock.
- Anand Parle-G: **₹114.00 / box of 12 units** (₹9.50 / unit), In Stock.
- **Expected Agent Decision:** Agent recommends Metro as the cheaper per-stock-unit option.

### Scenario B: PRICE_HIKE (Metro price increase)
- Metro Parle-G price increases to **₹240.00 / carton** (₹10.00 / unit).
- Anand Parle-G remains at **₹114.00 / box** (₹9.50 / unit).
- **Expected Agent Decision:** Agent re-evaluates quotes, notices Metro's price increase, and recommends switching to Anand Agencies to protect kirana profit margins.

### Scenario C: SHORTAGE (Metro stockout)
- Metro reports **OUT OF STOCK** on Parle-G (`availablePacks: 0`).
- Anand has 100 boxes in stock.
- **Expected Agent Decision:** Agent detects stockout risk and routes the order to Anand Agencies.

### Triggering Scenarios:
- **Via Browser:** Click the demo scenario control buttons at top of page (`/scenario/set?mode=PRICE_HIKE` or `SHORTAGE` or `NORMAL`).
- **Via API:** `GET /api/scenario` to inspect, or `POST /scenario/set?mode=PRICE_HIKE`.

---

## 5. End-to-End Browser Flow for Dev 4

1. Navigate to `http://localhost:3002/login`.
2. Fill `[data-testid="supplier-username"]` with `metro_partner` and `[data-testid="supplier-password"]` with `demo_password123`.
3. Click `[data-testid="supplier-login-submit"]`.
4. Inspect `[data-testid="quote-request-table"]` for product price (`[data-testid="quote-unit-price"]`) and availability (`[data-testid="quote-availability"]`).
5. Fill `[data-testid="purchase-order-reference"]` with approved PO number (e.g. `PO-2026-1001`).
6. Click `[data-testid="purchase-order-submit"]`.
7. Extract the distributor order reference (e.g. `DIST-ORD-889021`) and status (`[data-testid="order-status"]`).
8. Return the reference to DukaanAI Procurement API (`POST /api/purchase-orders/:id/submit`).
