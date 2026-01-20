'use client';

/**
 * SuggestSectionClient - Suggested articles section with article cards
 *
 * Displays a grid of article cards with decorative shapes.
 * Mobile: horizontal scroll; Desktop: 4-column grid.
 *
 * @see doc/specs/proposed/GALLERY_HERO_IMAGE_AND_HOTSPOTS.md (FR-12)
 */

import Link from 'next/link';

interface ArticleCard {
  id: string;
  slug: string;
  title: string;
  shape: 'circle' | 'square' | 'triangle' | 'blob';
  accentColor: string;
  imageUrl?: string;
}

interface SuggestSectionClientProps {
  /** Section title */
  title: string;
  /** Articles to display */
  articles: ArticleCard[];
  /** Current locale for link generation */
  locale: string;
}

function getShapeStyle(shape: ArticleCard['shape'], accentColor: string): React.CSSProperties {
  switch (shape) {
    case 'circle':
      return {
        width: '6rem',
        height: '6rem',
        borderRadius: '50%',
        backgroundColor: accentColor,
        top: '2rem',
        right: '2rem',
      };
    case 'square':
      return {
        width: '5rem',
        height: '5rem',
        borderRadius: '20% 15% 18% 22%',
        backgroundColor: accentColor,
        transform: 'rotate(12deg)',
        top: '1.5rem',
        right: '2.5rem',
      };
    case 'triangle':
      return {
        width: 0,
        height: 0,
        borderLeft: '50px solid transparent',
        borderRight: '50px solid transparent',
        borderBottom: `86px solid ${accentColor}`,
        top: '2rem',
        right: '2rem',
      };
    case 'blob':
      return {
        width: '7rem',
        height: '7rem',
        borderRadius: '45% 55% 52% 48% / 48% 45% 55% 52%',
        backgroundColor: accentColor,
        top: '1.5rem',
        right: '1.5rem',
      };
  }
}

function ArticleCardComponent({ article, locale }: { article: ArticleCard; locale: string }) {
  const shapeStyle = getShapeStyle(article.shape, article.accentColor);

  return (
    <Link
      href={`/${locale}/blog/posts/${article.slug}`}
      className="relative block w-full h-64 bg-[#EEEBE3] rounded-3xl overflow-hidden group transition-transform duration-200 hover:-translate-y-1"
    >
      <div className="absolute inset-0 shadow-[0_4px_16px_rgba(0,0,0,0.06)] group-hover:shadow-[0_8px_24px_rgba(0,0,0,0.1)] transition-shadow duration-200" />

      {/* Decorative shape */}
      <div
        className="absolute transition-transform duration-200 group-hover:translate-x-1 group-hover:-translate-y-1"
        style={shapeStyle}
      />

      {/* Title */}
      <div className="absolute bottom-0 left-0 right-0 p-6">
        <h3 className="text-lg text-[#4A4A4A] text-left leading-snug">
          {article.title}
        </h3>
      </div>
    </Link>
  );
}

export function SuggestSectionClient({ title, articles, locale }: SuggestSectionClientProps) {
  if (articles.length === 0) {
    return null;
  }

  return (
    <section className="w-full py-16 md:py-24 px-4 md:px-8 bg-[#F5F2EA]">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-xs uppercase tracking-[0.3em] text-[#6B6B6B] mb-12">
          {title}
        </h2>

        {/* Desktop: Grid */}
        <div className="hidden md:grid md:grid-cols-4 gap-6">
          {articles.map(article => (
            <ArticleCardComponent key={article.id} article={article} locale={locale} />
          ))}
        </div>

        {/* Mobile: Horizontal scroll */}
        <div className="md:hidden overflow-x-auto -mx-4 px-4">
          <div className="flex gap-4 pb-4" style={{ width: 'max-content' }}>
            {articles.map(article => (
              <div key={article.id} style={{ width: '280px' }}>
                <ArticleCardComponent article={article} locale={locale} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default SuggestSectionClient;
