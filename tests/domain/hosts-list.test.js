import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHostsList } from '../../src/domain/hosts-list.js';

test('hosts list parsing keeps domains mapped from IPv4 or IPv6 and removes localhost and duplicates', () => {
  const text = `
    0.0.0.0 adult.example # adult
    127.0.0.1 casino.example
    ::1 ipv6.example
    0.0.0.0 adult.example
    0.0.0.0 localhost
    # comment.example
  `;

  assert.deepEqual(parseHostsList(text), ['adult.example', 'casino.example', 'ipv6.example']);
});
