import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getMetadataAlternates, SITE_URL } from '@/lib/seo';
import { generateHomePageJsonLd } from '@/lib/seo/jsonld';
import { HomePageV2 } from '@/components/home';
import {
  getPublishedSiteContentCached,
  getVisibleServicesCached,
  getCompanySettingsCached
} from '@/lib/modules/content/cached';
import type { SiteContent, CompanySetting } from '@/lib/types/content';
import { pickLocaleContent } from '@/lib/i18n/pick-locale';

// Helper to get setting value
function getSetting(settings: CompanySetting[], key: string): string {
  return settings.find(s => s.key === key)?.value || '';
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

  // Fetch data needed for JSON-LD (SEO)
  const [settings, services] = await Promise.all([
    getCompanySettingsCached(),
    getVisibleServicesCached(),
  ]);

  // JSON-LD for SEO (Organization + WebSite + Services + FAQ + Breadcrumb)
  const siteUrl = SITE_URL;
  const emailAddress = getSetting(settings, 'email');
  const githubUrl = getSetting(settings, 'github_url');

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
  const siteName = getSetting(settings, 'company_name_short') || 'QN LNK';

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
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HomePageV2 locale={locale} />
    </>
  );
}
