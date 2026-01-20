'use client';

/**
 * HeroStageClient - Interactive hero stage with hotspots
 *
 * Client component that manages hotspot selection state and renders
 * the artwork stage with interactive pins, modal, and fallback list.
 *
 * @see doc/specs/proposed/GALLERY_HERO_IMAGE_AND_HOTSPOTS.md (FR-4, FR-5)
 */

import { useState, useCallback } from 'react';
import Image from 'next/image';
import { HotspotOverlay } from '@/components/hotspots/HotspotOverlay';
import { HotspotModalCard } from '@/components/hotspots/HotspotModalCard';
import { HotspotFallbackList } from '@/components/hotspots/HotspotFallbackList';
import type { GalleryHotspotPublic } from '@/lib/types/gallery';

interface HotspotWithHtml extends GalleryHotspotPublic {
  description_html: string;
}

interface HeroStageClientProps {
  /** Hero image URL */
  imageUrl: string;
  /** Hero image alt text */
  imageAlt: string;
  /** Image width */
  imageWidth: number;
  /** Image height */
  imageHeight: number;
  /** Hotspots with pre-rendered HTML */
  hotspots: HotspotWithHtml[];
}

export function HeroStageClient({
  imageUrl,
  imageAlt,
  imageWidth,
  imageHeight,
  hotspots,
}: HeroStageClientProps) {
  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(null);

  const selectedHotspot = hotspots.find(h => h.id === selectedHotspotId) || null;

  const handleSelectHotspot = useCallback((id: string) => {
    setSelectedHotspotId(id);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedHotspotId(null);
  }, []);

  return (
    <div className="relative">
      {/* Artwork Stage with blob mask */}
      <div
        className="relative overflow-hidden bg-gradient-to-br from-[#F5F2EA] to-[#E8E4DA] shadow-[0_4px_24px_rgba(0,0,0,0.08)]"
        style={{
          borderRadius: '48% 52% 51% 49% / 45% 53% 47% 55%',
        }}
      >
        {/* Paper texture overlay */}
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='200' height='200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' /%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23noise)' opacity='0.5' /%3E%3C/svg%3E")`,
            backgroundSize: '150px 150px',
          }}
        />

        {/* Hotspot Overlay with Image */}
        <HotspotOverlay
          hotspots={hotspots}
          activeHotspotId={selectedHotspotId}
          onSelectHotspot={handleSelectHotspot}
          className="aspect-[4/3]"
        >
          <Image
            src={imageUrl}
            alt={imageAlt}
            width={imageWidth}
            height={imageHeight}
            className="w-full h-full object-cover"
            priority
          />
        </HotspotOverlay>
      </div>

      {/* Fallback List (below artwork stage) */}
      {hotspots.length > 0 && (
        <div className="mt-6">
          <HotspotFallbackList
            hotspots={hotspots}
            activeHotspotId={selectedHotspotId}
            onSelectHotspot={handleSelectHotspot}
            toggleLabel="媒材詳情"
          />
        </div>
      )}

      {/* Modal Card */}
      {selectedHotspot && (
        <HotspotModalCard
          hotspot={selectedHotspot}
          descriptionHtml={selectedHotspot.description_html}
          isOpen={true}
          onClose={handleCloseModal}
          labels={{
            close: '關閉',
            readMore: '延伸閱讀',
            usageAndTexture: '使用與質地',
            symbolism: '象徵意義',
          }}
        />
      )}
    </div>
  );
}

export default HeroStageClient;
