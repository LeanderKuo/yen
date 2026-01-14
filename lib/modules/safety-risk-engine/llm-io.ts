/**
 * Safety Risk Engine - LLM IO Module
 *
 * Server-only module for Layer 3 LLM safety assessment.
 * Uses OpenRouter chat completion with strict timeout.
 *
 * @see doc/specs/proposed/safety-risk-engine-spec.md §3 (Layer 3)
 * @see ARCHITECTURE.md §3.13 - OpenRouter API boundaries
 */
import 'server-only';

import { runChatCompletion, isChatCompletionConfigured } from '@/lib/infrastructure/openrouter/openrouter-chat-io';
import { redactPii } from '@/lib/modules/safety-risk-engine/pii';
import { getSafetyPromptMessages, parseSafetyLlmResponse } from '@/lib/modules/safety-risk-engine/prompt';
import type { SafetyRagContext, SafetyLlmResponse, SafetyEngineSettings } from '@/lib/types/safety-risk-engine';

// =============================================================================
// Constants
// =============================================================================

/**
 * Maximum timeout for safety LLM calls.
 * Total latency budget is 2000ms; reserve some for other operations.
 */
const MAX_LLM_TIMEOUT_MS = 1500;

/**
 * Temperature for safety assessment.
 * Lower temperature for more consistent, deterministic responses.
 */
const SAFETY_TEMPERATURE = 0.3;

/**
 * Max tokens for safety assessment response.
 * JSON response should be small (<100 tokens typically).
 */
const SAFETY_MAX_TOKENS = 256;

// =============================================================================
// Types
// =============================================================================

/**
 * Input for LLM safety assessment.
 */
export interface SafetyLlmInput {
    /** Original comment content (will be PII-redacted). */
    comment: string;

    /** RAG context from Layer 2 search. */
    ragContext: SafetyRagContext[];

    /** Safety settings (for model and timeout). */
    settings: SafetyEngineSettings;
}

/**
 * Result from LLM safety assessment.
 */
export interface SafetyLlmAssessmentResult {
    /** Whether the LLM call and parse succeeded. */
    success: boolean;

    /** Parsed LLM response (if successful). */
    response?: SafetyLlmResponse;

    /** Model actually used. */
    model?: string;

    /** LLM call latency in milliseconds. */
    latencyMs?: number;

    /** Error message (if failed). */
    error?: string;

    /** Redacted text that was sent to LLM. */
    redactedText?: string;
}

// =============================================================================
// LLM Assessment
// =============================================================================

/**
 * Run safety LLM assessment on comment.
 *
 * Applies PII redaction, composes prompt with RAG context,
 * calls OpenRouter LLM, and parses the response.
 *
 * Implements Fail Closed: parse failures or timeouts return
 * { success: false } so caller can apply HELD decision.
 *
 * @param input - Comment, RAG context, and settings
 * @returns Assessment result with success/failure status
 *
 * @example
 * ```typescript
 * const result = await runSafetyLlmAssessment({
 *   comment: 'user comment text',
 *   ragContext: [...],
 *   settings: await getSafetySettings(),
 * });
 *
 * if (result.success && result.response) {
 *   // Use result.response.risk_level, confidence, reason
 * } else {
 *   // Fail Closed: apply HELD decision
 * }
 * ```
 */
export async function runSafetyLlmAssessment(
    input: SafetyLlmInput
): Promise<SafetyLlmAssessmentResult> {
    const { comment, ragContext, settings } = input;

    // Check if OpenRouter is configured
    if (!isChatCompletionConfigured()) {
        return {
            success: false,
            error: 'OpenRouter API not configured',
        };
    }

    // Step 1: Apply PII redaction
    const piiResult = redactPii(comment);
    const redactedText = piiResult.text;

    // Step 2: Compose prompt with RAG context
    const messages = getSafetyPromptMessages(redactedText, ragContext);

    // Step 3: Calculate timeout (use min of settings and max)
    const timeoutMs = Math.min(settings.timeoutMs, MAX_LLM_TIMEOUT_MS);

    // Step 4: Call LLM
    const startTime = Date.now();

    try {
        const chatResult = await runChatCompletion({
            messages,
            model: settings.modelId,
            timeoutMs,
            temperature: SAFETY_TEMPERATURE,
            maxTokens: SAFETY_MAX_TOKENS,
        });

        const latencyMs = Date.now() - startTime;

        // Check for LLM call failure
        if (!chatResult.success || !chatResult.content) {
            return {
                success: false,
                error: chatResult.error ?? 'LLM returned empty response',
                latencyMs,
                redactedText,
            };
        }

        // Step 5: Parse LLM response
        const parsedResponse = parseSafetyLlmResponse(chatResult.content);

        if (!parsedResponse) {
            return {
                success: false,
                error: 'Failed to parse LLM response as valid JSON',
                model: chatResult.model,
                latencyMs,
                redactedText,
            };
        }

        // Success: return parsed response
        return {
            success: true,
            response: parsedResponse,
            model: chatResult.model,
            latencyMs,
            redactedText,
        };
    } catch (error) {
        const latencyMs = Date.now() - startTime;
        return {
            success: false,
            error: `LLM assessment error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            latencyMs,
            redactedText,
        };
    }
}

/**
 * Check if LLM safety assessment is available.
 *
 * @returns True if OpenRouter API is configured
 */
export function isLlmAssessmentAvailable(): boolean {
    return isChatCompletionConfigured();
}
