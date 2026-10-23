import { HeartPulse } from 'lucide-react';
import { Notice } from '@/components/ui';

export function SafetyNote({ compact }: { compact?: boolean }) {
  if (compact)
    return (
      <p className="flex items-start gap-2 text-xs text-ink-500">
        <HeartPulse className="h-4 w-4 shrink-0 text-clay-500" />
        Stop if anything causes pain, dizziness, chest discomfort or unusual symptoms, and seek medical advice if it persists.
      </p>
    );
  return (
    <Notice tone="caution" icon={<HeartPulse className="h-5 w-5 text-clay-600" />} title="Train comfortably">
      Warm up for 5–10 minutes before you start and cool down afterwards. Progress gradually and allow time to recover.
      Stop if an exercise causes pain, dizziness or unusual symptoms. Ritual’s plans are general information, not
      individual medical advice — speak to a professional if you have an injury or health condition.
    </Notice>
  );
}
