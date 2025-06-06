
import type {
  FBIWantedResponse,
  FBIWantedItem,
  InterpolNoticesResponse,
  InterpolNotice,
  CombinedWantedPerson,
  InterpolImagesResponse,
  InterpolImageDetail,
  PersonClassification,
} from './types';

const FBI_API_BASE_URL = 'https://api.fbi.gov/wanted/v1/list';
const INTERPOL_API_BASE_URL = 'https://ws-public.interpol.int/notices/v1';

// Helper to safely fetch JSON
async function fetchJson<T>(url: string, options?: RequestInit): Promise<T | null> {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'GlobalWatchApp/1.0',
        ...options?.headers,
      },
    });
    if (!response.ok) {
      console.error(`API error for ${url}: ${response.status} ${response.statusText}`);
      const errorBody = await response.text();
      console.error('Error body:', errorBody);
      return null;
    }
    return response.json() as Promise<T>;
  } catch (error) {
    console.error(`Network error fetching ${url}:`, error);
    return null;
  }
}


// FBI Data Fetching
export async function fetchFBIWantedList(page: number = 1, pageSize: number = 20): Promise<FBIWantedItem[]> {
  const params = new URLSearchParams({
    pageSize: pageSize.toString(),
    page: page.toString(),
  });
  const url = `${FBI_API_BASE_URL}?${params.toString()}`;
  const data = await fetchJson<FBIWantedResponse>(url);
  return data?.items || [];
}

export async function fetchFBIDetail(uid: string): Promise<FBIWantedItem | null> {
  const list = await fetchFBIWantedList(1, 500); 
  return list.find(item => item.uid === uid) || null;
}


// Interpol Data Fetching
export async function fetchInterpolRedNotices(page: number = 1, resultPerPage: number = 20): Promise<InterpolNotice[]> {
  const params = new URLSearchParams({
    resultPerPage: resultPerPage.toString(),
    page: page.toString(),
  });
  const url = `${INTERPOL_API_BASE_URL}/red?${params.toString()}`;
  const data = await fetchJson<InterpolNoticesResponse>(url);
  return data?._embedded?.notices || [];
}

export async function fetchInterpolNoticeDetail(noticeId: string): Promise<InterpolNotice | null> {
  const formattedNoticeId = noticeId.replace('/', '-');
  const url = `${INTERPOL_API_BASE_URL}/red/${formattedNoticeId}`;
  return fetchJson<InterpolNotice>(url);
}

export async function fetchInterpolNoticeImages(noticeId: string): Promise<InterpolImageDetail[]> {
  const formattedNoticeId = noticeId.replace('/', '-');
  const url = `${INTERPOL_API_BASE_URL}/red/${formattedNoticeId}/images`;
  const data = await fetchJson<InterpolImagesResponse>(url);
  return data?._embedded?.images || [];
}


