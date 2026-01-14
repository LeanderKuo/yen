/**
 * Safety Corpus Embedding Tests
 * @see lib/modules/embedding/embedding-pure.ts
 * @see safety-risk-engine-spec.md §9
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
    composeSafetyCorpusContent,
    composeEmbeddingContent,
    prepareContentForEmbedding,
} from '@/lib/modules/embedding/embedding-pure';
import type { SafetyCorpusEmbeddingData } from '@/lib/types/embedding';

// ─────────────────────────────────────────────────────────────────────────────
// Safety Corpus Content Composition Tests
// ─────────────────────────────────────────────────────────────────────────────

test('composeSafetyCorpusContent combines label and content', () => {
    const data: SafetyCorpusEmbeddingData = {
        label: 'Test Slang Term',
        content: 'This is the definition and context for the slang term.',
    };
    const result = composeSafetyCorpusContent(data);
    assert.ok(result.includes('Test Slang Term'));
    assert.ok(result.includes('This is the definition'));
    // Should have separator between label and content
    assert.ok(result.includes('\n\n'));
});

test('composeSafetyCorpusContent normalizes whitespace', () => {
    const data: SafetyCorpusEmbeddingData = {
        label: 'Label  with   spaces',
        content: 'Content\n\n\n\nwith   extra   whitespace',
    };
    const result = composeSafetyCorpusContent(data);
    // normalizeWhitespace should collapse extra newlines and spaces
    assert.ok(!result.includes('   '));
    assert.ok(!result.includes('\n\n\n'));
});

test('composeEmbeddingContent routes safety_slang to safety composition', () => {
    const data: SafetyCorpusEmbeddingData = {
        label: 'Slang Term',
        content: 'Slang definition',
    };
    const result = composeEmbeddingContent('safety_slang', data);
    assert.ok(result.includes('Slang Term'));
    assert.ok(result.includes('Slang definition'));
});

test('composeEmbeddingContent routes safety_case to safety composition', () => {
    const data: SafetyCorpusEmbeddingData = {
        label: 'Historical Case',
        content: 'Case description and context',
    };
    const result = composeEmbeddingContent('safety_case', data);
    assert.ok(result.includes('Historical Case'));
    assert.ok(result.includes('Case description'));
});

test('prepareContentForEmbedding works with safety_slang type', () => {
    const data: SafetyCorpusEmbeddingData = {
        label: 'Test Label',
        content: 'Test content for embedding',
    };
    const result = prepareContentForEmbedding('safety_slang', data);
    assert.ok(result.content.includes('Test Label'));
    assert.ok(result.content.includes('Test content'));
    assert.equal(result.contentHash.length, 64); // SHA256 hex
    assert.equal(result.truncated, false);
});

test('prepareContentForEmbedding works with safety_case type', () => {
    const data: SafetyCorpusEmbeddingData = {
        label: 'Case Label',
        content: 'Case content description',
    };
    const result = prepareContentForEmbedding('safety_case', data);
    assert.ok(result.content.includes('Case Label'));
    assert.equal(result.truncated, false);
});
