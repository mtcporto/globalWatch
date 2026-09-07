import * as cheerio from 'cheerio';
import { getCachedRecord, getCachedRecords, saveRecords } from './db';
import type { PersonClassification, WantedPerson, WantedSource } from './types';

const EU_BASE_URL = 'https://eumostwanted.eu';
const MJSP_BASE_URL = 'https://www.gov.br/mj/pt-br/assuntos/sua-seguranca/seguranca-publica/operacoes-integradas/projeto-captura/lista-de-procurados';
const SOURCE_TTL_MS = 12 * 60 * 60 * 1000;

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { Accept: 'text/html,application/xhtml+xml' },
      next: { revalidate: 43200 },
    });
    if (!response.ok) {
      console.error(`[sources] ${url} returned ${response.status}`);
      return null;
    }
    return response.text();
  } catch (error) {
    console.error(`[sources] Failed to fetch ${url}`, error);
    return null;
  }
}

function isFresh(records: { updatedAt: number }[]): boolean {
  const newest = records.reduce((latest, record) => Math.max(latest, record.updatedAt), 0);
  return records.length > 0 && Date.now() - newest < SOURCE_TTL_MS;
}

function text(value: string | undefined): string | null {
  const normalized = value?.replace(/\s+/g, ' ').trim();
  return normalized || null;
}

function normalizePerson(input: {
  source: WantedSource;
  rawId: string;
  name: string;
  image?: string | null;
  sourceUrl: string;
  country?: string | null;
  status?: string | null;
  description?: string | null;
  originalData: unknown;
}): WantedPerson {
  const classification: PersonClassification = input.status?.toLowerCase().includes('arrest') || input.status?.toLowerCase().includes('captur')
    ? 'CAPTURED'
    : 'WANTED_CRIMINAL';
  const image = input.image || `https://placehold.co/300x400.png?text=${encodeURIComponent(input.name)}`;

  return {
    id: `${input.source}-${input.rawId}`,
    rawId: input.rawId,
    source: input.source,
    name: input.name,
    images: [image],
    thumbnailUrl: image,
    details: input.description,
    nationality: input.country ? [input.country] : null,
    possibleCountries: input.country ? [input.country] : null,
    originalData: input.originalData,
    detailsUrl: `/person/${input.source}/${encodeURIComponent(input.rawId)}`,
    sourceUrl: input.sourceUrl,
    classification,
    caseTypeDescription: input.status || 'Wanted person',
    status: input.status || undefined,
  };
}

function fieldValue($: cheerio.CheerioAPI, fieldName: string): string | null {
  return text($(`.field--name-${fieldName} .field__item`).first().text());
}

function enrichEuPerson(person: WantedPerson, html: string): WantedPerson {
  const $ = cheerio.load(html);
  const nationality = fieldValue($, 'field-nationality');
  const crime = fieldValue($, 'field-crime');
  const dateOfBirth = fieldValue($, 'field-date-of-birth');
  const gender = fieldValue($, 'field-gender');
  const height = fieldValue($, 'field-approximate-height');
  const eyeColor = fieldValue($, 'field-eye-colour');
  const image = text($('meta[property="og:image"]').attr('content')) || person.thumbnailUrl;

  return {
    ...person,
    images: image ? [image] : person.images,
    thumbnailUrl: image,
    sex: gender,
    dateOfBirth,
    height,
    eyeColor,
    nationality: nationality ? [nationality] : person.nationality,
    possibleCountries: nationality ? [nationality] : person.possibleCountries,
    charges: crime ? crime.split(/\s{2,}/).map(value => value.trim()).filter(Boolean) : person.charges,
    originalData: { ...((person.originalData && typeof person.originalData === 'object') ? person.originalData : {}), gender, height, eyeColor, dateOfBirth, nationality, crime },
  };
}

