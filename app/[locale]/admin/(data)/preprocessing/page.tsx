/**
 * Preprocessing Admin Page
 *
 * Server component for preprocessing monitoring UI (Owner-only).
 * Displays queue stats, throughput, quality metrics, error logs, and controls.
 *
 * @see doc/specs/completed/DATA_PREPROCESSING.md
 * @see uiux_refactor.md §6.4.2 item 4
 */
import { redirect } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from 'next-intl/server';

import { createClient } from '@/lib/infrastructure/supabase/server';
import { isOwner } from "@/lib/modules/auth";
import {
  getPreprocessingMonitoringStats,
  getQualityMetrics,
  getAllConfigs,
} from "@/lib/modules/preprocessing/io";

import { PreprocessingClient } from "./PreprocessingClient";

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function PreprocessingPage({ params }: Props) {
  const { locale: routeLocale } = await params;
  const supabase = await createClient();

  // Owner-only gate
  const owner = await isOwner(supabase);
  if (!owner) {
    redirect(`/${routeLocale}`);
  }

  // Fetch initial data
  const [monitoringStats, qualityMetrics, configs] = await Promise.all([
    getPreprocessingMonitoringStats(10),
    getQualityMetrics(),
    getAllConfigs(),
  ]);

  const messages = await getMessages({ locale: routeLocale });

  const initialData = {
    queue: monitoringStats.queue,
    throughput: monitoringStats.throughput,
    errorLogs: monitoringStats.errorLogs,
    qualityMetrics,
    configs,
  };

  return (
    <NextIntlClientProvider locale={routeLocale} messages={messages}>
      <PreprocessingClient initialData={initialData} />
    </NextIntlClientProvider>
  );
}
