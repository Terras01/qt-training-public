import express from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createStore, ValidationError } from './store.js';

/**
 * Builds the Express app. When `clientDir` (the built Vue app, client/dist) exists,
 * the server also serves the website, so a single process runs everything.
 */
export function createApp(db, { clientDir } = {}) {
  const store = createStore(db);
  const app = express();

  app.use(express.json({ limit: '100kb' }));

  const api = express.Router();

  api.get('/menu', (req, res) => {
    res.json(store.getMenu());
  });

  api.post('/orders', (req, res) => {
    res.status(201).json(store.createOrder(req.body));
  });

  api.get('/orders', (req, res) => {
    const { status } = req.query;
    res.json(store.listOrders(typeof status === 'string' && status ? status : undefined));
  });

  api.get('/orders/:id', (req, res) => {
    const order = store.getOrder(parseId(req.params.id));
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    res.json(order);
  });

  api.patch('/orders/:id/status', (req, res) => {
    const order = store.setStatus(parseId(req.params.id), req.body?.status);
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    res.json(order);
  });

  api.use((req, res) => res.status(404).json({ error: 'Not found.' }));
  app.use('/api', api);

  if (clientDir && existsSync(join(clientDir, 'index.html'))) {
    app.use(express.static(clientDir));
    // Let the Vue router handle page URLs such as /kitchen.
    app.get('/{*path}', (req, res) => res.sendFile(join(clientDir, 'index.html')));
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof ValidationError) {
      return res.status(400).json({ error: err.message });
    }
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Request body must be valid JSON.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on our end. Please try again.' });
  });

  return app;
}

function parseId(raw) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) throw new ValidationError('Order number is invalid.');
  return id;
}
