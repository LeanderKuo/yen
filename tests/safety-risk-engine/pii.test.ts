/**
 * PII Redaction Tests
 *
 * Tests for lib/modules/safety-risk-engine/pii.ts
 *
 * @see lib/modules/safety-risk-engine/pii.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { redactPii, containsPii } from '../../lib/modules/safety-risk-engine/pii';

// =============================================================================
// redactPii Tests
// =============================================================================

describe('PII Redaction - redactPii', () => {
    describe('Email redaction', () => {
        it('redacts simple email addresses', () => {
            const result = redactPii('Contact me at test@example.com');
            assert.equal(result.text, 'Contact me at [EMAIL]');
            assert.equal(result.redactions.length, 1);
            assert.equal(result.redactions[0].type, 'email');
        });

        it('redacts multiple email addresses', () => {
            const result = redactPii('Email john@test.com or jane@example.org');
            assert.equal(result.text, 'Email [EMAIL] or [EMAIL]');
            assert.equal(result.redactions.length, 2);
        });

        it('redacts email with subdomain', () => {
            const result = redactPii('Use user@mail.example.co.uk');
            assert.equal(result.text, 'Use [EMAIL]');
        });

        it('redacts email with plus tag', () => {
            const result = redactPii('Send to user+tag@example.com');
            assert.equal(result.text, 'Send to [EMAIL]');
        });
    });

    describe('Phone redaction', () => {
        it('redacts Taiwan mobile number (no separator)', () => {
            const result = redactPii('Call 0912345678 now');
            assert.equal(result.text, 'Call [PHONE] now');
            assert.equal(result.redactions[0].type, 'phone');
        });

        it('redacts Taiwan mobile number (with dash)', () => {
            const result = redactPii('Phone: 0912-345-678');
            assert.equal(result.text, 'Phone: [PHONE]');
        });

        it('redacts Taiwan landline', () => {
            const result = redactPii('Office: 02-2345-6789');
            assert.equal(result.text, 'Office: [PHONE]');
        });

        it('redacts international format', () => {
            const result = redactPii('International: +886-912-345-678');
            assert.equal(result.text, 'International: [PHONE]');
        });

        it('redacts US format', () => {
            const result = redactPii('US number: 123-456-7890');
            assert.equal(result.text, 'US number: [PHONE]');
        });
    });

    describe('URL redaction', () => {
        it('redacts http URL', () => {
            const result = redactPii('Visit http://example.com');
            assert.equal(result.text, 'Visit [URL]');
            assert.equal(result.redactions[0].type, 'url');
        });

        it('redacts https URL', () => {
            const result = redactPii('Secure: https://example.com/path');
            assert.equal(result.text, 'Secure: [URL]');
        });

        it('redacts URL with query parameters', () => {
            const result = redactPii('Link: https://example.com/page?id=123&name=test');
            assert.equal(result.text, 'Link: [URL]');
        });
    });

    describe('Address redaction', () => {
        it('redacts Taiwan full address', () => {
            const result = redactPii('住址：台北市信義區松高路100號5樓');
            assert.equal(result.text, '住址：[ADDRESS]');
            assert.equal(result.redactions[0].type, 'address');
        });

        it('redacts partial address with street and number', () => {
            const result = redactPii('在中山路123號');
            assert.equal(result.text, '在[ADDRESS]');
        });
    });

    describe('Mixed content', () => {
        it('redacts multiple types of PII', () => {
            const result = redactPii('Email test@example.com or call 0912-345-678');
            assert.equal(result.text, 'Email [EMAIL] or call [PHONE]');
            assert.equal(result.redactions.length, 2);
        });

        it('handles text without PII', () => {
            const result = redactPii('This is a normal comment without any personal info');
            assert.equal(result.text, 'This is a normal comment without any personal info');
            assert.equal(result.redactions.length, 0);
        });

        it('handles empty string', () => {
            const result = redactPii('');
            assert.equal(result.text, '');
            assert.equal(result.redactions.length, 0);
        });

        it('handles null/undefined', () => {
            const result1 = redactPii(null as unknown as string);
            const result2 = redactPii(undefined as unknown as string);
            assert.equal(result1.text, '');
            assert.equal(result2.text, '');
        });
    });
});

// =============================================================================
// containsPii Tests
// =============================================================================

describe('PII Redaction - containsPii', () => {
    it('detects email', () => {
        assert.equal(containsPii('Contact test@example.com'), true);
    });

    it('detects phone', () => {
        assert.equal(containsPii('Call 0912-345-678'), true);
    });

    it('detects URL', () => {
        assert.equal(containsPii('Visit https://example.com'), true);
    });

    it('returns false for clean text', () => {
        assert.equal(containsPii('This is a normal comment'), false);
    });

    it('returns false for empty string', () => {
        assert.equal(containsPii(''), false);
    });
});
