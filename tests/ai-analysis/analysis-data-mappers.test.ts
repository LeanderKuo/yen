/**
 * AI Analysis Data Mapper Tests
 *
 * Pure function tests for data shape mappers.
 *
 * @see lib/modules/ai-analysis/analysis-data-mappers.ts
 * @see uiux_refactor.md §6.2.2 - Data collection layer
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { mapCommentToAnalysisShape } from '../../lib/modules/ai-analysis/analysis-data-mappers';

describe('mapCommentToAnalysisShape', () => {
  it('maps comment to AI-safe shape', () => {
    const comment = {
      id: 'comment-1',
      target_type: 'post' as const,
      target_id: 'post-123',
      parent_id: null,
      content: 'Great article! Very helpful.',
      like_count: 5,
      is_approved: true,
      created_at: '2025-01-15T12:00:00Z',
    };

    const result = mapCommentToAnalysisShape(comment);

    assert.equal(result.id, 'comment-1');
    assert.equal(result.targetType, 'post');
    assert.equal(result.targetId, 'post-123');
    assert.equal(result.hasParent, false);
    assert.equal(result.content, 'Great article! Very helpful.');
    assert.equal(result.contentLength, 28);
    assert.equal(result.likeCount, 5);
    assert.equal(result.isApproved, true);
    assert.equal(result.createdAt, '2025-01-15T12:00:00Z');
  });

  it('handles reply comment (has parent)', () => {
    const comment = {
      id: 'comment-2',
      target_type: 'gallery_item' as const,
      target_id: 'gallery-456',
      parent_id: 'comment-1',
      content: 'Thanks!',
      like_count: 0,
      is_approved: true,
      created_at: '2025-01-15T12:30:00Z',
    };

    const result = mapCommentToAnalysisShape(comment);

    assert.equal(result.hasParent, true);
    assert.equal(result.targetType, 'gallery_item');
  });
});

describe('PII Exclusion Verification', () => {
  it('CommentAnalysisShape excludes user identity', () => {
    const comment = {
      id: 'comment-1',
      target_type: 'post' as const,
      target_id: 'post-1',
      parent_id: null,
      content: 'Test',
      like_count: 0,
      is_approved: true,
      created_at: '2025-01-01T00:00:00Z',
    };

    const result = mapCommentToAnalysisShape(comment);
    const keys = Object.keys(result);

    assert.ok(!keys.includes('userId'));
    assert.ok(!keys.includes('user_id'));
    assert.ok(!keys.includes('userEmail'));
    assert.ok(!keys.includes('userDisplayName'));
    assert.ok(!keys.includes('ipHash'));
    assert.ok(!keys.includes('ip_hash'));
  });
});
