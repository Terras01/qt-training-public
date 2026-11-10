# Neighborhood Pizza: Online Pickup Ordering

Customers build pizzas, review their order and place it for pickup. They pay at the counter. Kitchen staff watch incoming orders on a board and mark each one **Ready**.

- **Frontend:** Vue 3 + Vite (`client/`)
- **Backend:** Node.js + Express 5 (`server/`)
- **Database:** SQLite through Node's built-in `node:sqlite`, so there's no native module to compile

## Requirements

- Node.js **22.13 or later** (built-in `node:sqlite`)

## Run it

From this folder (`pizza-app/`):

```bash
npm run install:all   # install root (Playwright), server, and client packages
npm run build         # build the Vue app into client/dist
npm start             # start the server on http://localhost:3000
```

| Page | URL |
|---|---|
| Customer ordering | http://localhost:3000/ |
| Kitchen board | http://localhost:3000/kitchen |

### Development (hot reload)

Run these in two terminals:

```bash
npm run dev:server    # API on :3000, restarts on file changes
npm run dev:client    # Vite on http://localhost:5173, proxies /api to :3000
```

### Tests

```bash
npm test              # API, validation, persistence, and client pricing tests
npm run test:e2e      # Playwright browser tests for every acceptance criterion
```

The Playwright tests in `e2e/` build the client and start the real server on a free port with a temporary SQLite file. They then drive the browser through each acceptance criterion (AC-1.1 to AC-4.3), and every test title starts with the AC it covers. The AC-4.3 test closes the browser and hard-kills the server mid-day, then checks that the orders and statuses are still there.

- On Windows they use the installed Microsoft Edge, so no browser download is needed. Elsewhere, run `npx playwright install chromium` first, or set `PW_CHANNEL`.
- To watch them run: `PW_SLOWMO=300 npx playwright test --headed --workers=1 --project=desktop`
- For the interactive runner with step-by-step snapshots: `npx playwright test --ui`
- After a run: `npx playwright show-report`

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `DB_FILE` | `server/data/pizza.db` | SQLite database file. It's created automatically and git ignores it. |

## How it works

- **Menu and prices:** stored in SQLite and re-seeded at startup from `server/src/db.js`: Small 10" $10.00, Large 14" $14.00, and $2.00 per topping. All money is handled in whole cents.
- **Pricing is checked on the server:** the browser shows live prices, but the server recalculates every price from the menu when an order is placed and ignores any prices the browser sends.
- **Orders survive restarts:** orders and their statuses are written to SQLite in a single transaction, with WAL journaling and `synchronous=FULL`. Closing the app or restarting the computer doesn't lose them. The kitchen board reloads from the database when it opens and refreshes every 5 seconds.
- **Order history:** each order line stores the size and topping names and prices at the time of the order, so old orders stay accurate if the menu changes.
- **Cart:** saved in the browser's localStorage, so refreshing the page doesn't empty it. It's cleared after a successful order.

## API

| Method | Path | Body / query |
|---|---|---|
| GET | `/api/menu` | none |
| POST | `/api/orders` | `{ "customerName": "Pat", "items": [{ "sizeId": "large", "toppingIds": ["pepperoni"], "quantity": 2 }] }` |
| GET | `/api/orders` | optional `?status=New` or `?status=Ready` |
| GET | `/api/orders/:id` | none |
| PATCH | `/api/orders/:id/status` | `{ "status": "Ready" }` or `{ "status": "New" }` (undo) |

Validation errors return `400` with a readable `error` message. An unknown order returns `404`.

## Not included (by design or for follow-up)

- Delivery, online payment, customer accounts, coupons, loyalty, taxes and fees are out of scope per the requirements.
- **The kitchen board has no login.** Anyone who can reach `/kitchen` can change order status. A shop decision is needed before this is exposed beyond the store network.
- The Ready column shows every Ready order ever placed. Archiving or hiding old orders (for example, by day) would be a natural next step.
