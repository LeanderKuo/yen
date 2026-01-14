'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import {
    fetchAssessmentByCommentAction,
    labelDetailAssessmentAction,
    approveDetailCommentAction,
    rejectDetailCommentAction,
    promoteDetailToCorpusAction,
} from './actions';
import type { SafetyAssessmentDetail, SafetyHumanLabel, SafetyCorpusKind } from '@/lib/types/safety-risk-engine';

interface SafetyDetailClientProps {
    commentId: string;
}

export default function SafetyDetailClient({ commentId }: SafetyDetailClientProps) {
    const t = useTranslations('admin.safety');
    const router = useRouter();

    const [assessment, setAssessment] = useState<SafetyAssessmentDetail | null>(null);
    const [commentContent, setCommentContent] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [showPromoteModal, setShowPromoteModal] = useState(false);
    const [promoteText, setPromoteText] = useState('');
    const [promoteLabel, setPromoteLabel] = useState('');
    const [promoteKind, setPromoteKind] = useState<SafetyCorpusKind>('slang');

    useEffect(() => {
        async function fetchData() {
            try {
                const result = await fetchAssessmentByCommentAction(commentId);
                setAssessment(result.assessment);
                setCommentContent(result.comment?.content || '');
            } catch (error) {
                console.error('Failed to fetch assessment:', error);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [commentId]);

    const handleLabel = async (label: SafetyHumanLabel) => {
        if (!assessment) return;
        const result = await labelDetailAssessmentAction(assessment.id, label);
        if (result.success) {
            setAssessment(prev => prev ? { ...prev, humanLabel: label } : null);
        }
    };

    const handleApprove = async () => {
        const result = await approveDetailCommentAction(commentId);
        if (result.success) {
            router.push('/admin/comments/safety');
        }
    };

    const handleReject = async () => {
        if (!confirm('Are you sure you want to reject this comment?')) return;
        const result = await rejectDetailCommentAction(commentId);
        if (result.success) {
            router.push('/admin/comments/safety');
        }
    };

    const handlePromoteToCorpus = async () => {
        if (!promoteText || !promoteLabel) return;
        const result = await promoteDetailToCorpusAction({
            text: promoteText,
            label: promoteLabel,
            kind: promoteKind,
            activate: false,
        });
        if (result.success) {
            setShowPromoteModal(false);
            setPromoteText('');
            setPromoteLabel('');
            alert('Added to corpus as draft');
        }
    };

    const getRiskBadgeColor = (level: string | null) => {
        switch (level) {
            case 'high': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
            case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
            case 'low': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
            default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6 max-w-4xl mx-auto">
            {/* Back button */}
            <button
                onClick={() => router.push('/admin/comments/safety')}
                className="flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Queue
            </button>

            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('detail.title')}</h1>
            </div>

            {/* Original Content */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('detail.originalContent')}</h2>
                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{commentContent}</p>
                </div>
            </div>

            {assessment && (
                <>
                    {/* Assessment Layers */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Layer 1 */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">{t('detail.layer1Hit')}</h3>
                            {assessment.layer1Hit ? (
                                <span className="inline-flex px-2 py-1 text-sm font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 rounded">
                                    {assessment.layer1Hit}
                                </span>
                            ) : (
                                <span className="text-gray-400">None</span>
                            )}
                        </div>

                        {/* Layer 2 - RAG Context */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">{t('detail.layer2Context')}</h3>
                            {assessment.layer2Context && assessment.layer2Context.length > 0 ? (
                                <div className="space-y-2">
                                    {assessment.layer2Context.map((ctx, i) => (
                                        <div key={i} className="text-sm">
                                            <span className="font-medium">{ctx.label}</span>
                                            <span className="text-gray-500 ml-2">({(ctx.score * 100).toFixed(0)}%)</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <span className="text-gray-400">None</span>
                            )}
                        </div>

                        {/* Layer 3 - AI Result */}
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">{t('detail.layer3Result')}</h3>
                            <div className="space-y-2">
                                <div>
                                    <span className={`inline-flex px-2 py-1 text-sm font-medium rounded ${getRiskBadgeColor(assessment.aiRiskLevel)}`}>
                                        {assessment.aiRiskLevel || 'N/A'}
                                    </span>
                                </div>
                                {assessment.confidence !== null && (
                                    <div className="text-sm text-gray-600 dark:text-gray-400">
                                        {t('detail.confidence')}: {(assessment.confidence * 100).toFixed(0)}%
                                    </div>
                                )}
                                {assessment.latencyMs && (
                                    <div className="text-sm text-gray-600 dark:text-gray-400">
                                        {t('detail.latency')}: {assessment.latencyMs}ms
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* AI Reason */}
                    {assessment.aiReason && (
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">{t('detail.reason')}</h3>
                            <p className="text-gray-900 dark:text-white">{assessment.aiReason}</p>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Actions</h3>

                        {/* Main Actions */}
                        <div className="flex flex-wrap gap-3 mb-6">
                            <button
                                onClick={handleApprove}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                            >
                                {t('actions.approve')}
                            </button>
                            <button
                                onClick={handleReject}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                            >
                                {t('actions.reject')}
                            </button>
                            <button
                                onClick={() => {
                                    setPromoteText(commentContent);
                                    setShowPromoteModal(true);
                                }}
                                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                            >
                                {t('actions.promoteToCorpus')}
                            </button>
                        </div>

                        {/* Label Actions */}
                        <div>
                            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">{t('actions.label')}</h4>
                            <div className="flex flex-wrap gap-2">
                                {(['True_Positive', 'False_Positive', 'True_Negative', 'False_Negative'] as SafetyHumanLabel[]).map((label) => (
                                    <button
                                        key={label}
                                        onClick={() => handleLabel(label)}
                                        className={`px-3 py-1 text-sm rounded-full border ${
                                            assessment.humanLabel === label
                                                ? 'bg-blue-600 text-white border-blue-600'
                                                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                                        }`}
                                    >
                                        {t(`labels.${label.toLowerCase().replace('_', '') as 'truePositive' | 'falsePositive' | 'trueNegative' | 'falseNegative'}`)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Promote Modal */}
            {showPromoteModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('actions.promoteToCorpus')}</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('corpus.content')}</label>
                                <textarea
                                    value={promoteText}
                                    onChange={(e) => setPromoteText(e.target.value)}
                                    rows={3}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('corpus.label')}</label>
                                <input
                                    type="text"
                                    value={promoteLabel}
                                    onChange={(e) => setPromoteLabel(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('corpus.kind')}</label>
                                <select
                                    value={promoteKind}
                                    onChange={(e) => setPromoteKind(e.target.value as SafetyCorpusKind)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                                >
                                    <option value="slang">{t('corpus.slang')}</option>
                                    <option value="case">{t('corpus.case')}</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => setShowPromoteModal(false)}
                                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handlePromoteToCorpus}
                                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                            >
                                Add to Corpus
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
