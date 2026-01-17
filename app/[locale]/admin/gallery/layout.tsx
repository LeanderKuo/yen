import AdminTabs from '@/components/admin/common/AdminTabs';

const GALLERY_TABS = [
  { href: '/admin/gallery', label: '作品管理' },
  { href: '/admin/gallery/categories', label: '分類管理' },
  { href: '/admin/gallery/featured', label: '精選管理' },
];

export default async function GalleryLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <div>
      <AdminTabs locale={locale} items={GALLERY_TABS} />
      {children}
    </div>
  );
}
