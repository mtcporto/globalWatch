
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
        'User-Agent': 'GlobalWatchApp/1.0 (mailto:support@example.com)', // Added User-Agent
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
  const fbiImageObjects = item.images || [];
  // Prioritize 'large' then 'original' for images. Avoid 'thumb'.
  const primaryDisplayImage = fbiImageObjects.find(img => img.large)?.large || 
                              fbiImageObjects.find(img => img.original)?.original || 
                              fbiImageObjects.find(img => img.thumb)?.thumb || // Fallback to thumb if nothing else
                             `https://placehold.co/300x400.png?text=No+Image`;

  const allAvailableImages = fbiImageObjects
    .map(img => img.large || img.original) // Prioritize large/original for gallery
    .filter(Boolean) as string[];
  
  // Ensure primaryDisplayImage is in allAvailableImages if it's a valid URL
  const imageSet = new Set(allAvailableImages);
  if (primaryDisplayImage && !primaryDisplayImage.includes('placehold.co') && !imageSet.has(primaryDisplayImage)) {
    // If primaryDisplayImage was derived from thumb and not in large/original list, add it.
    // Or if for some reason it was missed.
    allAvailableImages.unshift(primaryDisplayImage);
  }


  let heightStr = null;
  if (item.height_max) {
    const feet = Math.floor(item.height_max / 12);
    const inches = item.height_max % 12;
    heightStr = `${feet}'${inches}" (${(item.height_max * 0.0254).toFixed(2)}m)`;
  }

  let classification: PersonClassification = 'WANTED_CRIMINAL';
  let caseTypeDesc: string | null = item.title || item.subjects?.join(' / ') || item.description;
  let actualCharges: string[] | null = item.subjects || null;

  const posterClass = item.poster_classification?.toLowerCase();
  const personClass = item.person_classification?.toLowerCase();
  const subjectsLower = item.subjects?.map(s => s.toLowerCase()) || [];
  const titleLower = item.title?.toLowerCase() || "";

  if (posterClass === 'missing' || subjectsLower.includes('kidnappings and missing persons') || subjectsLower.includes('missing person') || titleLower.includes('missing')) {
    classification = 'MISSING_PERSON';
    caseTypeDesc = item.description || `Missing since ${item.publication?.split('T')[0] || 'unknown date'}`;
    actualCharges = null;
  } else if (posterClass === 'information' || subjectsLower.includes('seeking information') || titleLower.includes('seeking information')) {
    classification = 'SEEKING_INFORMATION';
    caseTypeDesc = item.title || "Seeking Information";
    actualCharges = null;
  } else if (subjectsLower.includes('vicap unidentified persons') || titleLower.includes('unidentified') || titleLower.includes('jane doe') || titleLower.includes('john doe')) {
    classification = 'VICTIM_IDENTIFICATION';
    caseTypeDesc = item.description || "Unidentified Person";
    actualCharges = null;
  } else if (personClass === 'victim') {
    classification = 'VICTIM_IDENTIFICATION'; 
    caseTypeDesc = item.description || "Victim Identification";
    actualCharges = null;
  }

  return {
    id: `fbi-${item.uid}`,
    rawId: item.uid,
    source: 'fbi',
    name: item.title,
    images: allAvailableImages.length > 0 ? allAvailableImages : [primaryDisplayImage],
    thumbnailUrl: primaryDisplayImage, // Use the best available single image for card
    details: item.details || item.caution, 
    remarks: item.remarks,
    warningMessage: item.warning_message,
    rewardText: item.reward_text,
    sex: item.sex,
    race: item.race,
    nationality: item.nationality ? [item.nationality] : null,
    dateOfBirth: item.dates_of_publication?.[0]?.start_date ? null : item.publication?.split('T')[0], 
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

function normalizeInterpolItem(item: InterpolNotice, detailedImagesFromApi: InterpolImageDetail[] = []): CombinedWantedPerson {
  const nameParts = [];
  if (item.forename) nameParts.push(item.forename);
  if (item.name) nameParts.push(item.name);
  const fullName = nameParts.join(' ') || 'N/A';

  // For list view, _links.thumbnail.href is the direct image URL.
  // For detail view, we fetch /images and use _links.self.href from there.
  const interpolThumbnailDirectFromList = item._links?.thumbnail?.href; // From the main notice list

  let primaryImageForDisplay: string | undefined;
  let allImagesForGallery: string[] = [];

  if (detailedImagesFromApi && detailedImagesFromApi.length > 0) {
    // Detail view: Use images from the /images endpoint
    allImagesForGallery = detailedImagesFromApi
      .map(img => img._links?.self?.href)
      .filter(Boolean) as string[];
    primaryImageForDisplay = allImagesForGallery[0]; // Prioritize the first image from the detailed fetch
  }
  
  // Fallback for primary image if not set from detailed images, or for list view
  if (!primaryImageForDisplay) {
    primaryImageForDisplay = interpolThumbnailDirectFromList;
  }

  // Ensure a placeholder if no valid image URL is found
  if (!primaryImageForDisplay || !primaryImageForDisplay.startsWith('https://')) {
    primaryImageForDisplay = `https://placehold.co/300x400.png?text=No+Image`;
  }
  
  // Populate gallery images: if detailed images were fetched, use them. Otherwise, use the primary/thumbnail.
  if (allImagesForGallery.length === 0 && primaryImageForDisplay && primaryImageForDisplay.startsWith('https://')) {
    allImagesForGallery.push(primaryImageForDisplay);
  }
  if (allImagesForGallery.length === 0) { // Ensure placeholder if no images at all
    allImagesForGallery.push(`https://placehold.co/300x400.png?text=No+Image`);
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
    images: allImagesForGallery,
    thumbnailUrl: primaryImageForDisplay, // For card view
    details: item.arrest_warrants?.map(aw => `${aw.charge} (Issuing Country: ${aw.issuing_country_id || 'N/A'})`).join('; ') || undefined,
    sex: sex,
    nationality: item.nationalities,
    dateOfBirth: item.date_of_birth?.replace(/\//g, '-'),
    placeOfBirth: item.place_of_birth || item.country_of_birth_id,
    height: heightStr,
    weight: weightStr,
    eyeColor: item.eyes_colors_id?.join(', '), // Will be mapped by mapInterpolColorCodes in component
    hairColor: item.hairs_id?.join(', '), // Will be mapped by mapInterpolColorCodes in component
    distinguishingMarks: item.distinguishing_marks,
    charges: charges,
    originalData: item,
    detailsUrl: `/person/interpol/${item.entity_id.replace('/', '-')}`,
    classification: 'WANTED_CRIMINAL', 
    caseTypeDescription: charges?.join(' / ') || 'Wanted by Interpol',
  };
}

export async function getCombinedWantedList(page: number = 1, pageSize: number = 20): Promise<CombinedWantedPerson[]> {
  const fbiPageSize = Math.floor(pageSize / 2) + (pageSize % 2);
  const interpolPageSize = Math.floor(pageSize / 2);

  const fbiItemsPromise = fetchFBIWantedList(page, fbiPageSize);
  const interpolItemsPromise = fetchInterpolRedNotices(page, interpolPageSize);

  const [fbiItems, interpolItems] = await Promise.all([fbiItemsPromise, interpolItemsPromise]);

  const combinedList: CombinedWantedPerson[] = [];

  if (fbiItems) {
    fbiItems.forEach(item => combinedList.push(normalizeFBIItem(item)));
  }

  if (interpolItems) {
    for (const item of interpolItems) {
      combinedList.push(normalizeInterpolItem(item)); 
    }
  }
  
  return combinedList.sort((a, b) => {
    const dateA = (a.originalData as FBIWantedItem).publication ? new Date((a.originalData as FBIWantedItem).publication).getTime() : 0;
    const dateB = (b.originalData as FBIWantedItem).publication ? new Date((b.originalData as FBIWantedItem).publication).getTime() : 0;
    if (dateA && dateB) return dateB - dateA; 
    if (dateA) return -1; 
    if (dateB) return 1;
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
  if (person.images && person.images.length > 0 && person.images[0] && !person.images[0].includes('placehold.co')) {
    return person.images[0];
  }
  if (person.thumbnailUrl && !person.thumbnailUrl.includes('placehold.co')) {
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
  'BLK': 'Black', 'BRO': 'Brown', 'BLN': 'Blond', 'RED': 'Red', 'GRY': 'Gray', 'WHI': 'White', 'BAL': 'Bald', 'OTH': 'Other', 'XXX': 'Unknown',
};
export const EYE_COLOR_MAP: { [key: string]: string } = {
  'BLK': 'Black', 'BLU': 'Blue', 'BRO': 'Brown', 'GRN': 'Green', 'GRY': 'Gray', 'HAZ': 'Hazel', 'MAR': 'Maroon', 'MUL': 'Multicolor', 'PNK': 'Pink', 'XXX': 'Unknown',
};

export function mapInterpolColorCodes(codes: string[] | undefined, map: {[key: string]: string}): string | undefined {
  if (!codes || codes.length === 0) return undefined;
  return codes.map(code => map[code] || code).join(', ');
}
