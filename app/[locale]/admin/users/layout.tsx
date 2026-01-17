import AdminTabs from '@/components/admin/common/AdminTabs';

const USERS_TABS = [
  { href: '/admin/users', label: '用戶列表' },
  // PR-4 將新增: { href: '/admin/users/tags', label: '標籤管理' },
  // PR-5 將新增: { href: '/admin/users/appointments', label: '預約管理' },
];

export default async function UsersLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <div>
      <AdminTabs locale={locale} items={USERS_TABS} />
      {children}
    </div>
  );
}
