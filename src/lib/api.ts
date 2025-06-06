
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

  let classification: PersonClassification = 'UNSPECIFIED'; // Default to UNSPECIFIED
  let caseTypeDesc: string | null = item.title || item.subjects?.join(' / ') || item.description;
  let actualCharges: string[] | null = item.subjects || null;

  const posterClassLower = item.poster_classification?.toLowerCase();
  const personClassLower = item.person_classification?.toLowerCase();
  const subjectsLower = item.subjects?.map(s => s.toLowerCase()) || [];
  const titleLower = item.title?.toLowerCase() || "";
  const detailsLower = item.details?.toLowerCase() || "";
  const descriptionLower = item.description?.toLowerCase() || "";
  const remarksLower = item.remarks?.toLowerCase() || "";
  const combinedTextLower = `${descriptionLower} ${detailsLower} ${remarksLower}`;

  // --- Classification Logic ---

  // 1. Handle 'captured' status first - this overrides other classifications
  if (item.status?.toLowerCase() === 'captured') {
    classification = 'CAPTURED';
  } else {
    // 2. Check for specific crime categories based on subjects or title
    if (subjectsLower.includes("cyber's most wanted") || titleLower.includes("cyber's most wanted")) {
        classification = 'CYBER_MOST_WANTED';
    } else if (subjectsLower.includes('crimes against children') || titleLower.includes('crimes against children')) {
        classification = 'CRIMES_AGAINST_CHILDREN';
    } else {
        // 3. Standard classification based on poster_classification, person_classification
        if (posterClassLower === 'missing' || personClassLower === 'missing person') {
            classification = 'MISSING_PERSON';
        } else if (posterClassLower === 'information' || personClassLower === 'seeking information') {
            classification = 'SEEKING_INFORMATION';
        } else if (posterClassLower === 'victim' || personClassLower === 'victim') {
            // This is a general victim flag, might be refined later to UNIDENTIFIED or VICTIM_OF_CRIME
            classification = 'UNSPECIFIED'; // Start as unspecified, let text analysis decide
        } else {
            classification = 'WANTED_CRIMINAL'; // Default if no other strong indicators yet
        }

        // 4. Refine based on keywords in subjects
        if (classification === 'WANTED_CRIMINAL' || classification === 'UNSPECIFIED') {
            if (subjectsLower.some(s => s.includes('vicap missing persons') || s.includes('kidnappings and missing persons') || s.includes('missing person'))) {
                classification = 'MISSING_PERSON';
            } else if (subjectsLower.some(s => s.includes('seeking information'))) {
                classification = 'SEEKING_INFORMATION';
            } else if (subjectsLower.some(s => s.includes('vicap unidentified persons') || s.includes('unidentified human remains'))) {
                classification = 'UNIDENTIFIED_PERSON';
            } else if (subjectsLower.some(s => s.includes('vicap homicides and sexual assaults') || s.includes('homicide victim') || s.includes('sexual assault victim'))) {
                 // If title also implies unidentified, it's UNIDENTIFIED_PERSON, otherwise VICTIM_OF_CRIME
                if (titleLower.includes('unidentified') || titleLower.includes('jane doe') || titleLower.includes('john doe')) {
                    classification = 'UNIDENTIFIED_PERSON';
                } else {
                    classification = 'VICTIM_OF_CRIME';
                }
            }
        }

        // 5. Refine based on keywords in title (if not already specifically classified)
        if (classification === 'WANTED_CRIMINAL' || classification === 'UNSPECIFIED') {
            if (titleLower.includes('missing person') || (titleLower.includes('missing') && !titleLower.includes("information for missing"))) {
                classification = 'MISSING_PERSON';
            } else if (titleLower.includes('seeking information') || titleLower.includes('information sought')) {
                classification = 'SEEKING_INFORMATION';
            } else if (titleLower.includes('unidentified') || titleLower.includes('jane doe') || titleLower.includes('john doe') || titleLower.includes('unidentified human remains')) {
                classification = 'UNIDENTIFIED_PERSON';
            } else if (titleLower.includes('victim of homicide') || titleLower.includes('sexual assault victim')) {
                 classification = 'VICTIM_OF_CRIME';
            }
        }
      
        // 6. Deep text analysis for details, description, remarks (powerful override for victim/unidentified/missing)
        if (combinedTextLower.includes('body was found') ||
            combinedTextLower.includes('victim of homicide') ||
            combinedTextLower.includes('died as a result') ||
            combinedTextLower.includes('suffered blunt force wounds') ||
            combinedTextLower.includes('evidence of strangulation') ||
            (combinedTextLower.includes('cause of death') && !combinedTextLower.includes('seeking information on cause of death'))) {
            if (titleLower.includes('unidentified') || titleLower.includes('jane doe') || titleLower.includes('john doe') || combinedTextLower.includes('unidentified human remains')) {
                 classification = 'UNIDENTIFIED_PERSON';
            } else {
                 classification = 'VICTIM_OF_CRIME';
            }
        } else if (combinedTextLower.includes('unidentified person') || combinedTextLower.includes('unidentified human remains') || combinedTextLower.includes('jane doe') || combinedTextLower.includes('john doe')) {
            classification = 'UNIDENTIFIED_PERSON';
        } else if ((combinedTextLower.includes('was last seen') && (combinedTextLower.includes('disappearance') || combinedTextLower.includes('missing since'))) ||
                   (combinedTextLower.includes('missing person') && !titleLower.includes("information for missing"))) {
            classification = 'MISSING_PERSON';
        } else if (classification === 'WANTED_CRIMINAL' && (combinedTextLower.includes('seeking information') || combinedTextLower.includes('information sought') || combinedTextLower.includes('public assistance is requested') || combinedTextLower.includes('anyone with information'))) {
             classification = 'SEEKING_INFORMATION';
        }


        // 7. Final check for ViCAP cases that might still be ambiguously WANTED_CRIMINAL
        if (classification === 'WANTED_CRIMINAL' && (subjectsLower.includes('vicap') || titleLower.includes('vicap'))) {
            if (subjectsLower.some(s => s.includes('unidentified')) || titleLower.includes('unidentified') ||
                subjectsLower.some(s => s.includes('victim')) || titleLower.includes('victim')) {
                classification = 'UNIDENTIFIED_PERSON'; // Or VICTIM_OF_CRIME if identified
            } else if (subjectsLower.some(s => s.includes('seeking information')) || titleLower.includes('seeking information')) {
                classification = 'SEEKING_INFORMATION';
            }
        }
        
        // 8. If subjects are empty or only contain vague terms/dates and classified as WANTED_CRIMINAL, re-evaluate.
        if (classification === 'WANTED_CRIMINAL' && Array.isArray(item.subjects) && 
            (item.subjects.length === 0 || item.subjects.every(s => s.toLowerCase().includes("assistance") || s.match(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\b|\d{4}|,/) || /^[A-Za-z\s]+, [A-Za-z\s]+ \w+ \d{4}$/.test(s) ))) {
            if (titleLower.includes('missing')) {
                classification = 'MISSING_PERSON';
            } else if (titleLower.includes('seeking information')) {
                classification = 'SEEKING_INFORMATION';
            } else if (titleLower.includes('unidentified') || titleLower.includes('jane doe') || titleLower.includes('john doe')) {
                classification = 'UNIDENTIFIED_PERSON';
            } else if (titleLower.includes('victim')) {
                 classification = 'VICTIM_OF_CRIME';
            } else if (descriptionLower.includes('missing person') || detailsLower.includes('missing person')) {
                classification = 'MISSING_PERSON';
            } else if (descriptionLower.includes('victim of homicide') || detailsLower.includes('victim of homicide') || descriptionLower.includes('body was found') || detailsLower.includes('body was found')) {
                classification = 'VICTIM_OF_CRIME';
            } else if (item.subjects.length === 0 && !item.title && !item.description && !item.details) {
                classification = 'UNSPECIFIED';
            }
        }

        // If after all this, it's still UNSPECIFIED (e.g. started as victim, but text didn't confirm), and there are some subjects, assume WANTED_CRIMINAL
        if (classification === 'UNSPECIFIED' && item.subjects && item.subjects.length > 0) {
            classification = 'WANTED_CRIMINAL';
        }
    }
  }


  // --- Set caseTypeDesc and actualCharges based on final classification ---
  switch (classification) {
    case 'CAPTURED':
      caseTypeDesc = `Captured - ${item.title || 'Individual formerly sought'}`;
      actualCharges = null;
      break;
    case 'CYBER_MOST_WANTED':
      caseTypeDesc = item.title || "Cyber Crime Investigation";
      actualCharges = item.subjects?.filter(s => s.toLowerCase() !== "cyber's most wanted") || null;
      if (actualCharges && actualCharges.length === 0) actualCharges = ["Cyber Crimes"];
      break;
    case 'CRIMES_AGAINST_CHILDREN':
      caseTypeDesc = item.title || "Case involving crimes against children";
      actualCharges = item.subjects?.filter(s => s.toLowerCase() !== "crimes against children") || null;
       if (actualCharges && actualCharges.length === 0) actualCharges = ["Offenses against children"];
      break;
    case 'MISSING_PERSON':
      caseTypeDesc = item.title || item.description || item.details || item.remarks || `Missing Person Alert`;
      actualCharges = null;
      break;
    case 'SEEKING_INFORMATION':
      caseTypeDesc = item.title || item.description || item.details || "Seeking Public Assistance";
      actualCharges = null;
      break;
    case 'UNIDENTIFIED_PERSON':
      caseTypeDesc = item.title || item.description || item.details || item.remarks || "Unidentified Person Case";
      actualCharges = null;
      break;
    case 'VICTIM_OF_CRIME':
      caseTypeDesc = item.title || item.description || item.details || item.remarks || "Victim of Crime Case";
      actualCharges = null;
      break;
    case 'UNSPECIFIED':
      caseTypeDesc = item.title || item.description || item.details || "General Alert";
      actualCharges = null;
      break;
    case 'WANTED_CRIMINAL':
    default: // Default to WANTED_CRIMINAL if no other classification fits
      classification = 'WANTED_CRIMINAL'; // Ensure it's explicitly set
      actualCharges = item.subjects && item.subjects.length > 0 ? item.subjects : null;
      caseTypeDesc = item.title || item.description || (actualCharges ? actualCharges.join(' / ') : "Wanted Fugitive");
      
      if (actualCharges && actualCharges.some(s => s.match(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\b|\d{4}|,/) || /^[A-Za-z\s]+, [A-Za-z\s]+ \w+ \d{4}$/.test(s) )) {
        if(!actualCharges.some(s => s.toLowerCase().includes("murder") || s.toLowerCase().includes("fugitive") || s.toLowerCase().includes("warrant") || s.toLowerCase().includes("unlawful flight"))) {
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
    status: item.status,
  };
}

// Fetches all FBI Wanted Persons by paginating through the API.
export async function getAllFBIWantedData(itemsPerPage: number = 50): Promise<WantedPerson[]> {
  console.log('[getAllFBIWantedData] Starting full data fetch from FBI API...');
  let allNormalizedPersons: WantedPerson[] = [];
  let currentPage = 1;
  const MAX_API_CALLS = 60; // Increased safety limit
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

    // Stop if we've fetched all reported items OR if the API returns fewer items than requested (indicating last page)
    if ((apiReportedTotalItems > 0 && successfullyFetchedItems >= apiReportedTotalItems) || response.items.length < itemsPerPage) {
        console.log(`[getAllFBIWantedData] Fetched ${successfullyFetchedItems} items. Stopping condition met.`);
        if (response.items.length < itemsPerPage) {
             console.log(`[getAllFBIWantedData] API returned ${response.items.length} items (less than pageSize ${itemsPerPage}), assuming last page.`);
        }
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
  // This function might be slow if the ID is not in the first batch,
  // as it fetches all data. Consider a more targeted API if available for single lookups.
  // For now, it relies on the full dataset being available.
  const allData = await getAllFBIWantedData(200); // Fetch a larger batch initially for details page.
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

