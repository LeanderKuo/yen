import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatDateLocalized,
  formatDateShortLocalized,
  parseTagsString,
  joinTagsArray,
} from '../lib/modules/user/user-helpers.js';

// =============================================================================
// formatDateLocalized
// =============================================================================

test('formatDateLocalized formats date in zh-TW', () => {
  const dateStr = '2024-12-29T12:30:00Z';
  const result = formatDateLocalized(dateStr, 'zh');

  // zh-TW format uses different structure
  assert.ok(result.includes('2024'), 'Should include year');
  assert.ok(result.includes('29'), 'Should include day');
});

test('formatDateLocalized ignores locale and still uses zh-TW', () => {
  const dateStr = '2024-12-29T12:30:00Z';
  const result = formatDateLocalized(dateStr, 'en');

  assert.ok(result.includes('2024'), 'Should include year');
  assert.ok(result.includes('29'), 'Should include day');
  assert.ok(!result.includes('Dec'), 'Should not use English month');
});

// =============================================================================
// formatDateShortLocalized
// =============================================================================

test('formatDateShortLocalized formats date in zh-TW (no time)', () => {
  const dateStr = '2024-12-29T12:30:00Z';
  const result = formatDateShortLocalized(dateStr, 'zh');

  // zh-TW format uses different structure
  assert.ok(result.includes('2024'), 'Should include year');
  assert.ok(result.includes('29'), 'Should include day');
  // Should not include time components
  assert.ok(!result.includes(':'), 'Should NOT include time separator');
});

test('formatDateShortLocalized ignores locale and still uses zh-TW', () => {
  const dateStr = '2024-12-29T12:30:00Z';
  const result = formatDateShortLocalized(dateStr, 'en');

  assert.ok(result.includes('2024'), 'Should include year');
  assert.ok(result.includes('29'), 'Should include day');
  assert.ok(!result.includes('Dec'), 'Should not use English month');
});

// =============================================================================
// parseTagsString
// =============================================================================

test('parseTagsString parses comma-separated tags', () => {
  const result = parseTagsString('vip, premium, regular');
  assert.deepEqual(result, ['vip', 'premium', 'regular']);
});

test('parseTagsString trims whitespace', () => {
  const result = parseTagsString('  vip  ,  premium  ,  regular  ');
  assert.deepEqual(result, ['vip', 'premium', 'regular']);
});

test('parseTagsString removes empty entries', () => {
  const result = parseTagsString('vip, , , premium, , regular');
  assert.deepEqual(result, ['vip', 'premium', 'regular']);
});

test('parseTagsString dedupes tags', () => {
  const result = parseTagsString('vip, premium, vip, regular, premium');
  assert.deepEqual(result, ['vip', 'premium', 'regular']);
});

test('parseTagsString returns empty array for empty string', () => {
  assert.deepEqual(parseTagsString(''), []);
  assert.deepEqual(parseTagsString('   '), []);
});

test('parseTagsString handles single tag', () => {
  const result = parseTagsString('vip');
  assert.deepEqual(result, ['vip']);
});

// =============================================================================
// joinTagsArray
// =============================================================================

test('joinTagsArray joins tags with comma and space', () => {
  const result = joinTagsArray(['vip', 'premium', 'regular']);
  assert.equal(result, 'vip, premium, regular');
});

test('joinTagsArray returns empty string for empty array', () => {
  const result = joinTagsArray([]);
  assert.equal(result, '');
});

test('joinTagsArray handles single tag', () => {
  const result = joinTagsArray(['vip']);
  assert.equal(result, 'vip');
});
