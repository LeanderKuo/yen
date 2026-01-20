/**
 * Gallery Item Detail Page (Server Component)
 *
 * Admin page for viewing and editing a single gallery item.
 * Includes hotspots editor and hero selection.
 *
 * @see app/[locale]/admin/gallery/[id]/GalleryItemDetailClient.tsx
 */

import { notFound } from 'next/navigation';
import { getLocale, getMessages } from 'next-intl/server';
import { getGalleryItemByIdForAdmin } from '@/lib/modules/gallery/items-admin-io';
import { getAdminHotspotsByItemId, getHotspotsMaxLimit } from '@/lib/modules/gallery/hotspots-admin-io';
import { getHeroPin } from '@/lib/modules/gallery/pins-admin-io';
import GalleryItemDetailClient from './GalleryItemDetailClient';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function GalleryItemDetailPage({ params }: Props) {
  const { id } = await params;
  const locale = await getLocale();
  const messages = await getMessages();

  // Fetch gallery item
  const item = await getGalleryItemByIdForAdmin(id);

  if (!item) {
    notFound();
  }

  // Fetch hotspots and max limit
  const [hotspots, maxLimit, heroPin] = await Promise.all([
    getAdminHotspotsByItemId(id),
    getHotspotsMaxLimit(),
    getHeroPin(),
  ]);

  // Check if this item is the current hero
  const isCurrentHero = heroPin?.item_id === id;

  return (
    <GalleryItemDetailClient
      item={item}
      hotspots={hotspots}
      maxHotspots={maxLimit}
      isCurrentHero={isCurrentHero}
      locale={locale}
      messages={messages}
    />
  );
}
