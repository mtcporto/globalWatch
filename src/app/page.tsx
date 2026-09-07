import { Activity, ArrowRight, Database, Globe2, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { getAllGlobalWantedData } from '@/lib/api';
import type { WantedPerson } from '@/lib/types';
import { WantedExplorer } from '@/components/WantedExplorer';

export const revalidate = 21600;

export default async function HomePage() {
  const people: WantedPerson[] = await getAllGlobalWantedData();
  const wantedCount = people.filter(person => person.classification === 'WANTED_CRIMINAL').length;
  const missingCount = people.filter(person => person.classification === 'MISSING_PERSON').length;
  const latestUpdate = people.reduce((latest, person) => {
    const modified = person.originalData && typeof person.originalData === 'object' && 'modified' in person.originalData
      ? String(person.originalData.modified || '')
      : '';
    return modified > latest ? modified : latest;
  }, '');

  return (
    <div className="space-y-12 pb-10">
      <section className="hero-panel relative overflow-hidden rounded-[2rem] px-6 py-10 text-primary-foreground shadow-xl sm:px-10 sm:py-14 lg:px-16">
        <div className="relative z-10 max-w-3xl">
          <div className="mb-5 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary-foreground/70">
            <span className="inline-flex items-center gap-2"><Globe2 className="h-4 w-4 text-accent" /> Public safety intelligence</span>
            <span className="h-1 w-1 rounded-full bg-primary-foreground/40" />
            <span>FBI catalog</span>
          </div>
          <h1 className="font-headline text-4xl font-bold leading-tight tracking-tight sm:text-6xl">Know who is being sought.</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-primary-foreground/75 sm:text-lg">
            A clearer way to explore official public records for wanted people, missing persons, and cases seeking information.
          </p>
          <Link href="#records" className="mt-8 inline-flex items-center gap-2 rounded-md bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground shadow-lg transition-transform hover:-translate-y-0.5">
            Explore records <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="hero-grid absolute inset-0 opacity-30" aria-hidden="true" />
        <div className="absolute -right-20 -top-24 h-80 w-80 rounded-full border-[3rem] border-accent/20" aria-hidden="true" />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="metric-card"><Database className="h-5 w-5 text-accent" /><span className="metric-value">{people.length.toLocaleString('en-US')}</span><span className="metric-label">Records indexed</span></div>
        <div className="metric-card"><ShieldCheck className="h-5 w-5 text-accent" /><span className="metric-value">{wantedCount.toLocaleString('en-US')}</span><span className="metric-label">Wanted people</span></div>
        <div className="metric-card"><Activity className="h-5 w-5 text-accent" /><span className="metric-value">{missingCount.toLocaleString('en-US')}</span><span className="metric-label">Missing persons</span></div>
        <div className="metric-card"><Globe2 className="h-5 w-5 text-accent" /><span className="metric-value">3</span><span className="metric-label">Active sources</span></div>
      </section>

      <div className="flex flex-col gap-2 border-b border-border/70 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Data provenance</p>
          <p className="text-sm text-muted-foreground">FBI, EU Most Wanted and Projeto Captura records, cached for faster browsing. Always verify details with the source agency.</p>
        </div>
        {latestUpdate && <p className="shrink-0 text-xs text-muted-foreground">Source updated {new Date(latestUpdate).toLocaleDateString()}</p>}
      </div>

      <WantedExplorer people={people} />

      <footer className="rounded-2xl border border-accent/20 bg-accent/5 p-5 text-sm leading-6 text-muted-foreground">
        Global Watch is an informational index, not a law-enforcement agency. A listing does not establish guilt. For tips, corrections, or official status, contact the relevant agency through its published website.
      </footer>
    </div>
  );
}
