import { Suspense } from 'react';
import { getLocale, getMessages } from 'next-intl/server';
import { NextIntlClientProvider } from 'next-intl';
import SafetyQueueClient from './SafetyQueueClient';

export default async function SafetyQueuePage() {
    const locale = await getLocale();
    const messages = await getMessages();

    return (
        <NextIntlClientProvider locale={locale} messages={messages}>
            <Suspense fallback={<div className="p-6">Loading...</div>}>
                <SafetyQueueClient />
            </Suspense>
        </NextIntlClientProvider>
    );
}
