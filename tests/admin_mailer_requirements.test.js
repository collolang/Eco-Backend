import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

test('required admin route/controller and Resend mailer wiring exist', () => {
  assert.equal(existsSync(path.join(root, 'src/controllers/adminController.js')), true);
  assert.equal(existsSync(path.join(root, 'src/routes/admin.js')), true);
  assert.equal(existsSync(path.join(root, 'src/utils/mailer.js')), true);
});
