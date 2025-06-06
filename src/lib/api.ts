
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
async function fetchJson<T>(url: string, options: RequestInit = {}): Promise<T | null> {
  try {
    // Sanitize URL: remove any trailing colon just in case.
    const sanitizedUrl = url.endsWith(':') ? url.slice(0, -1) : url;

    const defaultHeadersInit: Record<string, string> = {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9,es;q=0.8', // Added a common Accept-Language
    };

    const requestHeaders = new Headers(options.headers);

    // Apply default headers if not already present in options.headers
    for (const key in defaultHeadersInit) {
      if (!requestHeaders.has(key)) {
        requestHeaders.set(key, defaultHeadersInit[key]);
      }
    }

    const requestOptions: RequestInit = {
      ...options,
      headers: requestHeaders,
    };

    const response = await fetch(sanitizedUrl, requestOptions);

    if (!response.ok) {
      console.error(`API error for ${sanitizedUrl}: ${response.status} ${response.statusText}`);
      const errorBody = await response.text();
      console.error('Error body:', errorBody);
      return null;
    }
    return response.json() as Promise<T>;
  } catch (error) {
    console.error(`Network error fetching ${url}:`, error); // Log original url for clarity
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
  const formattedNoticeId = noticeId.replace(/\//g, '-');
  const url = `${INTERPOL_API_BASE_URL}/red/${formattedNoticeId}`;
  return fetchJson<InterpolNotice>(url);
}

export async function fetchInterpolNoticeImages(noticeId: string): Promise<InterpolImageDetail[]> {
  const formattedNoticeId = noticeId.replace(/\//g, '-');
  const url = `${INTERPOL_API_BASE_URL}/red/${formattedNoticeId}/images`;
  const data = await fetchJson<InterpolImagesResponse>(url);
  return data?._embedded?.images || [];
}


// Data Normalization
function normalizeFBIItem(item: FBIWantedItem): CombinedWantedPerson {
  const fbiImageObjects = item.images || [];

  const prioritizedImages = [
    ...fbiImageObjects.map(img => img.large).filter(Boolean),
    ...fbiImageObjects.map(img => img.original).filter(Boolean),
  ].filter(Boolean) as string[];

  if (prioritizedImages.length === 0) {
    const thumbs = fbiImageObjects.map(img => img.thumb).filter(Boolean) as string[];
    if (thumbs.length > 0) {
      prioritizedImages.push(thumbs[0]);
    }
  }
  
  const uniqueImages = Array.from(new Set(prioritizedImages));
  const primaryDisplayImage = uniqueImages.length > 0 ? uniqueImages[0] : `https://placehold.co/300x400.png?text=No+Image`;


  let heightStr = null;
  if (item.height_max && item.height_min && item.height_min === item.height_max && item.height_max > 0) {
    const feet = Math.floor(item.height_max / 12);
    const inches = item.height_max % 12;
    heightStr = `${feet}'${inches}" (${(item.height_max * 0.0254).toFixed(2)}m)`;
  } else if (item.height_max && item.height_max > 0) {
     heightStr = `${(item.height_max * 0.0254).toFixed(2)}m (max)`;
  } else if (item.height_min && item.height_min > 0) {
    const feet = Math.floor(item.height_min / 12);
    const inches = item.height_min % 12;
    heightStr = `At least ${feet}'${inches}" (${(item.height_min * 0.0254).toFixed(2)}m)`;
  }


  let classification: PersonClassification = 'WANTED_CRIMINAL';
  let caseTypeDesc: string | null = item.title || item.subjects?.join(' / ') || item.description;
  let actualCharges: string[] | null = item.subjects || null;

  const posterClass = item.poster_classification?.toLowerCase();
  const personClass = item.person_classification?.toLowerCase();
  const subjectsLower = item.subjects?.map(s => s.toLowerCase()) || [];
  const titleLower = item.title?.toLowerCase() || "";

  if (posterClass === 'missing' || personClass === 'missing person' || subjectsLower.includes('kidnappings and missing persons') || subjectsLower.includes('missing person') || titleLower.includes('missing')) {
    classification = 'MISSING_PERSON';
    caseTypeDesc = item.description || `Missing since ${item.publication?.split('T')[0] || 'unknown date'}`;
    actualCharges = null;
  } else if (posterClass === 'information' || personClass === 'seeking information' || subjectsLower.includes('seeking information') || titleLower.includes('seeking information')) {
    classification = 'SEEKING_INFORMATION';
    caseTypeDesc = item.title || "Seeking Information";
    actualCharges = null;
  } else if (posterClass === 'victim' || personClass === 'victim' || subjectsLower.includes('vicap unidentified persons') || titleLower.includes('unidentified') || titleLower.includes('jane doe') || titleLower.includes('john doe')) {
    classification = 'VICTIM_IDENTIFICATION';
    caseTypeDesc = item.description || "Unidentified Person";
    actualCharges = null;
  } else if (Array.isArray(item.subjects) && (item.subjects.length === 0 || item.subjects.every(s => s.toLowerCase().includes("assistance") || s.toLowerCase().includes("information")))){
     if(titleLower.includes("seeking information")){
        classification = 'SEEKING_INFORMATION';
        caseTypeDesc = item.title || "Seeking Information";
        actualCharges = null;
     } else if (titleLower.includes("unidentified") || titleLower.includes("victim") || titleLower.includes("jane doe") || titleLower.includes("john doe")) {
        classification = 'VICTIM_IDENTIFICATION';
        caseTypeDesc = item.description || "Unidentified Person";
        actualCharges = null;
     }
  }
  
  return {
    id: `fbi-${item.uid}`,
    rawId: item.uid,
    source: 'fbi',
    name: item.title,
    images: uniqueImages.length > 0 ? uniqueImages : [primaryDisplayImage],
    thumbnailUrl: primaryDisplayImage,
    details: item.details || item.caution,
    remarks: item.remarks,
    warningMessage: item.warning_message,
    rewardText: item.reward_text,
    sex: item.sex,
    race: item.race,
    nationality: item.nationality ? [item.nationality] : null,
    dateOfBirth: item.dates_of_birth_used?.[0] || null,
    age: item.age_range ? undefined : (item.age_max || item.age_min || undefined),
    age_range: item.age_range,
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

function normalizeInterpolItem(item: InterpolNotice, detailedImagesFromApi?: InterpolImageDetail[]): CombinedWantedPerson {
  const nameParts = [];
  if (item.forename) nameParts.push(item.forename);
  if (item.name) nameParts.push(item.name);
  const fullName = nameParts.join(' ') || 'N/A';

  let primaryImageForDisplay: string | undefined;
  let allImagesForGallery: string[] = [];

  if (detailedImagesFromApi && detailedImagesFromApi.length > 0 && detailedImagesFromApi[0]?._links?.self?.href) {
    primaryImageForDisplay = detailedImagesFromApi[0]._links.self.href;
    allImagesForGallery = detailedImagesFromApi
      .map(img => img._links?.self?.href)
      .filter(Boolean) as string[];
  } else if (item._links?.thumbnail?.href) { // Fallback for list view or if detail images fail
    primaryImageForDisplay = item._links.thumbnail.href;
     if (primaryImageForDisplay && !primaryImageForDisplay.includes('placehold.co') && !primaryImageForDisplay.includes('No+Image')) {
        allImagesForGallery.push(primaryImageForDisplay); // Add to gallery if it's a real image
    }
  }

  if (!primaryImageForDisplay) {
     primaryImageForDisplay = `https://placehold.co/300x400.png?text=${encodeURIComponent(fullName || 'No Image')}`;
  }
  // Ensure primary display image is in the gallery if it's a real image and not already there
  if (primaryImageForDisplay && !primaryImageForDisplay.includes('placehold.co') && !allImagesForGallery.includes(primaryImageForDisplay)) {
    allImagesForGallery.unshift(primaryImageForDisplay); 
  }
  if (allImagesForGallery.length === 0 && primaryImageForDisplay && !primaryImageForDisplay.includes('placehold.co')) {
     allImagesForGallery.push(primaryImageForDisplay);
  }
  // Remove duplicates just in case
  allImagesForGallery = Array.from(new Set(allImagesForGallery));


  let sex = null;
  if (item.sex_id === 'M') sex = 'Male';
  if (item.sex_id === 'F') sex = 'Female';
  if (item.sex_id === 'U') sex = 'Unknown';


  let heightStr = item.height ? `${item.height.toFixed(2)}m` : null;
  let weightStr = item.weight ? `${item.weight}kg` : null;

  const charges = item.arrest_warrants?.map(aw => aw.charge);

  return {
    id: `interpol-${item.entity_id.replace(/\//g, '-')}`,
    rawId: item.entity_id,
    source: 'interpol',
    name: fullName,
    firstName: item.forename,
    lastName: item.name,
    images: allImagesForGallery.length > 0 ? allImagesForGallery : [primaryImageForDisplay],
    thumbnailUrl: primaryImageForDisplay,
    details: item.arrest_warrants?.map(aw => `${aw.charge} (Issuing Country: ${aw.issuing_country_id || 'N/A'})`).join('; ') || undefined,
    sex: sex,
    nationality: item.nationalities,
    dateOfBirth: item.date_of_birth?.replace(/\//g, '-'),
    placeOfBirth: item.place_of_birth || item.country_of_birth_id,
    height: heightStr,
    weight: weightStr,
    eyeColor: item.eyes_colors_id?.map(code => EYE_COLOR_MAP[code] || code).join(', '),
    hairColor: item.hairs_id?.map(code => HAIR_COLOR_MAP[code] || code).join(', '),
    distinguishingMarks: item.distinguishing_marks,
    charges: charges,
    originalData: item,
    detailsUrl: `/person/interpol/${item.entity_id.replace(/\//g, '-')}`,
    classification: 'WANTED_CRIMINAL',
    caseTypeDescription: charges?.join(' / ') || 'Wanted by Interpol',
  };
}

export async function getCombinedWantedList(page: number = 1, pageSize: number = 20): Promise<CombinedWantedPerson[]> {
  const fbiPageSize = pageSize <= 1 ? pageSize : Math.max(1, Math.floor(pageSize / 2) + (pageSize % 2));
  const interpolPageSize = pageSize <= 1 ? (pageSize > 0 ? 0 : 0) : Math.max(0, Math.floor(pageSize / 2));


  const fbiItemsPromise = fetchFBIWantedList(page, fbiPageSize);
  const interpolItemsPromise = interpolPageSize > 0 ? fetchInterpolRedNotices(page, interpolPageSize) : Promise.resolve([]);

  const [fbiItems, interpolItems] = await Promise.all([fbiItemsPromise, interpolItemsPromise]);

  const combinedList: CombinedWantedPerson[] = [];

  if (fbiItems) {
    fbiItems.forEach(item => {
      if (item && item.uid) {
         combinedList.push(normalizeFBIItem(item));
      }
    });
  }

  if (interpolItems) {
    for (const item of interpolItems) {
      if (item && item.entity_id) {
        combinedList.push(normalizeInterpolItem(item, undefined));
      }
    }
  }

  return combinedList.sort((a, b) => {
    const dateAValue = (a.originalData as FBIWantedItem).publication;
    const dateBValue = (b.originalData as FBIWantedItem).publication;

    const dateA = dateAValue ? new Date(dateAValue).getTime() : 0;
    const dateB = dateBValue ? new Date(dateBValue).getTime() : 0;

    if (dateA && dateB) return dateB - dateA;
    if (dateA) return -1;
    if (dateB) return 1;

    return (a.name || "").localeCompare(b.name || "");
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
  if (person.images && person.images.length > 0 && person.images[0] && !person.images[0].includes('placehold.co')) {
    return person.images[0];
  }
  if (person.thumbnailUrl && !person.thumbnailUrl.includes('placehold.co') && !person.thumbnailUrl.includes('No+Image')) {
    return person.thumbnailUrl;
  }
  return `https://placehold.co/600x800.png?text=${encodeURIComponent(person.name || 'N/A')}`;
}

export const SEX_MAP: { [key: string]: string } = {
  'M': 'Male',
  'F': 'Female',
  'U': 'Unknown',
};

export const HAIR_COLOR_MAP: { [key: string]: string } = {
  'BLK': 'Black', 'BRO': 'Brown', 'BLN': 'Blond', 'RED': 'Red', 'GRY': 'Gray', 'WHI': 'White', 'BAL': 'Bald', 'OTH': 'Other', 'XXX': 'Unknown', 'SDY': 'Sandy', 'PLE': 'Pale', 'ONG': 'Orange'
};
export const EYE_COLOR_MAP: { [key: string]: string } = {
  'BLK': 'Black', 'BLU': 'Blue', 'BRO': 'Brown', 'GRN': 'Green', 'GRY': 'Gray', 'HAZ': 'Hazel', 'MAR': 'Maroon', 'MUL': 'Multicolor', 'PNK': 'Pink', 'XXX': 'Unknown', 'PLE': 'Pale', 'VIO': 'Violet'
};

export function mapInterpolColorCodes(codes: string[] | undefined, map: {[key: string]: string}): string | undefined {
  if (!codes || codes.length === 0) return undefined;
  return codes.map(code => map[code] || code).join(', ');
}
