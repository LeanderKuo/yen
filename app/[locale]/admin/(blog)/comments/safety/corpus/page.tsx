import { Suspense } from 'react';
import { getLocale, getMessages } from 'next-intl/server';
import { NextIntlClientProvider } from 'next-intl';
import SafetyCorpusClient from './SafetyCorpusClient';

export default async function SafetyCorpusPage() {
    const locale = await getLocale();
    const messages = await getMessages();

    return (
        <NextIntlClientProvider locale={locale} messages={messages}>
            <Suspense fallback={<div className="p-6">載入中...</div>}>
                <SafetyCorpusClient />
            </Suspense>
        </NextIntlClientProvider>
    );
}
