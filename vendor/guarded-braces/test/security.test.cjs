/* eslint-disable -- Vendored upstream CommonJS library; compatibility and security are checked by Node tests. */
const assert = require('node:assert/strict');
const test = require('node:test');
const braces = require('..');
const fixtures = require('./compatibility.json');

test('matches upstream braces 3.0.3 for ordinary patterns and options', () => {
  for (const { pattern, options, result } of fixtures) {
    assert.deepEqual(braces(pattern, options), result, JSON.stringify({ pattern, options }));
  }
});

test('rejects deeply nested brace and parenthesis patterns before stack exhaustion', () => {
  const patterns = ['{'.repeat(4000) + 'a,b' + '}'.repeat(4000), '{'.repeat(4000) + 'a', '('.repeat(4000) + 'x' + ')'.repeat(4000)];
  for (const pattern of patterns) {
    for (const fn of [braces, braces.parse, braces.compile, braces.expand, braces.stringify]) {
      assert.throws(() => fn(pattern), error => error instanceof RangeError && error.code === 'ERR_BRACES_DEPTH');
    }
    assert.throws(() => braces(pattern, { expand: true, maxDepth: Infinity }), { code: 'ERR_BRACES_DEPTH' });
  }
});

test('bounds recursive walkers for directly supplied ASTs, including cycles', () => {
  const root = { type: 'root', nodes: [] };
  let node = root;
  for (let i = 0; i < 8000; i++) {
    const child = { type: 'paren', nodes: [], parent: node };
    node.nodes.push(child);
    node = child;
  }
  node.nodes.push({ type: 'text', value: 'x' });
  for (const fn of [braces.compile, braces.expand, braces.stringify]) {
    assert.throws(() => fn(root), { code: 'ERR_BRACES_DEPTH' });
  }
  const cyclic = { type: 'root', nodes: [] };
  cyclic.nodes.push(cyclic);
  for (const fn of [braces.compile, braces.expand, braces.stringify]) {
    assert.throws(() => fn(cyclic), { code: 'ERR_BRACES_DEPTH' });
  }
});

test('quoted literal braces remain valid even when text is long', () => {
  const pattern = '"' + '{'.repeat(1000) + 'a,b' + '}'.repeat(1000) + '"';
  assert.deepEqual(braces(pattern), [pattern.slice(1, -1)]);
});
