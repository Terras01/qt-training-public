import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { openDatabase } from './db.js';
import { createApp } from './app.js';

const here = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT) || 3000;
const dbFile = process.env.DB_FILE || resolve(here, '../data/pizza.db');
const clientDir = resolve(here, '../../client/dist');

const db = openDatabase(dbFile);
const app = createApp(db, { clientDir });

const server = app.listen(port, () => {
  console.log(`Neighborhood Pizza running at http://localhost:${port}`);
  console.log(`Kitchen board:              http://localhost:${port}/kitchen`);
  console.log(`Database file:              ${dbFile}`);
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
