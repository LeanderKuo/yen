import type { Metadata } from 'next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import {
  getPublishedSiteContentCached,
  getVisiblePortfolioItemsCached,
  getVisibleServicesCached,
  getCompanySettingsCached
} from '@/lib/modules/content/cached';
import { getVisibleLandingSectionsCached } from '@/lib/modules/landing/cached';
import { fetchGalleryDataForSectionsCached } from '@/lib/use-cases/landing/cached';
import { getTranslations } from 'next-intl/server';
import { getMetadataAlternates, SITE_URL } from '@/lib/seo';
import { generateHomePageJsonLd } from '@/lib/seo/jsonld';
import type { SiteContent, CompanySetting } from '@/lib/types/content';
import { SectionRenderer } from '@/components/sections';
import { ThemeScope } from '@/components/theme/ThemeScope';
import { pickLocaleContent } from '@/lib/i18n/pick-locale';

// Helper to get setting value
function getSetting(settings: CompanySetting[], key: string): string {
  return settings.find(s => s.key === key)?.value || '';
}

// Build UI labels for sections (server-only helper)
function buildHomeLabels() {
  return {
    portfolio: {
      title: '精選作品',
      intro: '打造有影響力的解決方案，解決社群和個人面臨的真實挑戰。',
      visit: '了解更多',
      inDevelopment: '開發中',
    },
    services: {
      title: '我們的建構項目',
    },
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  // Generate hreflang alternates
  const alternates = getMetadataAlternates('', locale);

  // Try to load from database first
  const contents = await getPublishedSiteContentCached();
  const metadataContent = contents.find((c: SiteContent) => c.section_key === 'metadata');

  if (metadataContent) {
    const content = pickLocaleContent<{ title: string; description: string }>(metadataContent, locale);
    if (content) {
      return {
        title: content.title,
        description: content.description,
        alternates,
      };
    }
  }

  // Fallback to static translations
  const t = await getTranslations({ locale, namespace: 'metadata' });
  return {
    title: t('title'),
    description: t('description'),
    alternates,
  };
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Fetch visible landing sections first
  const sections = await getVisibleLandingSectionsCached();

  // Determine what data we need based on sections
  const needsServices = sections.some(s => s.section_key === 'services');
  const needsPortfolio = sections.some(s => s.section_key === 'portfolio');
  const needsCompanyMeta = sections.some(s =>
    ['hero', 'about', 'contact'].includes(s.section_key)
  );
  const needsGallery = sections.some(
    s => s.section_key === 'product_design' || s.section_type === 'gallery'
  );

  // Fetch data based on actual section usage (parallel)
  const [siteContents, services, portfolioItems, settings, galleryData] = await Promise.all([
    getPublishedSiteContentCached(),
    needsServices ? getVisibleServicesCached() : Promise.resolve([]),
    needsPortfolio ? getVisiblePortfolioItemsCached() : Promise.resolve([]),
    needsCompanyMeta ? getCompanySettingsCached() : Promise.resolve([]),
    needsGallery ? fetchGalleryDataForSectionsCached(sections) : Promise.resolve({}),
  ]);

  // Build company metadata for sections that need it
  const companyMeta = needsCompanyMeta
    ? {
        emailAddress: getSetting(settings, 'email'),
        githubUrl: getSetting(settings, 'github_url'),
        domainUrl: getSetting(settings, 'domain'),
        founderName: getSetting(settings, 'founder_name'),
        founderGithub: getSetting(settings, 'founder_github'),
      }
    : null;

  // Build UI labels
  const uiLabels = buildHomeLabels();

  // JSON-LD for SEO (Organization + WebSite + Services + FAQ + Breadcrumb)
  const siteUrl = SITE_URL;
  const emailAddress = companyMeta?.emailAddress || '';
  const githubUrl = companyMeta?.githubUrl || '';

  // Build FAQ list from services/features
  const faqs = [
    { question: '你們提供哪些服務？', answer: '我們提供全端網頁開發、雲端基礎設施部署，以及 AI 與大型語言模型整合服務。' },
    { question: '你們使用什麼技術？', answer: '我們使用 React、Next.js、TypeScript、Supabase、GCP 和 Docker 等現代技術。' },
    { question: '如何聯繫你們？', answer: `您可以透過 ${emailAddress} 與我們聯繫，或透過 GitHub 與我們交流。` },
  ];

  // Build breadcrumbs for homepage
  const breadcrumbs = [
    { name: '首頁', url: `${siteUrl}/${locale}` },
  ];

  // Get siteName from settings or use locale-aware fallback
  const siteName = getSetting(settings, 'company_name_short') || 
    'QN LNK';

  const jsonLd = generateHomePageJsonLd({
    siteName,
    siteUrl,
    logo: `${siteUrl}/logo.png`,
    email: emailAddress,
    githubUrl,
    description: '建構連結社群的量子啟發數位解決方案',
    locale,
    services: services.map((s) => ({
      name: s.title_zh,
      description: s.description_zh || undefined,
    })),
    faqs,
    breadcrumbs,
  });


  return (
    <ThemeScope scope="home">
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Header locale={locale} />
        <main className="pt-24 md:pt-32 pb-16">
          {sections.map((section) => (
            <SectionRenderer
              key={section.id}
              section={section}
              locale={locale}
              siteContents={siteContents}
              services={services}
              portfolioItems={portfolioItems}
              companyMeta={companyMeta}
              uiLabels={uiLabels}
              galleryData={galleryData}
            />
          ))}
        </main>
        <Footer locale={locale} />
      </>
    </ThemeScope>
  );
}