// Data Normalization
function normalizeFBIItem(item: FBIWantedItem): CombinedWantedPerson {
  const mainImage = item.images?.[0]?.original || `https://placehold.co/300x400.png?text=No+Image`;
  const thumbnailUrl = item.images?.[0]?.thumb || mainImage;
  
  let heightStr = null;
  if (item.height_max) {
    const feet = Math.floor(item.height_max / 12);
    const inches = item.height_max % 12;
    heightStr = `${feet}'${inches}" (${(item.height_max * 0.0254).toFixed(2)}m)`;
  }

  let classification: PersonClassification = 'WANTED_CRIMINAL';
  let caseTypeDesc: string | null = item.subjects?.join(' / ') || item.description || item.title;
  let actualCharges: string[] | null = item.subjects || null;

  const posterClass = item.poster_classification?.toLowerCase();
  const personClass = item.person_classification?.toLowerCase();
  const subjectsLower = item.subjects?.map(s => s.toLowerCase()) || [];

  if (posterClass === 'missing' || subjectsLower.includes('kidnappings and missing persons') || subjectsLower.includes('missing person')) {
    classification = 'MISSING_PERSON';
    caseTypeDesc = item.description || `Missing since ${item.publication?.split('T')[0] || 'unknown date'}`;
    actualCharges = null;
  } else if (posterClass === 'information' || subjectsLower.includes('seeking information')) {
    classification = 'SEEKING_INFORMATION';
    caseTypeDesc = item.title || "Seeking Information";
    actualCharges = null;
  } else if (subjectsLower.includes('vicap unidentified persons')) {
    classification = 'VICTIM_IDENTIFICATION';
    caseTypeDesc = item.description || "Unidentified Person";
    actualCharges = null;
  } else if (personClass === 'victim') {
    classification = 'VICTIM_IDENTIFICATION';
    caseTypeDesc = item.description || "Victim Identification";
    actualCharges = null;
  } else if (item.status === 'captured') {
     // Keep as wanted, but could be further refined if needed
  }


  return {
    id: `fbi-${item.uid}`,
    rawId: item.uid,
    source: 'fbi',
    name: item.title,
    images: item.images?.map(img => img.original) || [mainImage],
    thumbnailUrl: thumbnailUrl,
    details: item.details || item.caution, // Caution often contains important details
    remarks: item.remarks,
    warningMessage: item.warning_message,
    rewardText: item.reward_text,
    sex: item.sex,
    race: item.race,
    nationality: item.nationality ? [item.nationality] : null,
    dateOfBirth: item.dates_of_publication?.[0]?.start_date ? null : item.publication?.split('T')[0], // Simplified DOB logic, needs refinement if actual DOB available
    age: item.age_range ? undefined : (item.age_max || item.age_min || undefined), 
    placeOfBirth: item.place_of_birth,
    height: heightStr,
    weight: item.weight,
    eyeColor: item.eyes,
    hairColor: item.hair,
    distinguishingMarks: item.scars_and_marks,
    charges: actualCharges,
    fieldOffices: item.field_offices,
    possibleCountries: item.possible_countries,
    aliases: item.aliases,
    originalData: item,
    detailsUrl: `/person/fbi/${item.uid}`,
    classification: classification,
    caseTypeDescription: caseTypeDesc,
  };
}

