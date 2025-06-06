
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
    // Simplified headers: Only explicitly set 'Accept'
    // Rely on default fetch client behavior for other headers like User-Agent
    const defaultHeaders: HeadersInit = {
      'Accept': 'application/json',
    };

    const finalHeaders = {
      ...defaultHeaders,
      ...options?.headers,
    };

    // Sanitize URL: remove any trailing colon just in case.
    // This is a precaution based on concerns about URL formatting in logs.
    const sanitizedUrl = url.endsWith(':') ? url.slice(0, -1) : url;

    const response = await fetch(sanitizedUrl, { // Use the sanitized URL
      ...options,
      headers: finalHeaders,
    });

    if (!response.ok) {
      console.error(`API error for ${sanitizedUrl}: ${response.status} ${response.statusText}`); // Log with sanitizedUrl
      const errorBody = await response.text();
      console.error('Error body:', errorBody);
      return null;
    }
    return response.json() as Promise<T>;
  } catch (error) {
    console.error(`Network error fetching ${url}:`, error); // Original URL in catch for broader context
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
  
  // Prioritize higher quality images over thumbnails
  const prioritizedImages = [
    ...fbiImageObjects.map(img => img.original).filter(Boolean),
    ...fbiImageObjects.map(img => img.large).filter(Boolean),
    // ...fbiImageObjects.map(img => img.thumb).filter(Boolean) // Thumbnails de-prioritized
  ].filter(Boolean) as string[];
  
  // If no original or large, then consider thumb as a last resort before placeholder
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
  } else if (Array.isArray(item.subjects) && (item.subjects.length === 0 || item.subjects.every(s => s.toLowerCase().includes("assistance") || s.toLowerCase().includes("information")))) {
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
  
  const bestThumbnail = uniqueImages.length > 0 ? uniqueImages[0] : primaryDisplayImage;

  return {
    id: `fbi-${item.uid}`,
    rawId: item.uid,
    source: 'fbi',
    name: item.title,
    images: uniqueImages.length > 0 ? uniqueImages : [primaryDisplayImage],
    thumbnailUrl: bestThumbnail, 
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

  // Prioritize images from the detailed /images endpoint if available
  if (detailedImagesFromApi && detailedImagesFromApi.length > 0 && detailedImagesFromApi[0]?._links?.self?.href) {
    primaryImageForDisplay = detailedImagesFromApi[0]._links.self.href;
    allImagesForGallery = detailedImagesFromApi
      .map(img => img._links?.self?.href)
      .filter(Boolean) as string[];
  }
  
  // Fallback to the thumbnail from the notice list if no detailed images were fetched or if primaryImageForDisplay is still undefined
  // AND ensure this thumbnail is not the one from the /images endpoint's root _links if better images are available
  if (!primaryImageForDisplay && item._links?.thumbnail?.href) {
     // Avoid using the general thumbnail if specific, higher-quality images are available from detailedImagesFromApi
    const generalThumbnailIsDifferent = !detailedImagesFromApi || 
                                        detailedImagesFromApi.length === 0 || 
                                        !detailedImagesFromApi.some(img => img._links?.self?.href === item._links?.thumbnail?.href);
    if (generalThumbnailIsDifferent) {
      primaryImageForDisplay = item._links.thumbnail.href;
    }
  }

  // Further fallback to a placeholder if no image URL could be determined or if detailed images exist but primary is not set
  if (!primaryImageForDisplay && allImagesForGallery.length > 0) {
    primaryImageForDisplay = allImagesForGallery[0]; // Use the first from the gallery if primary is still not set
  } else if (!primaryImageForDisplay) {
     primaryImageForDisplay = `https://placehold.co/300x400.png?text=${encodeURIComponent(fullName || 'No Image')}`;
  }
  
  // Ensure allImagesForGallery is populated, even if just with the primary or placeholder
  if (allImagesForGallery.length === 0) {
    if (primaryImageForDisplay && !primaryImageForDisplay.includes('placehold.co')) {
        allImagesForGallery.push(primaryImageForDisplay);
    } else if (!primaryImageForDisplay.includes('placehold.co')) { // Ensure we don't add placeholder if it's already the primary
        allImagesForGallery.push(`https://placehold.co/300x400.png?text=${encodeURIComponent(fullName || 'No Image')}`);
    }
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
    detailsUrl: `/person/interpol/${item.entity_id.replace('/', '-')}`,
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
        combinedList.push(normalizeInterpolItem(item)); 
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

    

    