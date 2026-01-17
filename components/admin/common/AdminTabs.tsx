'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

interface TabItem {
  href: string;
  /** Translation key under admin namespace (e.g., 'gallery.tabs.dashboard') */
  labelKey?: string;
  /** Static label (single-language admin) */
  label?: string;
}

interface AdminTabsProps {
  /** Route locale for href construction */
  locale: string;
  items: TabItem[];
}

/**
 * Reusable admin module tabs component.
 * Renders a horizontal tab bar with active state detection.
 *
 * Supports i18n via labelKey or static label.
 */
export default function AdminTabs({ locale, items }: AdminTabsProps) {
  const pathname = usePathname();
  const t = useTranslations('admin');
  
  const isActive = (href: string): boolean => {
    const fullHref = `/${locale}${href}`;
    return pathname === fullHref || pathname.startsWith(fullHref + '/');
  };

  const getLabel = (item: TabItem): string => {
    if (item.labelKey) {
      return t(item.labelKey);
    }
    return item.label ?? '';
  };

  return (
    <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
      <nav className="flex gap-6" aria-label="Module tabs">
        {items.map((item) => {
          const active = isActive(item.href);
          const label = getLabel(item);
          
          return (
            <Link
              key={item.href}
              href={`/${locale}${item.href}`}
              prefetch={false}
              className={`pb-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                active
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
