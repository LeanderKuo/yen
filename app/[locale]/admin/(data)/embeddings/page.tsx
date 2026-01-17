/**
 * Embeddings Admin Page
 *
 * Server component for embedding management UI (Owner-only).
 * Displays stats, queue status, and provides initialization/retry controls.
 *
 * @see doc/specs/completed/SUPABASE_AI.md §4.2
 * @see uiux_refactor.md §6.3.2 item 5
 */
import { redirect } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from 'next-intl/server';

import { createClient } from '@/lib/infrastructure/supabase/server';
import { isOwner } from "@/lib/modules/auth";
import {
  isSemanticSearchEnabled,
  getEmbeddingStats,
  getPendingQueueItems,
} from "@/lib/modules/embedding/io";

import { EmbeddingsClient } from "./EmbeddingsClient";

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function EmbeddingsPage({ params }: Props) {
  const { locale: routeLocale } = await params;
  const supabase = await createClient();

  // Owner-only gate
  const owner = await isOwner(supabase);
  if (!owner) {
    redirect(`/${routeLocale}`);
  }

  // Check feature availability
  const enabled = await isSemanticSearchEnabled();

  // Fetch initial data
  const [stats, queueItems] = await Promise.all([
    getEmbeddingStats(),
    getPendingQueueItems(10), // Show first 10 pending items
  ]);

  const messages = await getMessages({ locale: routeLocale });

  const initialData = {
    enabled,
    stats,
    queueItems,
  };

  return (
    <NextIntlClientProvider locale={routeLocale} messages={messages}>
      <EmbeddingsClient initialData={initialData} />
    </NextIntlClientProvider>
  );
}
