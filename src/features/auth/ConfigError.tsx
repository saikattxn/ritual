import { configProblems } from '@/lib/supabase';
import { Logo } from '@/components/layout/Logo';

export function ConfigError() {
  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="card max-w-lg w-full p-8">
        <Logo />
        <h1 className="mt-6 text-2xl">Ritual isn’t connected to a database yet</h1>
        <p className="mt-2 text-ink-700">
          Ritual stores everything in your Supabase project and won’t run without it, so nothing is ever saved only on
          this device by mistake.
        </p>
        <ul className="mt-4 list-disc pl-5 text-sm text-clay-700 space-y-1">
          {configProblems.map((p) => <li key={p}>{p}</li>)}
        </ul>
        <ol className="mt-5 list-decimal pl-5 text-sm text-ink-700 space-y-1.5">
          <li>Copy <code className="rounded bg-sage-100 px-1">.env.example</code> to <code className="rounded bg-sage-100 px-1">.env.local</code>.</li>
          <li>Paste your project URL and anon key from Supabase → Project Settings → API.</li>
          <li>Restart the dev server, or add the same variables in Netlify/Vercel and redeploy.</li>
        </ol>
      </div>
    </div>
  );
}
