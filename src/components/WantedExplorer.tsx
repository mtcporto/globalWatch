"use client";

import { useMemo, useState } from 'react';
import { Search, SlidersHorizontal, ArrowDownAZ, X } from 'lucide-react';
import type { PersonClassification, WantedPerson, WantedSource } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { WantedCard } from '@/components/WantedCard';

const PAGE_SIZE = 24;

const sourceOrder: Record<WantedPerson['source'], number> = {
  'eu-most-wanted': 0,
  'mjsp-captura': 1,
  fbi: 2,
};

const classificationLabels: Record<PersonClassification, string> = {
  WANTED_CRIMINAL: 'Most Wanted',
  CYBER_MOST_WANTED: 'Cyber',
  CRIMES_AGAINST_CHILDREN: 'Crimes Against Children',
  MISSING_PERSON: 'Missing Persons',
  UNIDENTIFIED_PERSON: 'Unidentified',
  VICTIM_OF_CRIME: 'Victims of Crime',
  SEEKING_INFORMATION: 'Seeking Information',
  CAPTURED: 'Resolved',
  UNSPECIFIED: 'Other Cases',
};

const sourceLabels: Record<WantedSource, string> = {
  fbi: 'FBI',
  'eu-most-wanted': 'EU Most Wanted',
  'mjsp-captura': 'MJSP Captura',
};

const sourceLinks: Record<WantedSource, string> = {
  fbi: 'https://www.fbi.gov/wanted',
  'eu-most-wanted': 'https://eumostwanted.eu/',
  'mjsp-captura': 'https://www.gov.br/mj/pt-br/assuntos/sua-seguranca/seguranca-publica/operacoes-integradas/projeto-captura/lista-de-procurados',
};

interface WantedExplorerProps {
  people: WantedPerson[];
}

export function WantedExplorer({ people }: WantedExplorerProps) {
  const [query, setQuery] = useState('');
  const [classification, setClassification] = useState<'ALL' | PersonClassification>('ALL');
  const [source, setSource] = useState<'ALL' | WantedSource>('ALL');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const availableClassifications = useMemo(
    () => Array.from(new Set(people.map(person => person.classification))),
    [people],
  );

  const filteredPeople = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return people
      .filter(person => source === 'ALL' || person.source === source)
      .filter(person => classification === 'ALL' || person.classification === classification)
      .filter(person => {
        if (!normalizedQuery) return true;
        const searchableText = [
          person.name,
          person.rawId,
          person.caseTypeDescription,
          ...(person.aliases ?? []),
          ...(person.fieldOffices ?? []),
          ...(person.possibleCountries ?? []),
        ].filter(Boolean).join(' ').toLowerCase();
        return searchableText.includes(normalizedQuery);
      })
      .sort((first, second) => {
        const sourceDifference = sourceOrder[first.source] - sourceOrder[second.source];
        return sourceDifference || (first.name ?? '').localeCompare(second.name ?? '');
      });
  }, [classification, people, query, source]);

  const visiblePeople = filteredPeople.slice(0, visibleCount);
  const hasFilters = query.length > 0 || classification !== 'ALL' || source !== 'ALL';

  function clearFilters() {
    setQuery('');
    setClassification('ALL');
    setSource('ALL');
    setVisibleCount(PAGE_SIZE);
  }

  function updateQuery(value: string) {
    setQuery(value);
    setVisibleCount(PAGE_SIZE);
  }

  function updateClassification(value: 'ALL' | PersonClassification) {
    setClassification(value);
    setVisibleCount(PAGE_SIZE);
  }

  function updateSource(value: 'ALL' | WantedSource) {
    setSource(value);
    setVisibleCount(PAGE_SIZE);
  }

  return (
    <section id="records" className="space-y-5 scroll-mt-24">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">Explore the records</p>
          <h2 className="font-headline text-3xl font-bold tracking-tight text-foreground">Find a person or case</h2>
          <p className="mt-1 text-sm text-muted-foreground">Search names, aliases, offices, countries, or case descriptions.</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <SlidersHorizontal className="h-4 w-4" />
          <span>{filteredPeople.length.toLocaleString()} matching records</span>
        </div>
      </div>

      <div className="explorer-toolbar rounded-2xl border border-border/70 bg-card p-3 shadow-sm">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Source</span>
            <Button type="button" variant={source === 'ALL' ? 'default' : 'outline'} size="sm" onClick={() => updateSource('ALL')}>All sources</Button>
            {(Object.keys(sourceLabels) as WantedSource[]).map(value => (
              <Button key={value} type="button" variant={source === value ? 'default' : 'outline'} size="sm" onClick={() => updateSource(value)}>
                {sourceLabels[value]}
              </Button>
            ))}
          </div>
          <div className="flex flex-col gap-3 lg:flex-row">
          <label className="relative flex-1">
            <span className="sr-only">Search records</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={event => updateQuery(event.target.value)}
              placeholder="Search by name, alias, country..."
              className="h-11 border-0 bg-muted/60 pl-10 pr-10 focus-visible:ring-1"
            />
            {query && (
              <button type="button" onClick={() => updateQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Clear search">
                <X className="h-4 w-4" />
              </button>
            )}
          </label>
          <label className="relative lg:w-64">
            <span className="sr-only">Filter by classification</span>
            <select
              value={classification}
              onChange={event => updateClassification(event.target.value as 'ALL' | PersonClassification)}
              className="h-9 w-full appearance-none rounded-md border border-input bg-background px-3 pr-10 text-sm font-medium outline-none ring-offset-background transition-colors hover:bg-muted focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="ALL">All classifications</option>
              {availableClassifications.map(value => (
                <option key={value} value={value}>{classificationLabels[value]}</option>
              ))}
            </select>
            <ArrowDownAZ className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </label>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/60 pt-3 text-xs text-muted-foreground">
            <span>Official sources:</span>
            {(Object.keys(sourceLinks) as WantedSource[]).map(value => (
              <a key={value} href={sourceLinks[value]} target="_blank" rel="noreferrer" className="font-medium text-primary underline-offset-4 hover:underline">
                {sourceLabels[value]}
              </a>
            ))}
          </div>
        </div>
        {hasFilters && (
          <div className="mt-3 flex items-center gap-2 border-t border-border/60 pt-3">
            <Badge variant="secondary">Filtered view</Badge>
            <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>Clear filters</Button>
          </div>
        )}
      </div>

      {visiblePeople.length > 0 ? (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            {visiblePeople.map(person => <WantedCard key={person.id} person={person} />)}
          </div>
          {visibleCount < filteredPeople.length && (
            <div className="flex justify-center pt-3">
              <Button type="button" variant="outline" onClick={() => setVisibleCount(count => count + PAGE_SIZE)}>
                Load more records
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <Search className="mx-auto h-9 w-9 text-muted-foreground" />
          <h3 className="mt-4 font-headline text-lg font-semibold">No records found</h3>
          <p className="mt-1 text-sm text-muted-foreground">Try a broader name, country, or classification.</p>
          {hasFilters && <Button type="button" variant="outline" className="mt-5" onClick={clearFilters}>Clear filters</Button>}
        </div>
      )}
    </section>
  );
}
