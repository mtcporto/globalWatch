
import type {
  FBIWantedResponse,
  FBIWantedItem,
  WantedPerson,
  PersonClassification,
} from './types';

const FBI_API_BASE_URL = 'https://api.fbi.gov/wanted/v1/list';

// Helper function to introduce a delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to safely fetch JSON
async function fetchJson<T>(url: string, options: RequestInit = {}): Promise<T | null> {
  try {
    const sanitizedUrl = url.endsWith(':') ? url.slice(0, -1) : url;

    const defaultHeaders: HeadersInit = {
      'Accept': 'application/json, text/plain, */*',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    };

    const requestHeaders = new Headers(options.headers);

    for (const [key, value] of Object.entries(defaultHeaders)) {
      if (!requestHeaders.has(key) && value) {
        requestHeaders.set(key, value as string);
      }
    }
     if (!requestHeaders.has('Accept')) {
        requestHeaders.set('Accept', 'application/json');
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
    console.error(`Network error fetching ${url}:`, error);
    return null;
  }
}

// Fetches a single page from the FBI Wanted API
async function fetchSingleFBIPage(page: number, pageSize: number): Promise<FBIWantedResponse | null> {
  const params = new URLSearchParams({
    pageSize: pageSize.toString(),
    page: page.toString(),
    sort_on: 'publication',
    sort_order: 'desc',
  });
  const url = `${FBI_API_BASE_URL}?${params.toString()}`;
  return fetchJson<FBIWantedResponse>(url);
}


// Data Normalization for FBI Item
function normalizeFBIItem(item: FBIWantedItem): WantedPerson {
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
  const primaryDisplayImage = uniqueImages.length > 0 ? uniqueImages[0] : `https://placehold.co/300x400.png?text=${encodeURIComponent(item.title || 'No Image')}`;


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
  const detailsLower = item.details?.toLowerCase() || "";
  const descriptionLower = item.description?.toLowerCase() || "";


  // --- Classification Logic ---

  // 1. Check explicit classifications first (e.g., from poster_classification, person_classification)
  if (posterClass === 'missing' || personClass === 'missing person') {
    classification = 'MISSING_PERSON';
  } else if (posterClass === 'information' || personClass === 'seeking information') {
    classification = 'SEEKING_INFORMATION';
  } else if (posterClass === 'victim' || personClass === 'victim') {
    classification = 'VICTIM_IDENTIFICATION';
  }

  // 2. If still 'WANTED_CRIMINAL', check subjects for more specific non-criminal types
  if (classification === 'WANTED_CRIMINAL') {
    if (subjectsLower.some(s => s.includes('vicap missing persons') || s.includes('kidnappings and missing persons') || s.includes('missing person'))) {
      classification = 'MISSING_PERSON';
    } else if (subjectsLower.some(s => s.includes('seeking information'))) {
      classification = 'SEEKING_INFORMATION';
    } else if (subjectsLower.some(s => s.includes('vicap unidentified persons') || s.includes('vicap homicides and sexual assaults') || s.includes('unidentified human remains') || s.includes('homicide victim') || s.includes('sexual assault victim'))) {
      classification = 'VICTIM_IDENTIFICATION';
    }
  }

  // 3. If still 'WANTED_CRIMINAL', check title for hints (less reliable)
  if (classification === 'WANTED_CRIMINAL') {
    if (titleLower.includes('missing person') || (titleLower.includes('missing') && !titleLower.includes("information for missing"))) {
        classification = 'MISSING_PERSON';
    } else if (titleLower.includes('seeking information') || titleLower.includes('information sought')) {
        classification = 'SEEKING_INFORMATION';
    } else if (titleLower.includes('unidentified') || titleLower.includes('jane doe') || titleLower.includes('john doe') || titleLower.includes('victim identification') || titleLower.includes('homicide victim') || titleLower.includes('sexual assault victim') || titleLower.includes('victim of homicide')) {
        classification = 'VICTIM_IDENTIFICATION';
    }
  }
  
  // 4. If still 'WANTED_CRIMINAL', check description and details (even less reliable)
  if (classification === 'WANTED_CRIMINAL') {
    const combinedTextLower = `${descriptionLower} ${detailsLower}`;
    if (combinedTextLower.includes('missing person')) {
        classification = 'MISSING_PERSON';
    } else if (combinedTextLower.includes('seeking information')) {
        classification = 'SEEKING_INFORMATION';
    } else if (combinedTextLower.includes('unidentified person') || combinedTextLower.includes('unidentified human remains') || combinedTextLower.includes('victim of homicide') || combinedTextLower.includes('victim of sexual assault')) {
        classification = 'VICTIM_IDENTIFICATION';
    }
  }

  // 5. Final check and refinement, especially for ViCAP cases that might still be WANTED_CRIMINAL
  // This step tries to catch edge cases where a ViCAP item might not have been classified correctly earlier.
  if (classification === 'WANTED_CRIMINAL' && (subjectsLower.includes('vicap') || titleLower.includes('vicap'))) {
      if (subjectsLower.some(s => s.includes('unidentified') || s.includes('homicides and sexual assaults') || s.includes('victim')) ||
          titleLower.includes('unidentified') || titleLower.includes('victim')) {
          classification = 'VICTIM_IDENTIFICATION';
      } else if (subjectsLower.some(s => s.includes('seeking information')) || titleLower.includes('seeking information')) {
          classification = 'SEEKING_INFORMATION';
      }
      // ViCAP Missing Persons should generally be caught by step 2.
  }
  
  // If subjects are empty or only contain vague terms like "assistance" and still classified as WANTED_CRIMINAL, re-evaluate based on title.
  if (classification === 'WANTED_CRIMINAL' && Array.isArray(item.subjects) && (item.subjects.length === 0 || item.subjects.every(s => s.toLowerCase().includes("assistance")))) {
    if (titleLower.includes('missing')) {
      classification = 'MISSING_PERSON';
    } else if (titleLower.includes('seeking information')) {
      classification = 'SEEKING_INFORMATION';
    } else if (titleLower.includes('unidentified') || titleLower.includes('jane doe') || titleLower.includes('john doe') || titleLower.includes('victim')) {
      classification = 'VICTIM_IDENTIFICATION';
    } else if (item.subjects.length === 0 && !item.title && !item.description && !item.details) {
      classification = 'UNSPECIFIED';
    }
  }


  // --- Set caseTypeDesc and actualCharges based on final classification ---
  switch (classification) {
    case 'MISSING_PERSON':
      caseTypeDesc = item.description || item.details || item.remarks || `Missing Person Alert`;
      actualCharges = null;
      break;
    case 'SEEKING_INFORMATION':
      caseTypeDesc = item.title || item.description || item.details || "Seeking Public Assistance";
      actualCharges = null;
      break;
    case 'VICTIM_IDENTIFICATION':
      caseTypeDesc = item.description || item.details || item.remarks || "Unidentified Person / Victim Case";
      actualCharges = null;
      break;
    case 'UNSPECIFIED':
      caseTypeDesc = item.title || item.description || item.details || "General Alert";
      actualCharges = null;
      break;
    case 'WANTED_CRIMINAL':
      // Default caseTypeDesc and actualCharges are already set for WANTED_CRIMINAL
      // Ensure caseTypeDesc is reasonable if default was just subjects
      if (caseTypeDesc === item.subjects?.join(' / ')) {
        caseTypeDesc = item.title || item.description || item.subjects?.join(' / ') || "Wanted Fugitive";
      }
      if (!actualCharges || actualCharges.length === 0) {
          actualCharges = item.description ? [item.description] : null; // Use description if charges are empty for wanted.
          caseTypeDesc = item.title || item.details || "Wanted for Questioning or Unspecified Offenses";
      }
      break;
  }


  return {
    id: `fbi-${item.uid}`,
    rawId: item.uid,
    source: 'fbi',
    name: item.title,
    images: uniqueImages.length > 0 ? uniqueImages : [primaryDisplayImage],
    thumbnailUrl: primaryDisplayImage,
    details: item.details,
    remarks: item.remarks,
    warningMessage: item.warning_message,
    rewardText: item.reward_text,
    sex: item.sex,
    race: item.race,
    nationality: item.nationality ? [item.nationality] : null,
    dateOfBirth: item.dates_of_birth_used?.[0] || null,
    age: item.age_range ? undefined : (item.age_max || item.age_min || undefined), // Use age_range for PersonDetailsCard
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
    originalData: item, // This now includes age_range
    detailsUrl: `/person/fbi/${item.uid}`,
    classification: classification,
    caseTypeDescription: caseTypeDesc,
  };
}

// Fetches all FBI Wanted Persons by paginating through the API.
export async function getAllFBIWantedData(itemsPerPage: number = 50): Promise<WantedPerson[]> {
  console.log('[getAllFBIWantedData] Starting full data fetch from FBI API...');
  let allNormalizedPersons: WantedPerson[] = [];
  let currentPage = 1;
  const MAX_API_CALLS = 60; // Safety net for ~3000 items if pageSize is 50. Adjust if needed.
  let apiReportedTotalItems = 0;
  let successfullyFetchedItems = 0;

  for (let i = 0; i < MAX_API_CALLS; i++) {
    if (i > 0) {
      await delay(1000); // 1 second delay between calls
    }

    const response = await fetchSingleFBIPage(currentPage, itemsPerPage);

    if (!response?.items) {
      if (i > 0 && successfullyFetchedItems > 0) {
         console.warn(`[getAllFBIWantedData] API call to page ${currentPage} returned no items or error. Stopping further fetches. Total fetched so far: ${successfullyFetchedItems}`);
      } else {
         console.error(`[getAllFBIWantedData] Critical error fetching page ${currentPage}. No items returned. Aborting.`);
      }
      break; 
    }
    
    if (i === 0 && response.total) {
        apiReportedTotalItems = response.total;
        console.log(`[getAllFBIWantedData] FBI API reports a total of ${apiReportedTotalItems} items.`);
    }

    const normalizedPageItems = response.items
      .map(item => normalizeFBIItem(item))
      .filter(p => p.name && p.name.trim() !== ""); // Ensure person has a name
    
    allNormalizedPersons = allNormalizedPersons.concat(normalizedPageItems);
    successfullyFetchedItems = allNormalizedPersons.length;

    // Check if we have fetched all items according to the API's total, or if last page was smaller than requested
    if (apiReportedTotalItems > 0 && successfullyFetchedItems >= apiReportedTotalItems) {
        console.log(`[getAllFBIWantedData] Fetched ${successfullyFetchedItems} items, which meets or exceeds API reported total of ${apiReportedTotalItems}.`);
        break;
    }
    if (response.items.length < itemsPerPage) {
        console.log(`[getAllFBIWantedData] API returned ${response.items.length} items (less than pageSize ${itemsPerPage}), assuming last page.`);
        break;
    }
    if (i === MAX_API_CALLS - 1) { // Safety break if loop runs too long
        console.warn(`[getAllFBIWantedData] Reached MAX_API_CALLS limit (${MAX_API_CALLS}). Fetched ${successfullyFetchedItems} items.`);
    }

    currentPage++;
  }
  
  // Deduplicate, just in case the API returns overlapping items on rare occasions
  const uniquePersons = Array.from(new Map(allNormalizedPersons.map(p => [p.id, p])).values());
  
  if (uniquePersons.length < successfullyFetchedItems) {
    console.warn(`[getAllFBIWantedData] Deduplicated ${successfullyFetchedItems - uniquePersons.length} items. Final count: ${uniquePersons.length}`);
  }
  console.log(`[getAllFBIWantedData] Finished fetching. Total unique persons: ${uniquePersons.length} after ${currentPage -1} API calls.`);
  
  return uniquePersons;
}


// Get details for a single FBI Wanted Person
export async function getFBIPersonDetails(id: string): Promise<WantedPerson | null> {
  // Attempt to find in a potentially cached full list first
  const allData = await getAllFBIWantedData(200); // Fetch a larger batch, assuming it might be cached
  const person = allData.find(p => p.rawId === id);

  if (person) return person;

  // If not found, it's unlikely to be found by a specific API call if getAllFBIWantedData is comprehensive.
  // The FBI API v1 does not offer a direct /v1/list/{uid} endpoint. Details are part of the list items.
  console.warn(`[getFBIPersonDetails] Person with FBI ID ${id} not found in the aggregated list. The API does not support direct lookup by ID for details beyond what's in the list items.`);
  return null; 
}

export function getPrimaryImageUrl(person: WantedPerson): string {
  if (person.images && person.images.length > 0 && person.images[0] && !person.images[0].includes('placehold.co')) {
    return person.images[0];
  }
  if (person.thumbnailUrl && !person.thumbnailUrl.includes('placehold.co') && !person.thumbnailUrl.includes('No+Image')) {
    return person.thumbnailUrl;
  }
  return `https://placehold.co/600x800.png?text=${encodeURIComponent(person.name || 'N/A')}`;
}
