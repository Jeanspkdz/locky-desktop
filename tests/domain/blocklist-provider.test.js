import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { getCandidates, ADULT_CANDIDATES, GAMBLING_CANDIDATES } = require('../../src/main/blocklist-provider.cjs');
const { applyApprovedDomains } = require('../../src/main/approved-domains.cjs');

test('the bundled initial blocklist is consolidated as approved rules at startup', async () => {
  const { candidates } = await getCandidates();
  assert.equal(candidates.length, 129);
  assert.equal(new Set(candidates.map(candidate => candidate.domain)).size, 129);
  assert.equal(candidates.length, ADULT_CANDIDATES.length + GAMBLING_CANDIDATES.length);
  assert.equal(GAMBLING_CANDIDATES.length, 6);

  const initial = {
    rules: [],
    pendingRules: [],
    candidateList: [],
    candidateListApproved: false,
    candidateListApprovedAt: null,
  };
  const started = applyApprovedDomains(initial, candidates, 1234);

  assert.equal(started.rules.length, 129);
  assert.ok(started.rules.every(rule => rule.source === 'preset' && rule.type === 'domain'));
  assert.deepEqual(started.candidateList, []);
  assert.equal(started.candidateListApproved, true);
  assert.equal(started.candidateListApprovedAt, 1234);
});

test('previously approved initial domains remain active without reappearing as proposals', async () => {
  const { candidates } = await getCandidates();
  const existingRules = candidates.map(({ domain, categories }) => ({
    id: `preset:${domain}`,
    type: 'domain',
    host: domain,
    path: '/',
    source: 'preset',
    categories,
  }));
  const previous = {
    rules: existingRules,
    pendingRules: [],
    candidateList: [],
    candidateListApproved: true,
    candidateListApprovedAt: null,
  };

  const started = applyApprovedDomains(previous, candidates, 5678);

  assert.equal(started.rules.length, 129);
  assert.deepEqual(started.rules, existingRules);
  assert.deepEqual(started.candidateList, []);
  assert.equal(started.candidateListApproved, true);
});

test('domains saved as old proposals are approved during migration and deduplicated', () => {
  const previous = {
    rules: [{ id: 'custom:existing.example', type: 'domain', host: 'existing.example', path: '/', source: 'user' }],
    pendingRules: [
      { id: 'pending-domain', type: 'domain', host: 'new.example', path: '/' },
      { id: 'pending-path', type: 'path', host: 'path.example', path: '/profile' },
    ],
    candidateList: [{ domain: 'new.example', categories: ['adult'] }],
    candidateListApproved: false,
    candidateListApprovedAt: null,
  };

  const started = applyApprovedDomains(previous, [
    { domain: 'new.example', categories: ['adult', 'gambling'] },
    { domain: 'existing.example', categories: ['adult'] },
  ], 9012);

  assert.deepEqual(started.rules, [
    previous.rules[0],
    { id: 'preset:new.example', type: 'domain', host: 'new.example', path: '/', source: 'preset', categories: ['adult', 'gambling'] },
  ]);
  assert.deepEqual(started.pendingRules, [previous.pendingRules[1]]);
  assert.deepEqual(started.candidateList, []);
  assert.equal(started.candidateListApproved, true);
  assert.equal(started.candidateListApprovedAt, 9012);
});
