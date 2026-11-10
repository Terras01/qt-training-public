import { execSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export default function globalSetup() {
  execSync('npm run build --prefix client', { cwd: root, stdio: 'inherit' });
}
