import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Play, Zap } from 'lucide-react';
import { useTemplates } from '@/api/fitness';
import { useActiveSession, useStartSession } from '@/api/sessions';
import { useToday } from '@/api/profile';
import { Button, Modal, Notice, PageHeader, Segmented, SelectField, TextField } from '@/components/ui';
import { useToast } from '@/components/ui/feedback';
import { Planner } from './Planner';
import { Templates } from './Templates';
import { Library } from './Library';
import { History } from './History';
import { Body } from './Body';
import { SafetyNote } from './SafetyNote';

type Tab = 'plan' | 'templates' | 'library' | 'history' | 'body';
const TABS: { value: Tab; label: string }[] = [
  { value: 'plan', label: 'Plan' },
  { value: 'templates', label: 'Workouts' },
  { value: 'library', label: 'Exercises' },
  { value: 'history', label: 'History' },
  { value: 'body', label: 'Body & goals' },
];

export default function WorkoutsPage() {
  const [params, setParams] = useSearchParams();
  const tab = (TABS.some((t) => t.value === params.get('tab')) ? params.get('tab') : 'plan') as Tab;
  const active = useActiveSession();
  const nav = useNavigate();
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (params.get('start') === '1') {
      setStarting(true);
      params.delete('start');
      setParams(params, { replace: true });
    }
  }, [params, setParams]);

  return (
    <>
      <PageHeader eyebrow="Workouts" title="Move your way" subtitle="Plan your week, build workouts and log every set."
        action={active.data
          ? <Button icon={<Play className="h-4 w-4" />} onClick={() => nav(`/workouts/session/${active.data!.id}`)}>Resume workout</Button>
          : <Button icon={<Zap className="h-4 w-4" />} onClick={() => setStarting(true)}>Start a workout</Button>} />
      {active.data && (
        <Notice className="mb-5" title={`“${active.data.title}” is in progress`}>
          Pick up where you left off, or open it to finish or discard it.
        </Notice>
      )}
      <Segmented label="Workout sections" value={tab} onChange={(v) => setParams({ tab: v }, { replace: true })} options={TABS} className="mb-6" />
      {tab === 'plan' && <Planner />}
      {tab === 'templates' && <Templates />}
      {tab === 'library' && <Library />}
      {tab === 'history' && <History />}
      {tab === 'body' && <Body />}
      {starting && <StartModal onClose={() => setStarting(false)} />}
    </>
  );
}

function StartModal({ onClose }: { onClose: () => void }) {
  const templates = useTemplates();
  const start = useStartSession();
  const today = useToday();
  const nav = useNavigate();
  const toast = useToast();
  const usable = (templates.data ?? []).filter((t) => !t.archived_at && t.workout_template_exercises.length > 0);
  const [templateId, setTemplateId] = useState('');
  const [title, setTitle] = useState('');

  const go = async () => {
    const template = usable.find((t) => t.id === templateId) ?? null;
    try {
      const s = await start.mutateAsync({ template, title: title.trim() || template?.name || 'Workout', today });
      nav(`/workouts/session/${s.id}`);
    } catch (e) {
      toast.error(e);
    }
  };

  return (
    <Modal open onClose={onClose} title="Start a workout"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button icon={<Play className="h-4 w-4" />} loading={start.isPending} onClick={go}>Start</Button></>}>
      <div className="space-y-4">
        <SelectField label="Workout" value={templateId} onChange={(e) => setTemplateId(e.target.value)}
          options={[{ value: '', label: 'Empty workout — add exercises as you go' },
            ...usable.filter((t) => t.user_id).map((t) => ({ value: t.id, label: t.name })),
            ...usable.filter((t) => !t.user_id).map((t) => ({ value: t.id, label: `Starter · ${t.name}` }))]} />
        <TextField label="Name" hint="Optional" placeholder={usable.find((t) => t.id === templateId)?.name ?? 'Workout'} value={title}
          onChange={(e) => setTitle(e.target.value)} maxLength={100} />
        <p className="text-sm text-ink-500">Nothing is saved to your history until you finish and save the workout.</p>
        <SafetyNote compact />
      </div>
    </Modal>
  );
}
