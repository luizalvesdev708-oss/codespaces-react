import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hashPassword, verifyPassword } from './password.js';

test('scrypt password hashes verify without storing plaintext', async () => {
  const password = 'secret-institutional-password';
  const encoded = await hashPassword(password);
  assert.match(encoded, /^scrypt\$16384\$8\$1\$/);
  assert.notEqual(encoded, password);
  assert.equal(await verifyPassword(password, encoded), true);
  assert.equal(await verifyPassword('incorrect-password', encoded), false);
});

test('rejects weak passwords and malformed hashes', async () => {
  await assert.rejects(hashPassword('short'));
  assert.equal(await verifyPassword('some-password', 'not-a-hash'), false);
});
