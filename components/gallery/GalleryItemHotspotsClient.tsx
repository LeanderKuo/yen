'use client';

/**
 * GalleryItemHotspotsClient - Client wrapper for gallery item hotspots
 *
 * Manages hotspot interaction state and renders the overlay, modal, and fallback list.
 * Receives pre-rendered markdown HTML from server to avoid client-side markdown processing.
 *
 * @see doc/specs/proposed/GALLERY_HERO_IMAGE_AND_HOTSPOTS.md (FR-7)
 */

import { useState, useCallback, useMemo, type ReactNode } from 'react';
import { HotspotOverlay, HotspotModalCard, HotspotFallbackList } from '@/components/hotspots';
import type { GalleryHotspotPublic } from '@/lib/types/gallery';

/** Hotspot with pre-rendered HTML */
export interface HotspotWithHtml extends GalleryHotspotPublic {
  description_html: string;
}

interface GalleryItemHotspotsClientProps {
  /** Hotspots with pre-rendered markdown HTML */
  hotspots: HotspotWithHtml[];
  /** The image element to render inside the overlay */
  children: ReactNode;
  /** i18n labels */
  labels: {
    viewMaterialsList: string;
    close: string;
    readMore: string;
    usageAndTexture: string;
    symbolism: string;
  };
  /** Optional CSS class for the container */
  className?: string;
}

export function GalleryItemHotspotsClient({
  hotspots,
  children,
  labels,
  className = '',
}: GalleryItemHotspotsClientProps) {
  const [activeHotspotId, setActiveHotspotId] = useState<string | null>(null);

  // Find the active hotspot data
  const activeHotspot = useMemo(() => {
    if (!activeHotspotId) return null;
    return hotspots.find((h) => h.id === activeHotspotId) || null;
  }, [activeHotspotId, hotspots]);

  // Handler for selecting a hotspot (from pin or list)
  const handleSelectHotspot = useCallback((id: string) => {
    setActiveHotspotId(id);
  }, []);

  // Handler for closing the modal
  const handleCloseModal = useCallback(() => {
    setActiveHotspotId(null);
  }, []);

  // If no hotspots, just render the image without overlay
  if (hotspots.length === 0) {
    return <div className={className}>{children}</div>;
  }

  return (
    <>
      {/* Image with hotspot pins overlay */}
      <HotspotOverlay
        hotspots={hotspots}
        activeHotspotId={activeHotspotId}
        onSelectHotspot={handleSelectHotspot}
        className={className}
      >
        {children}
      </HotspotOverlay>

      {/* Fallback list for mobile/accessibility */}
      <div className="mt-4">
        <HotspotFallbackList
          hotspots={hotspots}
          activeHotspotId={activeHotspotId}
          onSelectHotspot={handleSelectHotspot}
          toggleLabel={labels.viewMaterialsList}
        />
      </div>

      {/* Modal card for hotspot details */}
      <HotspotModalCard
        hotspot={activeHotspot}
        descriptionHtml={activeHotspot?.description_html || ''}
        isOpen={!!activeHotspot}
        onClose={handleCloseModal}
        labels={{
          close: labels.close,
          readMore: labels.readMore,
          usageAndTexture: labels.usageAndTexture,
          symbolism: labels.symbolism,
        }}
      />
    </>
  );
}

export default GalleryItemHotspotsClient;
