
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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.99 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9', // Added Accept-Language header
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
  // Fetching a large list to find one item can be inefficient.
  // If the API supports direct fetching by UID, that would be better.
  // For now, this attempts to find it in a broader list.
  const list = await fetchFBIWantedList(1, 500); // Consider implications of fetching 500 items
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
  
  const primaryDisplayImage = fbiImageObjects.find(img => img.large)?.large || 
                              fbiImageObjects.find(img => img.original)?.original ||
                              // fbiImageObjects[0]?.thumb || // Avoid using thumb if possible
                             `https://placehold.co/300x400.png?text=No+Image`;

  const allAvailableImages = fbiImageObjects
    .map(img => img.original || img.large || img.thumb) // Prioritize original, then large, then thumb
    .filter(Boolean) as string[];
  
  const imageSet = new Set(allAvailableImages);
  if (primaryDisplayImage && !primaryDisplayImage.includes('placehold.co') && !imageSet.has(primaryDisplayImage)) {
    // This case might not be strictly necessary if allAvailableImages already includes the best options
    // allAvailableImages.unshift(primaryDisplayImage); // Re-evaluate if needed
  }


  let heightStr = null;
  if (item.height_max && item.height_min && item.height_min === item.height_max) { // only if max and min are same
    const feet = Math.floor(item.height_max / 12);
    const inches = item.height_max % 12;
    heightStr = `${feet}'${inches}" (${(item.height_max * 0.0254).toFixed(2)}m)`;
  } else if (item.height_max) {
     // If only max is available or min/max differ, could show range or just max in meters
     heightStr = `${(item.height_max * 0.0254).toFixed(2)}m (max)`;
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
  } else if (posterClass === 'victim' || personClass === 'victim' || subjectsLower.includes('vicap unidentified persons') || titleLower.includes('unidentified') || titleLower.includes('jane doe') || titleLower.includes('john doe')) {
    classification = 'VICTIM_IDENTIFICATION';
    caseTypeDesc = item.description || "Unidentified Person";
    actualCharges = null;
  } else if (!item.subjects || item.subjects.length === 0 || item.subjects.every(s => s.toLowerCase().includes("assistance") || s.toLowerCase().includes("information"))){
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

  const bestThumbnail = allAvailableImages.length > 0 ? allAvailableImages[0] : primaryDisplayImage;

  return {
    id: `fbi-${item.uid}`,
    rawId: item.uid,
    source: 'fbi',
    name: item.title,
    images: allAvailableImages.length > 0 ? allAvailableImages : [primaryDisplayImage],
    thumbnailUrl: bestThumbnail, 
    details: item.details || item.caution, 
    remarks: item.remarks,
    warningMessage: item.warning_message,
    rewardText: item.reward_text,
    sex: item.sex,
    race: item.race,
    nationality: item.nationality ? [item.nationality] : null,
    // Use dates_of_publication for actual birth date if available, otherwise it might be a general publication date
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

  // If detailedImagesFromApi are provided (from the /images endpoint for the detail page)
  if (detailedImagesFromApi && detailedImagesFromApi.length > 0) {
    allImagesForGallery = detailedImagesFromApi
      .map(img => img._links?.self?.href) // Use the self href from the detailed images
      .filter(Boolean) as string[];
    primaryImageForDisplay = allImagesForGallery[0]; // Prioritize the first image from this detailed list
  }
  
  // Fallback to the thumbnail from the main notice list if no detailed images were fetched or found
  if (!primaryImageForDisplay) {
    primaryImageForDisplay = item._links?.thumbnail?.href;
  }

  // If still no image, use placeholder
  if (!primaryImageForDisplay || !primaryImageForDisplay.startsWith('https://')) {
    primaryImageForDisplay = `https://placehold.co/300x400.png?text=No+Image`;
  }
  
  // Ensure allImagesForGallery has at least the primary image if it's valid
  if (allImagesForGallery.length === 0 && primaryImageForDisplay && primaryImageForDisplay.startsWith('https://')) {
    allImagesForGallery.push(primaryImageForDisplay);
  }
  if (allImagesForGallery.length === 0) { 
    allImagesForGallery.push(`https://placehold.co/300x400.png?text=No+Image`);
  }
  
  let sex = null;
  if (item.sex_id === 'M') sex = 'Male';
  if (item.sex_id === 'F') sex = 'Female';
  if (item.sex_id === 'U') sex = 'Unknown';


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
    thumbnailUrl: primaryImageForDisplay, // This will be the list thumbnail or the first detailed image
    details: item.arrest_warrants?.map(aw => `${aw.charge} (Issuing Country: ${aw.issuing_country_id || 'N/A'})`).join('; ') || undefined,
    sex: sex,
    nationality: item.nationalities,
    dateOfBirth: item.date_of_birth?.replace(/\//g, '-'), // Ensure consistent date format
    placeOfBirth: item.place_of_birth || item.country_of_birth_id,
    height: heightStr,
    weight: weightStr,
    eyeColor: item.eyes_colors_id?.map(code => EYE_COLOR_MAP[code] || code).join(', '), 
    hairColor: item.hairs_id?.map(code => HAIR_COLOR_MAP[code] || code).join(', '), 
    distinguishingMarks: item.distinguishing_marks,
    charges: charges,
    originalData: item,
    detailsUrl: `/person/interpol/${item.entity_id.replace('/', '-')}`,
    classification: 'WANTED_CRIMINAL', // Interpol Red Notices are generally for wanted individuals
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
    fbiItems.forEach(item => {
      if (item && item.uid) { // Basic validation
         combinedList.push(normalizeFBIItem(item));
      }
    });
  }

  if (interpolItems) {
    for (const item of interpolItems) {
      if (item && item.entity_id) { // Basic validation
        // For the list view, we don't fetch detailed images yet to save API calls
        combinedList.push(normalizeInterpolItem(item)); 
      }
    }
  }
  
  // Simple sort by source for consistent ordering, can be made more sophisticated
  return combinedList.sort((a, b) => {
    const dateA = (a.originalData as FBIWantedItem).publication ? new Date((a.originalData as FBIWantedItem).publication).getTime() : 0;
    const dateB = (b.originalData as FBIWantedItem).publication ? new Date((b.originalData as FBIWantedItem).publication).getTime() : 0;
    
    // Prioritize items with publication dates, newest first
    if (dateA && dateB) return dateB - dateA; 
    if (dateA) return -1; // a has date, b doesn't, so a comes first
    if (dateB) return 1;  // b has date, a doesn't, so b comes first
    
    // Fallback sort by name if no dates or dates are equal
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
  // This fallback for thumbnail might be redundant if images[0] is already the best one.
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

    
