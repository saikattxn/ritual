import { useNavigate } from 'react-router-dom';
import { Archive, Copy, Pencil, Play, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useArchiveTemplate, useDeleteTemplate, useDuplicateTemplate, useTemplates } from '@/api/fitness';
import { useStartSession } from '@/api/sessions';
import { useToday } from '@/api/profile';
import { Badge, Button, Card, EmptyState, ErrorBlock, Skeleton } from '@/components/ui';
import { useConfirm, useToast } from '@/components/ui/feedback';
import { FOCUS } from '@/lib/constants';
import type { TemplateWithExercises } from '@/types/db';
import { useState } from 'react';

export function Templates() {
  const templates = useTemplates();
  const nav = useNavigate();
  const [showArchived, setShowArchived] = useState(false);
  if (templates.error) return <ErrorBlock error={templates.error} onRetry={() => templates.refetch()} />;
  if (templates.isLoading || !templates.data) return <Skeleton className="h-64" />;
  const mine = templates.data.filter((t) => t.user_id && (showArchived ? t.archived_at : !t.archived_at));
  const archivedCount = templates.data.filter((t) => t.user_id && t.archived_at).length;
  const starters = templates.data.filter((t) => !t.user_id);

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-xl">{showArchived ? 'Archived workouts' : 'Your workouts'}</h2>
          <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => nav('/workouts/templates/new')}>New workout</Button>
        </div>
        {mine.length === 0 ? (
          <Card><EmptyState title={showArchived ? 'Nothing archived' : 'No saved workouts yet'}>
            {!showArchived && 'Build your own from the exercise library, or start from one of the editable templates below.'}
          </EmptyState></Card>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">{mine.map((t) => <TemplateCard key={t.id} t={t} />)}</ul>
        )}
        {(archivedCount > 0 || showArchived) && (
          <button className="mt-3 text-sm text-sage-700 hover:underline" onClick={() => setShowArchived((s) => !s)}>
            {showArchived ? 'Back to your workouts' : `Show archived (${archivedCount})`}
          </button>
        )}
      </section>
      <section>
        <h2 className="text-xl mb-1">Starter templates</h2>
        <p className="mb-3 text-sm text-ink-500">General plans for information only — not individual advice. Make a copy to adjust anything.</p>
        <ul className="grid gap-3 md:grid-cols-2">{starters.map((t) => <TemplateCard key={t.id} t={t} />)}</ul>
      </section>
    </div>
  );
}

function TemplateCard({ t }: { t: TemplateWithExercises }) {
  const nav = useNavigate();
  const today = useToday();
  const dup = useDuplicateTemplate();
  const archive = useArchiveTemplate();
  const del = useDeleteTemplate();
  const start = useStartSession();
  const confirm = useConfirm();
  const toast = useToast();
  const n = t.workout_template_exercises.length;

  const copy = async () => {
    try {
      const created = await dup.mutateAsync({ template: t });
      toast.success(t.user_id ? 'Duplicated' : 'Copied to your workouts');
      nav(`/workouts/templates/${created.id}`);
    } catch (e) {
      toast.error(e);
    }
  };
  const begin = async () => {
    try {
      const s = await start.mutateAsync({ template: t, today });
      nav(`/workouts/session/${s.id}`);
    } catch (e) {
      toast.error(e);
    }
  };

  return (
    <li className="card p-5 flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-lg font-serif">{t.name}</p>
          <p className="text-xs text-ink-500">{n} exercises · about {t.estimated_minutes} min</p>
        </div>
        <Badge tone="cream">{FOCUS[t.focus]}</Badge>
      </div>
      {t.description && <p className="mt-2 text-sm text-ink-700 line-clamp-2">{t.description}</p>}
      <p className="mt-2 text-xs text-ink-500 line-clamp-1">{t.workout_template_exercises.map((e) => e.exercises?.name).filter(Boolean).join(' · ')}</p>
      <div className="mt-4 flex flex-wrap gap-2 pt-1">
        {!t.archived_at && <Button size="sm" icon={<Play className="h-4 w-4" />} loading={start.isPending} onClick={begin} disabled={n === 0}>Start</Button>}
        {t.user_id ? (
          <>
            <Button size="sm" variant="secondary" icon={<Pencil className="h-4 w-4" />} onClick={() => nav(`/workouts/templates/${t.id}`)}>Edit</Button>
            <Button size="sm" variant="ghost" icon={<Copy className="h-4 w-4" />} loading={dup.isPending} onClick={copy}>Duplicate</Button>
            <Button size="sm" variant="ghost" aria-label={t.archived_at ? 'Restore' : 'Archive'} icon={t.archived_at ? <RotateCcw className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
              onClick={() => archive.mutate({ id: t.id, archived: !t.archived_at }, { onSuccess: () => toast.success(t.archived_at ? 'Restored' : 'Archived — history kept'), onError: (e) => toast.error(e) })} />
            <Button size="sm" variant="ghost" aria-label="Delete" className="text-clay-700" icon={<Trash2 className="h-4 w-4" />} onClick={async () => {
              if (await confirm({ title: `Delete “${t.name}”?`, body: 'Workouts you already logged with it stay in your history. Plans that used it keep their name.' }))
                del.mutate(t.id, { onSuccess: () => toast.success('Workout deleted'), onError: (e) => toast.error(e) });
            }} />
          </>
        ) : (
          <>
            <Button size="sm" variant="secondary" icon={<Copy className="h-4 w-4" />} loading={dup.isPending} onClick={copy}>Make it mine</Button>
            <Button size="sm" variant="ghost" onClick={() => nav(`/workouts/templates/${t.id}`)}>View</Button>
          </>
        )}
      </div>
    </li>
  );
}
