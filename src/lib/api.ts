
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
  if (classification === 'WANTED_CRIMINAL' && item.subjects && item.subjects.length > 0) {
    if (subjectsLower.some(s => s.includes('vicap missing persons') || s.includes('kidnappings and missing persons') || s.includes('missing person'))) {
      classification = 'MISSING_PERSON';
    } else if (subjectsLower.some(s => s.includes('seeking information'))) {
      classification = 'SEEKING_INFORMATION';
    } else if (subjectsLower.some(s => s.includes('vicap unidentified persons') || s.includes('vicap homicides and sexual assaults') || s.includes('unidentified human remains') || s.includes('homicide victim') || s.includes('sexual assault victim'))) {
      classification = 'VICTIM_IDENTIFICATION';
    }
  }

  // 3. If still 'WANTED_CRIMINAL', check title for hints (less reliable)
  if (classification === 'WANTED_CRIMINAL' && titleLower) {
    if (titleLower.includes('missing person') || (titleLower.includes('missing') && !titleLower.includes("information for missing"))) {
        classification = 'MISSING_PERSON';
    } else if (titleLower.includes('seeking information') || titleLower.includes('information sought')) {
        classification = 'SEEKING_INFORMATION';
    } else if (titleLower.includes('unidentified') || titleLower.includes('jane doe') || titleLower.includes('john doe') || titleLower.includes('victim identification') || titleLower.includes('homicide victim') || titleLower.includes('sexual assault victim') || titleLower.includes('victim of homicide')) {
        classification = 'VICTIM_IDENTIFICATION';
    }
  }
  
  // 4. If still 'WANTED_CRIMINAL', check description and details (more robust check)
  if (classification === 'WANTED_CRIMINAL') {
    const combinedTextLower = `${descriptionLower} ${detailsLower} ${item.remarks?.toLowerCase() || ''}`;
    // More specific victim indicators
    if (combinedTextLower.includes('body was found') || 
        combinedTextLower.includes('victim of homicide') || 
        combinedTextLower.includes('died as a result') ||
        combinedTextLower.includes('suffered blunt force wounds') || 
        combinedTextLower.includes('evidence of strangulation') || 
        combinedTextLower.includes('skeletal remains identified as') ||
        combinedTextLower.includes('manner of death is unknown') ||
        (combinedTextLower.includes('cause of death') && !combinedTextLower.includes('seeking information on cause of death'))) {
        classification = 'VICTIM_IDENTIFICATION';
    } else if (combinedTextLower.includes('was last seen') && (combinedTextLower.includes('disappearance') || combinedTextLower.includes('missing since') || combinedTextLower.includes('intended to visit') && combinedTextLower.includes('left without her phone'))) { // "was last seen" alone is weak for missing, add context
        classification = 'MISSING_PERSON';
    } else if (combinedTextLower.includes('missing person') && !titleLower.includes("information for missing")) { // Avoid "seeking information for missing person"
        classification = 'MISSING_PERSON';
    } else if (combinedTextLower.includes('seeking information') || combinedTextLower.includes('information sought') || combinedTextLower.includes('public assistance is requested') || combinedTextLower.includes('anyone with information')) {
        classification = 'SEEKING_INFORMATION';
    } else if (combinedTextLower.includes('unidentified person') || combinedTextLower.includes('unidentified human remains') || combinedTextLower.includes('jane doe') || combinedTextLower.includes('john doe')) {
        classification = 'VICTIM_IDENTIFICATION';
    }
  }

  // 5. Final check and refinement, especially for ViCAP cases that might still be WANTED_CRIMINAL
  if (classification === 'WANTED_CRIMINAL' && (subjectsLower.includes('vicap') || titleLower.includes('vicap'))) {
      if (subjectsLower.some(s => s.includes('unidentified') || s.includes('homicides and sexual assaults') || s.includes('victim')) ||
          titleLower.includes('unidentified') || titleLower.includes('victim')) {
          classification = 'VICTIM_IDENTIFICATION';
      } else if (subjectsLower.some(s => s.includes('seeking information')) || titleLower.includes('seeking information')) {
          classification = 'SEEKING_INFORMATION';
      }
  }
  
  // 6. If subjects are empty or only contain vague terms like "assistance" and still classified as WANTED_CRIMINAL, re-evaluate based on title/description.
  if (classification === 'WANTED_CRIMINAL' && Array.isArray(item.subjects) && (item.subjects.length === 0 || item.subjects.every(s => s.toLowerCase().includes("assistance") || s.match(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\b|\d{4}|,/)))) { // Also check if subjects are just dates/locations
    if (titleLower.includes('missing')) {
      classification = 'MISSING_PERSON';
    } else if (titleLower.includes('seeking information')) {
      classification = 'SEEKING_INFORMATION';
    } else if (titleLower.includes('unidentified') || titleLower.includes('jane doe') || titleLower.includes('john doe') || titleLower.includes('victim')) {
      classification = 'VICTIM_IDENTIFICATION';
    } else if (descriptionLower.includes('missing person') || detailsLower.includes('missing person')) {
      classification = 'MISSING_PERSON';
    } else if (descriptionLower.includes('victim of homicide') || detailsLower.includes('victim of homicide') || descriptionLower.includes('body was found') || detailsLower.includes('body was found')) {
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
      // If it's truly a WANTED_CRIMINAL, subjects should be charges.
      // If subjects were descriptive, they should have been caught by step 6 or earlier logic,
      // leading to a different classification or this block setting actualCharges to null.
      actualCharges = item.subjects && item.subjects.length > 0 ? item.subjects : null;
      caseTypeDesc = item.title || item.description || (actualCharges ? actualCharges.join(' / ') : "Wanted Fugitive");
      
      // If, after all, subjects are still something like a location/date for a WANTED_CRIMINAL, nullify charges.
      if (actualCharges && actualCharges.some(s => s.match(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\b|\d{4}|,/))) {
        if(!actualCharges.some(s => s.toLowerCase().includes("murder") || s.toLowerCase().includes("fugitive") || s.toLowerCase().includes("warrant"))) { // Don't nullify if it also has crime keywords
            actualCharges = null;
            caseTypeDesc = item.title || item.description || "Wanted Fugitive / Case Details Unclear";
        }
      }
      
      if (!actualCharges || actualCharges.length === 0) {
          actualCharges = null; 
          caseTypeDesc = item.title || item.description || "Wanted for Questioning or Unspecified Offenses";
      }
      if (!caseTypeDesc) caseTypeDesc = "Wanted Fugitive";
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

// Fetches all FBI Wanted Persons by paginating through the API.
export async function getAllFBIWantedData(itemsPerPage: number = 50): Promise<WantedPerson[]> {
  console.log('[getAllFBIWantedData] Starting full data fetch from FBI API...');
  let allNormalizedPersons: WantedPerson[] = [];
  let currentPage = 1;
  const MAX_API_CALLS = 60; 
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
      .filter(p => p.name && p.name.trim() !== ""); 
    
    allNormalizedPersons = allNormalizedPersons.concat(normalizedPageItems);
    successfullyFetchedItems = allNormalizedPersons.length;

    if (apiReportedTotalItems > 0 && successfullyFetchedItems >= apiReportedTotalItems) {
        console.log(`[getAllFBIWantedData] Fetched ${successfullyFetchedItems} items, which meets or exceeds API reported total of ${apiReportedTotalItems}.`);
        break;
    }
    if (response.items.length < itemsPerPage) {
        console.log(`[getAllFBIWantedData] API returned ${response.items.length} items (less than pageSize ${itemsPerPage}), assuming last page.`);
        break;
    }
    if (i === MAX_API_CALLS - 1) { 
        console.warn(`[getAllFBIWantedData] Reached MAX_API_CALLS limit (${MAX_API_CALLS}). Fetched ${successfullyFetchedItems} items.`);
    }

    currentPage++;
  }
  
  const uniquePersons = Array.from(new Map(allNormalizedPersons.map(p => [p.id, p])).values());
  
  if (uniquePersons.length < successfullyFetchedItems) {
    console.warn(`[getAllFBIWantedData] Deduplicated ${successfullyFetchedItems - uniquePersons.length} items. Final count: ${uniquePersons.length}`);
  }
  console.log(`[getAllFBIWantedData] Finished fetching. Total unique persons: ${uniquePersons.length} after ${currentPage -1} API calls.`);
  
  return uniquePersons;
}


// Get details for a single FBI Wanted Person
export async function getFBIPersonDetails(id: string): Promise<WantedPerson | null> {
  const allData = await getAllFBIWantedData(200); 
  const person = allData.find(p => p.rawId === id);

  if (person) return person;

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

