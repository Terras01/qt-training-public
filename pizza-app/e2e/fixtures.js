// Shared Playwright fixtures and helpers.
//
// Each test worker runs the real Node server (server/src/index.js) on a free port
// with its own temporary SQLite file. The `app` fixture can stop and restart that
// server on the same file, which is how the tests check that orders survive a
// restart (AC-4.3).
import { test as base, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const serverEntry = join(root, 'server', 'src', 'index.js');

function freePort() {
  return new Promise((resolvePort, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolvePort(port));
    });
  });
}

async function waitForServer(url, child, output) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Server exited early (code ${child.exitCode}):\n${output.join('')}`);
    }
    try {
      const res = await fetch(`${url}/api/menu`);
      if (res.ok) return;
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Server did not start in time:\n${output.join('')}`);
}

class AppServer {
  constructor(port, dbFile) {
    this.port = port;
    this.dbFile = dbFile;
    this.url = `http://127.0.0.1:${port}`;
    this.child = null;
  }

  async start() {
    const output = [];
    this.child = spawn(process.execPath, [serverEntry], {
      env: { ...process.env, PORT: String(this.port), DB_FILE: this.dbFile },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    this.child.stdout.on('data', (d) => output.push(d.toString()));
    this.child.stderr.on('data', (d) => output.push(d.toString()));
    await waitForServer(this.url, this.child, output);
  }

  /** Hard-kills the server process, like closing the app abruptly or a power loss. */
  async kill() {
    if (!this.child || this.child.exitCode !== null) return;
    const exited = new Promise((r) => this.child.once('exit', r));
    this.child.kill('SIGKILL');
    await exited;
  }

  async restart() {
    await this.kill();
    await this.start();
  }

  /** Places an order directly through the API (for kitchen tests that don't need the customer UI). */
  async placeOrder(order) {
    const res = await fetch(`${this.url}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order),
    });
    if (res.status !== 201) throw new Error(`placeOrder failed: ${res.status} ${await res.text()}`);
    return res.json();
  }

  async listOrders() {
    return (await fetch(`${this.url}/api/orders`)).json();
  }
}

export const test = base.extend({
  app: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const dir = mkdtempSync(join(tmpdir(), 'pizza-e2e-'));
      const server = new AppServer(await freePort(), join(dir, 'pizza.db'));
      await server.start();
      await use(server);
      await server.kill();
      rmSync(dir, { recursive: true, force: true });
    },
    { scope: 'worker' },
  ],

  baseURL: async ({ app }, use) => {
    await use(app.url);
  },
});

export { expect };

// ---------- Customer page helpers ----------

export const SIZE_LABEL = { small: 'Small (10")', large: 'Large (14")' };

/** Picks a size and toppings in the builder, sets the quantity, and adds it to the cart. */
export async function addPizza(page, { size = 'small', toppings = [], quantity = 1 } = {}) {
  const builder = page.getByRole('region', { name: 'Build your pizza' });
  await builder.getByRole('radio', { name: SIZE_LABEL[size] }).check();
  for (const topping of toppings) {
    await builder.getByRole('checkbox', { name: topping }).check();
  }
  for (let i = 1; i < quantity; i++) {
    await builder.getByRole('button', { name: 'Increase quantity' }).click();
  }
  await builder.getByRole('button', { name: /^Add / }).click();
}

/**
 * A single cart line, matched by size and its exact toppings text
 * (e.g. "Pepperoni, Onions" or "Cheese only"), so "Pepperoni" doesn't also match "Pepperoni, Onions".
 */
export function cartLine(page, size, toppingsText) {
  return page
    .getByTestId('cart-line')
    .filter({ hasText: SIZE_LABEL[size] })
    .filter({ has: page.getByText(toppingsText, { exact: true }) });
}

/** A kitchen order card by order number. */
export function orderCard(page, id) {
  return page.locator(`[data-order-id="${id}"]`);
}
