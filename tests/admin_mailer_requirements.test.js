import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

test('required admin route/controller and Resend mailer wiring exist', () => {
  assert.equal(existsSync(path.join(root, 'src/controllers/adminController.js')), true);
  assert.equal(existsSync(path.join(root, 'src/routes/admin.js')), true);
  assert.equal(existsSync(path.join(root, 'src/utils/mailer.js')), true);
});

test('backend CORS allow-lists include the ecotrack hosted frontend domain used by the app', () => {
  const appSource = readFileSync(path.join(root, 'src/app.js'), 'utf8');
  const errorSource = readFileSync(path.join(root, 'src/middleware/errorHandler.js'), 'utf8');

  assert.match(appSource, /https:\/\/ecotrack\.ramodiasnetworksolutions\.com/);
  assert.match(errorSource, /https:\/\/ecotrack\.ramodiasnetworksolutions\.com/);
});
