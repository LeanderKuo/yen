/**
 * Admin Comment Settings Page (Server Component)
 * 
 * Renders the CommentSettingsClient component with locale and messages.
 * No 'use client' - keeps page as server component per ARCHITECTURE.md.
 * Uses route locale messages (single-language zh).
 */

import { getMessages } from 'next-intl/server';
import type { AbstractIntlMessages } from 'next-intl';
import CommentSettingsClient from './CommentSettingsClient';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function CommentSettingsPage({ params }: PageProps) {
  const { locale: routeLocale } = await params;
  
  const allMessages = await getMessages({ locale: routeLocale });
  const adminMessages = { admin: allMessages.admin } as AbstractIntlMessages;
  
  return (
    <CommentSettingsClient 
      routeLocale={routeLocale}
      messages={adminMessages}
    />
  );
}