function parseEuList(html: string): WantedPerson[] {
  const $ = cheerio.load(html);
  const records: WantedPerson[] = [];
  $('.views-row').each((_, element) => {
    const row = $(element);
    const rawId = text(row.find('.views-field-nid .field-content').first().text());
    const name = text(row.find('.views-field-title .field-content').first().text());
    const path = text(row.find('.views-field-view-node .field-content').first().text());
    if (!rawId || !name || !path || name.toLowerCase() === 'arrested') return;

    const image = text(row.find('.views-field-field-picture .field-content').first().text());
    const country = text(row.find('.views-field-field-enfast-country .field-content').first().text());
    const status = text(row.find('.views-field-field-status .field-content').first().text());
    records.push(normalizePerson({
      source: 'eu-most-wanted',
      rawId,
      name,
      image: image ? new URL(image, EU_BASE_URL).toString() : null,
      sourceUrl: new URL(path, EU_BASE_URL).toString(),
      country,
      status,
      originalData: { rawId, name, path, image, country, status },
    }));
  });
  return records;
}

function parseMjspList(html: string): WantedPerson[] {
  const $ = cheerio.load(html);
  const records: WantedPerson[] = [];
  $('a[href*="/lista-de-procurados/"][href$="/view"]').each((_, element) => {
    const link = $(element);
    const sourceUrl = new URL(link.attr('href') || '', 'https://www.gov.br').toString();
    const name = text(link.text())?.split(/\s{2,}/)[0];
    if (!name) return;
    const rawId = sourceUrl.split('/').slice(-2, -1)[0];
    const image = link.closest('div.imagem').find('img').first().attr('src') || link.closest('div').find('img').first().attr('src');
    const date = text(link.text())?.match(/\d{2}\/\d{2}\/\d{4}/)?.[0] || null;
    records.push(normalizePerson({
      source: 'mjsp-captura',
      rawId,
      name,
      image: image ? new URL(image, sourceUrl).toString() : null,
      sourceUrl,
      country: 'Brasil',
      status: 'Wanted',
      description: date ? `Projeto Captura - publicado em ${date}` : 'Projeto Captura',
      originalData: { rawId, name, sourceUrl, image, date },
    }));
  });
  return records;
}

export async function getEuMostWantedData(): Promise<WantedPerson[]> {
  const cached = await getCachedRecords<WantedPerson>('eu-most-wanted');
  if (isFresh(cached)) return cached.map(record => record.payload);
  const html = await fetchHtml(EU_BASE_URL);
  const records = html ? parseEuList(html) : [];
  if (records.length > 0) await saveRecords('eu-most-wanted', records);
  return records;
}

export async function getMjspCapturaData(): Promise<WantedPerson[]> {
  const cached = await getCachedRecords<WantedPerson>('mjsp-captura');
  if (isFresh(cached)) return cached.map(record => record.payload);
  const records: WantedPerson[] = [];
  for (let offset = 0; offset <= 300; offset += 15) {
    const html = await fetchHtml(offset ? `${MJSP_BASE_URL}?b_start:int=${offset}` : MJSP_BASE_URL);
    const pageRecords = html ? parseMjspList(html) : [];
    if (pageRecords.length === 0) break;
    records.push(...pageRecords);
    if (pageRecords.length < 15) break;
  }
  const unique = Array.from(new Map(records.map(record => [record.id, record])).values());
  if (unique.length > 0) await saveRecords('mjsp-captura', unique);
  return unique;
}

export async function getPersonFromSource(source: WantedSource, rawId: string): Promise<WantedPerson | null> {
  if (source === 'eu-most-wanted' || source === 'mjsp-captura') {
    const cached = await getCachedRecord<WantedPerson>(source, rawId);
    const records = cached
      ? [cached.payload]
      : (source === 'eu-most-wanted' ? await getEuMostWantedData() : await getMjspCapturaData());
    const person = records.find(record => record.rawId === rawId) || null;
    if (!person) return null;

    if (source === 'eu-most-wanted') {
      const originalData = person.originalData && typeof person.originalData === 'object'
        ? person.originalData as { path?: string }
        : {};
      const sourceUrl = person.sourceUrl || (originalData.path ? new URL(originalData.path, EU_BASE_URL).toString() : null);
      if (sourceUrl) {
        const html = await fetchHtml(sourceUrl);
        if (html) {
          const enrichedPerson = enrichEuPerson({ ...person, sourceUrl }, html);
          await saveRecords(source, [enrichedPerson]);
          return enrichedPerson;
        }
      }
    }

    return person;
  }
  return null;
}
