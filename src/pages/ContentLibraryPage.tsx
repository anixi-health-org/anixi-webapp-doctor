import React, { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  BookOpenIcon,
  DocumentTextIcon,
  MegaphoneIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import { PageHeader, PageShell } from '../components/page-layout';
import { Card, CardContent } from '../components/ui/Card';

type ContentItem = {
  id: string;
  title: string;
  category: string;
  summary: string;
  status: 'draft' | 'published';
};

const STARTER_CONTENT: ContentItem[] = [
  {
    id: '1',
    title: 'Living with hypertension — patient guide',
    category: 'Education',
    summary: 'Blood pressure basics, lifestyle tips, and when to seek care.',
    status: 'published',
  },
  {
    id: '2',
    title: 'Medication adherence checklist',
    category: 'Care plans',
    summary: 'A printable checklist patients can use between visits.',
    status: 'published',
  },
  {
    id: '3',
    title: 'Preparing for your teleconsult',
    category: 'Practice',
    summary: 'What to have ready before a virtual appointment.',
    status: 'draft',
  },
];

/**
 * Content Creator workspace — gated by manageContent (via ContentPermissionRoute).
 * Practice education / care content for patients and the practice.
 */
export const ContentLibraryPage: React.FC = () => {
  const location = useLocation();
  const inClinic = location.pathname.startsWith('/clinic');
  const shareHref = inClinic ? '/clinic/share' : '/share-anixi';

  const [items, setItems] = useState<ContentItem[]>(STARTER_CONTENT);
  const [filter, setFilter] = useState<'all' | 'draft' | 'published'>('all');
  const [draftTitle, setDraftTitle] = useState('');

  const visible = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter((i) => i.status === filter);
  }, [items, filter]);

  const addDraft = () => {
    const title = draftTitle.trim();
    if (!title) return;
    setItems((prev) => [
      {
        id: `local-${Date.now()}`,
        title,
        category: 'Education',
        summary: 'New draft — edit and publish when ready.',
        status: 'draft',
      },
      ...prev,
    ]);
    setDraftTitle('');
  };

  const toggleStatus = (id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              status: item.status === 'published' ? 'draft' : 'published',
            }
          : item
      )
    );
  };

  return (
    <PageShell>
      <PageHeader
        title="Content library"
        description="Create and manage patient education and practice content. Available to Content Creators and administrators."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 !px-4 !py-4">
            <BookOpenIcon className="h-8 w-8 text-anixi-green" />
            <div>
              <p className="text-2xl font-semibold text-[#0E2340]">{items.length}</p>
              <p className="text-sm text-[#72829B]">Total items</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 !px-4 !py-4">
            <DocumentTextIcon className="h-8 w-8 text-anixi-green" />
            <div>
              <p className="text-2xl font-semibold text-[#0E2340]">
                {items.filter((i) => i.status === 'published').length}
              </p>
              <p className="text-sm text-[#72829B]">Published</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 !px-4 !py-4">
            <MegaphoneIcon className="h-8 w-8 text-anixi-green" />
            <div>
              <p className="text-sm font-medium text-[#0E2340]">Share Anixi</p>
              <Link to={shareHref} className="text-sm text-anixi-green underline">
                Open referral tools
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-[#E4EAF2] bg-white p-4 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label className="mb-1 block text-sm font-medium text-gray-700">New draft title</label>
          <input
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            placeholder="e.g. Diabetes meal planning tips"
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter') addDraft();
            }}
          />
        </div>
        <button
          type="button"
          onClick={addDraft}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-anixi-green px-5 py-2.5 text-sm font-semibold text-white"
        >
          <PlusIcon className="h-4 w-4" />
          Add draft
        </button>
      </div>

      <div className="mb-4 flex gap-2">
        {(['all', 'published', 'draft'] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${
              filter === key
                ? 'bg-anixi-green text-white'
                : 'bg-white text-gray-600 border border-gray-200'
            }`}
          >
            {key}
          </button>
        ))}
      </div>

      <ul className="space-y-3">
        {visible.map((item) => (
          <li
            key={item.id}
            className="flex flex-col gap-3 rounded-2xl border border-[#E4EAF2] bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-[#0E2340]">{item.title}</p>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    item.status === 'published'
                      ? 'bg-green-50 text-green-800'
                      : 'bg-amber-50 text-amber-800'
                  }`}
                >
                  {item.status}
                </span>
                <span className="rounded-full bg-gray-50 px-2 py-0.5 text-[11px] text-gray-600">
                  {item.category}
                </span>
              </div>
              <p className="mt-1 text-sm text-[#72829B]">{item.summary}</p>
            </div>
            <button
              type="button"
              onClick={() => toggleStatus(item.id)}
              className="shrink-0 rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {item.status === 'published' ? 'Unpublish' : 'Publish'}
            </button>
          </li>
        ))}
        {visible.length === 0 && (
          <li className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
            No content in this filter yet.
          </li>
        )}
      </ul>
    </PageShell>
  );
};

export default ContentLibraryPage;
