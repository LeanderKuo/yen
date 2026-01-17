import { Suspense } from 'react';
import { getLocale, getMessages } from 'next-intl/server';
import { NextIntlClientProvider } from 'next-intl';
import SafetyDetailClient from './SafetyDetailClient';

interface PageProps {
    params: Promise<{ commentId: string }>;
}

export default async function SafetyDetailPage({ params }: PageProps) {
    const { commentId } = await params;
    const locale = await getLocale();
    const messages = await getMessages();

    return (
        <NextIntlClientProvider locale={locale} messages={messages}>
            <Suspense fallback={<div className="p-6">載入中...</div>}>
                <SafetyDetailClient commentId={commentId} />
            </Suspense>
        </NextIntlClientProvider>
    );
}
