import type {
  FBIWantedResponse,
  FBIWantedItem,
  InterpolNoticesResponse,
  InterpolNotice,
  CombinedWantedPerson,
  InterpolImagesResponse,
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
        // 'User-Agent': 'GlobalWatchApp/1.0 (+https://your-app-url.com/bot.html)' // Good practice
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
    // sort_on: 'publication', // Example: Sort by publication date
    // sort_order: 'desc',
  });
  const url = `${FBI_API_BASE_URL}?${params.toString()}`;
  const data = await fetchJson<FBIWantedResponse>(url);
  return data?.items || [];
}

export async function fetchFBIDetail(uid: string): Promise<FBIWantedItem | null> {
  // The FBI list endpoint returns full details, so if we have the UID, we can filter the main list
  // or fetch by a specific UID if the API supports it. For now, assume we refetch or use list data.
  // The example API doesn't show a direct /wanted/v1/item/{uid} endpoint.
  // We'll use the @id from the list item if needed.
  const url = `https://api.fbi.gov/@wanted-person/${uid}`; // This is a guess based on @id field
  // A more robust way if the above is not official, would be to fetch the list and find by UID.
  // Or use item.url which is often a link to the fbi.gov website page.
  // For now, let's assume the main list fetch is sufficient for card display and detail display
  // by passing the whole item or fetching list with specific UID query if available.
  // For this project, we will re-fetch the list and find the item. This is not optimal.
  const list = await fetchFBIWantedList(1, 500); // Fetch a larger list, assuming UID is within
  return list.find(item => item.uid === uid) || null;
}


// Interpol Data Fetching
export async function fetchInterpolRedNotices(page: number = 1, resultPerPage: number = 16): Promise<InterpolNotice[]> {
  // Interpol API seems to be 1-indexed for page if it uses it. Documentation isn't explicit.
  // The example provided is for ws-public.interpol.int, which supports resultPerPage and other filters.
  const params = new URLSearchParams({
    // ageMax: "50",
    // ageMin: "30",
    // freeText: "search term",
    // sexId: "M", // M, F, U
    // nationality: "US", // ISO 3166-1 alpha-2
    resultPerPage: resultPerPage.toString(),
    page: page.toString(),
  });
  const url = `${INTERPOL_API_BASE_URL}/red?${params.toString()}`;
  const data = await fetchJson<InterpolNoticesResponse>(url);
  return data?._embedded?.notices || [];
}

export async function fetchInterpolNoticeDetail(noticeId: string): Promise<InterpolNotice | null> {
  // noticeId is typically YYYY/NNNNN, convert to YYYY-NNNNN for API URL
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

  return {
    id: `fbi-${item.uid}`,
    rawId: item.uid,
    source: 'fbi',
    name: item.title,
    images: item.images?.map(img => img.original) || [mainImage],
    thumbnailUrl: thumbnailUrl,
    details: item.details || item.caution,
    remarks: item.remarks,
    warningMessage: item.warning_message,
    rewardText: item.reward_text,
    sex: item.sex,
    race: item.race,
    nationality: item.nationality ? [item.nationality] : null,
    dateOfBirth: null, // FBI API often gives age_range, not DOB
    age: item.age_range ? undefined : (item.age_max || item.age_min || undefined), // Or calculate from age_range
    placeOfBirth: item.place_of_birth,
    height: heightStr,
    weight: item.weight, // Needs conversion if not in preferred unit
    eyeColor: item.eyes,
    hairColor: item.hair,
    distinguishingMarks: item.scars_and_marks,
    charges: item.subjects,
    fieldOffices: item.field_offices,
    possibleCountries: item.possible_countries,
    aliases: item.aliases,
    originalData: item,
    detailsUrl: `/person/fbi/${item.uid}`,
  };
}

