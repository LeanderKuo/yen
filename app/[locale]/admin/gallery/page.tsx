/**
 * Admin Gallery Items Page (Server Component)
 *
 * Displays gallery items with server-side data fetching.
 * Client component handles CRUD operations via server actions.
 */
import { getAllGalleryItemsForAdmin, getAllGalleryCategories } from '@/lib/modules/gallery/admin-io';
import { getMessages } from 'next-intl/server';
import type { AbstractIntlMessages } from 'next-intl';
import GalleryClient from './GalleryClient';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function GalleryItemsPage({ params }: PageProps) {
  const { locale: routeLocale } = await params;

  // Single-language admin UI: use route locale for messages
  const allMessages = await getMessages({ locale: routeLocale });
  const adminMessages = { admin: allMessages.admin } as AbstractIntlMessages;

  // Server-side data fetching
  const [items, categories] = await Promise.all([
    getAllGalleryItemsForAdmin(),
    getAllGalleryCategories(),
  ]);

  return (
    <GalleryClient
      initialItems={items}
      initialCategories={categories}
      routeLocale={routeLocale}
      messages={adminMessages}
    />
  );
}

