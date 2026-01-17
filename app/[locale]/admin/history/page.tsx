/**
 * Admin History Page (Server Component)
 *
 * Displays content modification history with server-side data fetching.
 * Client component handles filtering and restore actions.
 */
import { getAllRecentHistory } from '@/lib/modules/content/io';
import { getMessages } from 'next-intl/server';
import type { AbstractIntlMessages } from 'next-intl';
import HistoryClient from './HistoryClient';

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ type?: string; id?: string }>;
}

export default async function HistoryPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const query = await searchParams;

  const allMessages = await getMessages({ locale });
  const messages = { admin: allMessages.admin } as AbstractIntlMessages;

  // Server-side data fetching
  const history = await getAllRecentHistory(100);

  return (
    <HistoryClient
      initialHistory={history}
      routeLocale={locale}
      messages={messages}
      query={query}
    />
  );
}
