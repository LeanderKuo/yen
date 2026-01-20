'use client';

/**
 * HeaderBarV2Client - Interactive header bar with hamburger menu toggle
 *
 * Client component that handles menu open/close state and animation.
 *
 * @see doc/specs/proposed/GALLERY_HERO_IMAGE_AND_HOTSPOTS.md (FR-9)
 */

import { useState, useCallback } from 'react';
import SideNavClient from './SideNavClient';
import type { ResolvedHamburgerNav } from '@/lib/types/hamburger-nav';

interface HeaderBarV2ClientProps {
  /** Resolved navigation data */
  nav: ResolvedHamburgerNav;
  /** Current locale */
  locale: string;
}

export function HeaderBarV2Client({ nav, locale }: HeaderBarV2ClientProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleToggle = useCallback(() => {
    setIsMenuOpen(prev => !prev);
  }, []);

  const handleClose = useCallback(() => {
    setIsMenuOpen(false);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-[#F5F2EA]/95 backdrop-blur-sm border-b border-[#E5E1D9]">
        <div className="flex items-center justify-between h-16 px-4 md:px-8 max-w-[1440px] mx-auto">
          {/* Hamburger Button */}
          <button
            onClick={handleToggle}
            className="p-2 -ml-2 rounded-2xl hover:bg-[#F3AE69]/10 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F3AE69]"
            aria-label={isMenuOpen ? '關閉選單' : '開啟選單'}
            aria-expanded={isMenuOpen}
          >
            <div className="relative w-6 h-6">
              {/* Animated hamburger icon */}
              <span
                className={`absolute left-0 block w-6 h-0.5 bg-[#4A4A4A] transition-all duration-200 ease-out ${
                  isMenuOpen ? 'top-[11px] rotate-45' : 'top-1'
                }`}
              />
              <span
                className={`absolute left-0 top-[11px] block w-6 h-0.5 bg-[#4A4A4A] transition-opacity duration-200 ${
                  isMenuOpen ? 'opacity-0' : 'opacity-100'
                }`}
              />
              <span
                className={`absolute left-0 block w-6 h-0.5 bg-[#4A4A4A] transition-all duration-200 ease-out ${
                  isMenuOpen ? 'top-[11px] -rotate-45' : 'top-[19px]'
                }`}
              />
            </div>
          </button>

          {/* Spacer for layout balance */}
          <div className="w-10" />
        </div>
      </header>

      {/* Side Navigation Panel */}
      <SideNavClient
        isOpen={isMenuOpen}
        onClose={handleClose}
        nav={nav}
        locale={locale}
      />
    </>
  );
}

export default HeaderBarV2Client;
