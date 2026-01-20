'use client';

/**
 * SideNavClient - Slide-out navigation panel with accordion groups
 *
 * Client component for the hamburger menu navigation panel.
 * Slides out from left, displays groups with accordion items.
 *
 * @see doc/specs/proposed/GALLERY_HERO_IMAGE_AND_HOTSPOTS.md (FR-9)
 */

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import type { ResolvedHamburgerNav, ResolvedNavGroup, ResolvedNavItem } from '@/lib/types/hamburger-nav';

interface SideNavClientProps {
  /** Whether the nav panel is open */
  isOpen: boolean;
  /** Callback to close the panel */
  onClose: () => void;
  /** Resolved navigation data */
  nav: ResolvedHamburgerNav;
  /** Current locale */
  locale: string;
}

export function SideNavClient({ isOpen, onClose, nav }: SideNavClientProps) {
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroup(prev => (prev === groupId ? null : groupId));
  }, []);

  const renderNavItem = (item: ResolvedNavItem) => {
    const linkProps = item.isExternal
      ? {
          href: item.href,
          target: '_blank' as const,
          rel: 'noopener noreferrer',
        }
      : { href: item.href };

    const LinkComponent = item.isExternal ? 'a' : Link;

    return (
      <LinkComponent
        key={item.id}
        {...linkProps}
        onClick={onClose}
        className="block py-2 text-sm text-[#6B6B6B] hover:text-[#F3AE69] transition-colors duration-200"
      >
        {item.label}
        {item.isExternal && (
          <svg
            className="inline-block w-3 h-3 ml-1 opacity-50"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
        )}
      </LinkComponent>
    );
  };

  const renderNavGroup = (group: ResolvedNavGroup) => {
    const isExpanded = expandedGroup === group.id;

    return (
      <div key={group.id} className="border-b border-[#E5E1D9] last:border-0">
        <button
          onClick={() => toggleGroup(group.id)}
          className="w-full flex items-center justify-between py-4 text-left group hover:text-[#F3AE69] transition-colors duration-200"
          aria-expanded={isExpanded}
        >
          <span className="text-base text-[#4A4A4A] group-hover:text-[#F3AE69] transition-colors duration-200">
            {group.label}
          </span>
          <svg
            className={`w-5 h-5 text-[#6B6B6B] group-hover:text-[#F3AE69] transition-all duration-200 ${
              isExpanded ? 'rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {/* Accordion Content */}
        <div
          className={`overflow-hidden transition-all duration-200 ease-out ${
            isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="pb-4 pl-4 space-y-1">
            {group.items.map(renderNavItem)}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-40 bg-[#4A4A4A]/20 backdrop-blur-sm transition-opacity duration-200 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Side Panel */}
      <aside
        className={`fixed left-0 top-0 bottom-0 z-50 w-80 max-w-[85vw] bg-[#F5F2EA] shadow-2xl overflow-y-auto transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="主選單"
        role="dialog"
        aria-modal="true"
      >
        <div className="p-8 pt-24">
          <nav className="space-y-2">
            {nav.groups.map(renderNavGroup)}
          </nav>
        </div>
      </aside>
    </>
  );
}

export default SideNavClient;