function normalizeInterpolItem(item: InterpolNotice, detailedImages: InterpolImageDetail[] = []): CombinedWantedPerson {
  const nameParts = [];
  if (item.forename) nameParts.push(item.forename);
  if (item.name) nameParts.push(item.name);
  const fullName = nameParts.join(' ') || 'N/A';

  const primaryImageUrl = detailedImages?.[0]?._links.picture?.href || item._links?.thumbnail?.href || `https://placehold.co/300x400.png?text=No+Image`;
  const allImages = detailedImages.map(img => img._links.picture?.href).filter(Boolean) as string[];
  if (allImages.length === 0 && primaryImageUrl !== `https://placehold.co/300x400.png?text=No+Image`) {
    allImages.push(primaryImageUrl);
  }
  
  let sex = null;
  if (item.sex_id === 'M') sex = 'Male';
  if (item.sex_id === 'F') sex = 'Female';

  let heightStr = item.height ? `${item.height.toFixed(2)}m` : null;
  let weightStr = item.weight ? `${item.weight}kg` : null;

  return {
    id: `interpol-${item.entity_id.replace('/', '-')}`,
    rawId: item.entity_id,
    source: 'interpol',
    name: fullName,
    firstName: item.forename,
    lastName: item.name,
    images: allImages.length > 0 ? allImages : [primaryImageUrl],
    thumbnailUrl: primaryImageUrl,
    details: item.arrest_warrants?.map(aw => `${aw.charge} (Issuing Country: ${aw.issuing_country_id || 'N/A'})`).join('; ') || undefined,
    sex: sex,
    nationality: item.nationalities,
    dateOfBirth: item.date_of_birth?.replace(/\//g, '-'), // Format YYYY-MM-DD
    placeOfBirth: item.place_of_birth || item.country_of_birth_id,
    height: heightStr,
    weight: weightStr,
    eyeColor: item.eyes_colors_id?.join(', '),
    hairColor: item.hairs_id?.join(', '),
    distinguishingMarks: item.distinguishing_marks,
    charges: item.arrest_warrants?.map(aw => aw.charge),
    originalData: item,
    detailsUrl: `/person/interpol/${item.entity_id.replace('/', '-')}`,
  };
}

export async function getCombinedWantedList(page: number = 1, pageSize: number = 10): Promise<CombinedWantedPerson[]> {
  const fbiItems = await fetchFBIWantedList(page, pageSize);
  const interpolItems = await fetchInterpolRedNotices(page, pageSize); // Interpol uses different paging logic, may need adjustment

  const combinedList: CombinedWantedPerson[] = [];

  if (fbiItems) {
    fbiItems.forEach(item => combinedList.push(normalizeFBIItem(item)));
  }

  if (interpolItems) {
    for (const item of interpolItems) {
      // For list view, we might not fetch detailed images to save API calls.
      // The thumbnail from _links might be sufficient.
      // If not, this part would need to fetch images for each Interpol item.
      // For simplicity now, using thumbnail if available.
      combinedList.push(normalizeInterpolItem(item));
    }
  }
  
  // Simple interleaving for now, could be sorted by date or other criteria
  return combinedList;
}


export async function getPersonDetails(source: 'fbi' | 'interpol', id: string): Promise<CombinedWantedPerson | null> {
  if (source === 'fbi') {
    const item = await fetchFBIDetail(id);
    return item ? normalizeFBIItem(item) : null;
  } else if (source === 'interpol') {
    // Interpol ID in URL is YYYY-NNNNN, but entity_id from list is YYYY/NNNNN
    // The 'id' parameter here should be the YYYY-NNNNN version.
    const item = await fetchInterpolNoticeDetail(id);
    if (item) {
      const images = await fetchInterpolNoticeImages(id);
      return normalizeInterpolItem(item, images);
    }
    return null;
  }
  return null;
}

// Helper to get a single image URL, prioritizing original/large FBI images or Interpol detailed images
export function getPrimaryImageUrl(person: CombinedWantedPerson): string {
  if (person.source === 'fbi') {
    const fbiItem = person.originalData as FBIWantedItem;
    return fbiItem.images?.[0]?.large || fbiItem.images?.[0]?.original || person.thumbnailUrl || `https://placehold.co/600x800.png?text=No+Image`;
  } else if (person.source === 'interpol') {
    // images array in CombinedWantedPerson for Interpol should already contain detailed image URLs
    return person.images?.[0] || person.thumbnailUrl || `https://placehold.co/600x800.png?text=No+Image`;
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

// Function to map Interpol color codes to names
export function mapInterpolColorCodes(codes: string[] | undefined, map: {[key: string]: string}): string | undefined {
  if (!codes || codes.length === 0) return undefined;
  return codes.map(code => map[code] || code).join(', ');
}
