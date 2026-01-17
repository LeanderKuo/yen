/**
 * Admin Reports Page (Server Component)
 *
 * Server-first pattern: fetches initial data on the server
 * and delegates interactive UI to the client component.
 */

import { getRecentReports } from '@/lib/modules/reports/admin-io';
import { getMessages } from 'next-intl/server';
import type { AbstractIntlMessages } from 'next-intl';
import ReportsClient from './ReportsClient';

export default async function ReportsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const allMessages = await getMessages({ locale });
  const messages = { admin: allMessages.admin } as AbstractIntlMessages;

  // Fetch initial data on the server
  const initialReports = await getRecentReports(50);

  return (
    <ReportsClient
      initialReports={initialReports}
      routeLocale={locale}
      messages={messages}
    />
  );
}
