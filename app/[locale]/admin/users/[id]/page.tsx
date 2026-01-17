/**
 * Admin User Detail Page (Server Component)
 *
 * Displays user details with profile and comments.
 * Supports optional Markdown preview via ?notesPreview=1 query param.
 *
 * @see uiux_refactor.md §6.1 - Admin Notes Preview
 */

import { notFound } from 'next/navigation';
import { createClient } from '@/lib/infrastructure/supabase/server';
import { isOwner, isSiteAdmin } from '@/lib/auth';
import { getUserById } from '@/lib/modules/user/users-admin-io';
import { getCommentsForAdminByUserId } from '@/lib/modules/comment/moderation-read-admin-io';
import { markdownToHtml } from '@/lib/markdown/server';
import { getMessages } from 'next-intl/server';
import type { AbstractIntlMessages } from 'next-intl';
import UserDetailClient from './UserDetailClient';

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ notesPreview?: string }>;
}

export default async function UserDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { locale: routeLocale, id: userId } = await params;
  const { notesPreview: notesPreviewParam } = await searchParams;
  const notesPreview = notesPreviewParam === '1';

  const supabase = await createClient();

  // Permission gate: must be site admin to view
  const isAdmin = await isSiteAdmin(supabase);
  if (!isAdmin) {
    notFound();
  }

  // Check if current user is Owner (for edit permissions)
  const ownerRole = await isOwner(supabase);

  const allMessages = await getMessages({ locale: routeLocale });
  const adminMessages = { admin: allMessages.admin } as AbstractIntlMessages;

  // Fetch user detail and cross-domain data in parallel
  const [userDetail, comments] = await Promise.all([
    getUserById(userId),
    getCommentsForAdminByUserId(userId),
  ]);

  if (!userDetail) {
    notFound();
  }

  // Merge cross-domain data into userDetail
  const enrichedUserDetail = {
    ...userDetail,
    comments,
  };

  // Optional: Server-side Markdown to HTML conversion for preview mode
  let adminNotesHtml: string | undefined;
  if (notesPreview) {
    const markdown = userDetail.adminProfile?.descriptionZhMd;

    if (markdown) {
      adminNotesHtml = await markdownToHtml(markdown);
    }
  }

  return (
    <UserDetailClient
      userDetail={enrichedUserDetail}
      routeLocale={routeLocale}
      notesPreview={notesPreview}
      adminNotesHtml={adminNotesHtml}
      isOwner={ownerRole}
      messages={adminMessages}
    />
  );
}

