/**
 * Admin Comments Page (Server Component)
 * 
 * Renders the CommentsClient component with locale and searchParams.
 * No 'use client' - keeps page as server component per ARCHITECTURE.md.
 * Uses route locale messages (single-language zh).
 */

import { getMessages } from 'next-intl/server';
import type { AbstractIntlMessages } from 'next-intl';
import CommentsClient from './CommentsClient';

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    status?: string;
    search?: string;
    page?: string;
  }>;
}

export default async function CommentsPage({ params, searchParams }: PageProps) {
  const { locale: routeLocale } = await params;
  const resolvedSearchParams = await searchParams;
  
  const allMessages = await getMessages({ locale: routeLocale });
  const adminMessages = { admin: allMessages.admin } as AbstractIntlMessages;
  
  return (
    <CommentsClient 
      routeLocale={routeLocale}
      searchParams={resolvedSearchParams}
      messages={adminMessages}
    />
  );
}