function normalizeInterpolItem(item: InterpolNotice, detailedImages: InterpolImageDetail[] = []): CombinedWantedPerson {
  const nameParts = [];
  if (item.forename) nameParts.push(item.forename);
  if (item.name) nameParts.push(item.name);
  const fullName = nameParts.join(' ') || 'N/A';

  const interpolThumbnailDirect = item._links?.thumbnail?.href;
  const primaryDetailedImage = detailedImages?.[0]?._links?.picture?.href;

  const primaryImageUrl = primaryDetailedImage || interpolThumbnailDirect || `https://placehold.co/300x400.png?text=No+Image`;
  
  let allImages: string[] = [];
  if (detailedImages && detailedImages.length > 0) {
    allImages = detailedImages.map(img => img._links?.picture?.href).filter(Boolean) as string[];
  }
  if (allImages.length === 0 && primaryImageUrl.startsWith('https://')) {
      allImages.push(primaryImageUrl);
  }
   if (allImages.length === 0) { // Ensure placeholder if no images
    allImages.push(`https://placehold.co/300x400.png?text=No+Image`);
  }
  
  let sex = null;
  if (item.sex_id === 'M') sex = 'Male';
  if (item.sex_id === 'F') sex = 'Female';

  let heightStr = item.height ? `${item.height.toFixed(2)}m` : null;
  let weightStr = item.weight ? `${item.weight}kg` : null;
  
  const charges = item.arrest_warrants?.map(aw => aw.charge);

  return {
    id: `interpol-${item.entity_id.replace('/', '-')}`,
    rawId: item.entity_id,
    source: 'interpol',
    name: fullName,
    firstName: item.forename,
    lastName: item.name,
    images: allImages,
    thumbnailUrl: primaryImageUrl,
    details: item.arrest_warrants?.map(aw => `${aw.charge} (Issuing Country: ${aw.issuing_country_id || 'N/A'})`).join('; ') || undefined,
    sex: sex,
    nationality: item.nationalities,
    dateOfBirth: item.date_of_birth?.replace(/\//g, '-'),
    placeOfBirth: item.place_of_birth || item.country_of_birth_id,
    height: heightStr,
    weight: weightStr,
    eyeColor: item.eyes_colors_id?.join(', '),
    hairColor: item.hairs_id?.join(', '),
    distinguishingMarks: item.distinguishing_marks,
    charges: charges,
    originalData: item,
    detailsUrl: `/person/interpol/${item.entity_id.replace('/', '-')}`,
    classification: 'WANTED_CRIMINAL', 
    caseTypeDescription: charges?.join(' / ') || 'Wanted by Interpol',
  };
}

export async function getCombinedWantedList(page: number = 1, pageSize: number = 20): Promise<CombinedWantedPerson[]> {
  const fbiItems = await fetchFBIWantedList(page, Math.floor(pageSize / 2) + (pageSize % 2)); // Split page size
  const interpolItems = await fetchInterpolRedNotices(page, Math.floor(pageSize / 2));

  const combinedList: CombinedWantedPerson[] = [];

  if (fbiItems) {
    fbiItems.forEach(item => combinedList.push(normalizeFBIItem(item)));
  }

  if (interpolItems) {
    for (const item of interpolItems) {
      combinedList.push(normalizeInterpolItem(item)); // Pass empty array for detailedImages for list view
    }
  }
  
  return combinedList.sort((a, b) => {
    const dateA = a.originalData.publication ? new Date(a.originalData.publication).getTime() : 0;
    const dateB = b.originalData.publication ? new Date(b.originalData.publication).getTime() : 0;
    if (dateA && dateB) return dateB - dateA; // Sort by publication date descending if available
    return 0;
  });
}


export async function getPersonDetails(source: 'fbi' | 'interpol', id: string): Promise<CombinedWantedPerson | null> {
  if (source === 'fbi') {
    const item = await fetchFBIDetail(id);
    return item ? normalizeFBIItem(item) : null;
  } else if (source === 'interpol') {
    const item = await fetchInterpolNoticeDetail(id);
    if (item) {
      const images = await fetchInterpolNoticeImages(id);
      return normalizeInterpolItem(item, images);
    }
    return null;
  }
  return null;
}

export function getPrimaryImageUrl(person: CombinedWantedPerson): string {
  if (person.images && person.images.length > 0 && person.images[0] !== `https://placehold.co/300x400.png?text=No+Image`) {
    return person.images[0];
  }
  return person.thumbnailUrl || `https://placehold.co/600x800.png?text=No+Image`;
}

export const SEX_MAP: { [key: string]: string } = {
  'M': 'Male',
  'F': 'Female',
  'U': 'Unknown',
};

export const HAIR_COLOR_MAP: { [key: string]: string } = {
  'BLK': 'Black', 'BRO': 'Brown', 'BLN': 'Blond', 'RED': 'Red', 'GRY': 'Gray', 'WHI': 'White', 'BAL': 'Bald', 'OTH': 'Other', 'XXX': 'Unknown',
};
export const EYE_COLOR_MAP: { [key: string]: string } = {
  'BLK': 'Black', 'BLU': 'Blue', 'BRO': 'Brown', 'GRN': 'Green', 'GRY': 'Gray', 'HAZ': 'Hazel', 'MAR': 'Maroon', 'MUL': 'Multicolor', 'PNK': 'Pink', 'XXX': 'Unknown',
};

export function mapInterpolColorCodes(codes: string[] | undefined, map: {[key: string]: string}): string | undefined {
  if (!codes || codes.length === 0) return undefined;
  return codes.map(code => map[code] || code).join(', ');
}
