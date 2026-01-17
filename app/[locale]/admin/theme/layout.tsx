import AdminTabs from '@/components/admin/common/AdminTabs';

const THEME_TABS = [
  { href: '/admin/theme', label: '全域主題' },
  { href: '/admin/theme/pages', label: '分頁主題' },
  { href: '/admin/theme/layouts', label: '布局設定' },
  { href: '/admin/theme/fonts', label: '字體' },
];

export default async function ThemeLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <div>
      <AdminTabs locale={locale} items={THEME_TABS} />
      {children}
    </div>
  );
}
