'use client';

/**
 * HotspotModalCard - Modal card for displaying hotspot details
 *
 * Features:
 * - Backdrop with blur effect (click to close)
 * - Focus trap for accessibility
 * - ESC key to close
 * - Close button
 * - Markdown content rendered via server action
 * - Optional "延伸閱讀" CTA
 *
 * @see doc/specs/proposed/GALLERY_HERO_IMAGE_AND_HOTSPOTS.md (FR-5, FR-7, FR-7.1)
 */

import { useEffect, useRef, useCallback, type KeyboardEvent } from 'react';
import type { GalleryHotspotPublic } from '@/lib/types/gallery';

// Inline SVG icons to avoid external dependencies
function XIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

interface HotspotModalCardProps {
  /** Hotspot data to display */
  hotspot: GalleryHotspotPublic | null;
  /** Rendered HTML content (from hotspotsMarkdownToHtml) */
  descriptionHtml: string;
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** Labels for i18n */
  labels: {
    close: string;
    readMore: string;
    usageAndTexture: string;
    symbolism: string;
  };
}

export function HotspotModalCard({
  hotspot,
  descriptionHtml,
  isOpen,
  onClose,
  labels,
}: HotspotModalCardProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Focus trap and keyboard handling
  useEffect(() => {
    if (!isOpen) return;

    // Store the currently focused element to restore later
    previousActiveElement.current = document.activeElement as HTMLElement;

    // Focus the close button when modal opens
    const timer = setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 50);

    return () => clearTimeout(timer);
  }, [isOpen]);

  // Restore focus when modal closes
  useEffect(() => {
    if (!isOpen && previousActiveElement.current) {
      previousActiveElement.current.focus();
    }
  }, [isOpen]);

  // ESC key to close
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }

      // Focus trap
      if (event.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (event.shiftKey && document.activeElement === firstElement) {
          event.preventDefault();
          lastElement?.focus();
        } else if (!event.shiftKey && document.activeElement === lastElement) {
          event.preventDefault();
          firstElement?.focus();
        }
      }
    },
    [onClose]
  );

  // Don't render if no hotspot or not open
  if (!hotspot || !isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="hotspot-modal-title"
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-foreground/20 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Card */}
      <div
        ref={modalRef}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-md animate-in zoom-in-95 fade-in duration-200"
      >
        <div className="bg-surface/95 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden border border-primary/20">
          <div className="p-6 md:p-8">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <h3
                id="hotspot-modal-title"
                className="text-xl font-medium text-foreground pr-8"
              >
                {hotspot.media}
              </h3>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={onClose}
                className="p-1 rounded-full hover:bg-primary/10 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label={labels.close}
              >
                <XIcon className="w-5 h-5 text-secondary" />
              </button>
            </div>

            {/* Content */}
            <div className="space-y-4">
              {/* Preview (one-line summary) */}
              {hotspot.preview && (
                <p className="text-secondary italic">{hotspot.preview}</p>
              )}

              {/* Description (Markdown rendered) */}
              <div>
                <h4 className="text-sm uppercase tracking-wider text-tertiary mb-2">
                  {labels.usageAndTexture}
                </h4>
                <div
                  className="text-foreground leading-relaxed prose prose-sm dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: descriptionHtml }}
                />
              </div>

              {/* Symbolism */}
              {hotspot.symbolism && (
                <div>
                  <h4 className="text-sm uppercase tracking-wider text-tertiary mb-2">
                    {labels.symbolism}
                  </h4>
                  <p className="text-foreground leading-relaxed">
                    {hotspot.symbolism}
                  </p>
                </div>
              )}
            </div>

            {/* Read More CTA */}
            {hotspot.read_more_url && (
              <a
                href={hotspot.read_more_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors duration-200 focus:outline-none focus-visible:underline"
              >
                <span>{labels.readMore}</span>
                <ExternalLinkIcon className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default HotspotModalCard;
