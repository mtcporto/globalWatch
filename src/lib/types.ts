
// FBI API Types
export interface FBIImage {
  original: string;
  thumb: string;
  large: string;
  caption: string | null;
}

export interface FBIFiles {
  url: string;
  name: string;
}

export interface FBIWantedItem {
  '@id': string;
  uid: string;
  title: string;
  description: string | null;
  images: FBIImage[];
  files: FBIFiles[];
  warning_message: string | null;
  remarks: string | null;
  details: string | null;
  additional_information: string | null;
  caution: string | null;
  reward_text: string | null;
  reward_min: number;
  reward_max: number;
  dates_of_publication: { start_date: string | null; end_date: string | null }[];
  publication: string; // Example: "2023-10-26T10:00:00"
  url: string;
  field_offices: string[] | null;
  locations: string[] | null;
  person_classification: string; // e.g. "Main", "Victim"
  poster_classification?: string; // Added as optional, e.g. "default", "missing", "information"
  ncic: string | null;
  age_min: number | null;
  age_max: number | null;
  age_range: string[] | null; // Changed to string array based on observed data.
  weight: string | null;
  height_min: number | null; // inches
  height_max: number | null; // inches
  eyes: string | null;
  hair: string | null;
  sex: string | null;
  race: string | null;
  nationality: string | null;
  scars_and_marks: string | null;
  build: string | null;
  complexion: string | null;
  place_of_birth: string | null;
  possible_countries: string[] | null;
  possible_states: string[] | null;
  aliases: string[] | null;
  status: string; // e.g. "na", "captured"
  subjects: string[]; // e.g. ["Crimes Against Children"]
  path: string;
  modified: string; // Example: "2023-10-26T10:00:00"
  languages: string[] | null;
  additional_details?: any; // Catch-all for other fields
}

export interface FBIWantedResponse {
  total: number;
  page: number;
  items: FBIWantedItem[];
}

// Interpol API Types
export interface InterpolLinks {
  self?: { href: string };
  images?: { href: string };
  thumbnail?: { href: string };
  // Removed picture as it's not standard for all _links, self is more common for direct resource link
  notice?: { href: string }; // Added for /images endpoint response
}

export interface InterpolNotice {
  forename?: string;
  date_of_birth?: string;
  entity_id: string; // e.g., "2023/12345"
  nationalities?: string[] | null;
  name?: string;
  _links: InterpolLinks;
  // Interpol detail specific fields
  sex_id?: string; // M, F, U
  country_of_birth_id?: string; // ISO country code
  place_of_birth?: string;
  height?: number; // meters
  weight?: number; // kg
  eyes_colors_id?: string[];
  hairs_id?: string[];
  distinguishing_marks?: string;
  arrest_warrants?: { charge: string; issuing_country_id: string }[];
  _embedded?: {
    images?: InterpolImageDetail[]; // This is for the /notices/v1/red/{id} endpoint if it embeds images
  };
}

export interface InterpolNoticesResponse {
  total: number;
  query: {
    page: number;
    resultPerPage: number;
  };
  _embedded: {
    notices: InterpolNotice[];
  };
  _links: InterpolLinks;
}

// Represents an image object from the /images endpoint's _embedded.images array
export interface InterpolImageDetail {
  _links: {
    self: { href: string }; // This is the direct link to the full-resolution image
  };
  picture_id: string;
}

// Represents the overall response from the /images endpoint
export interface InterpolImagesResponse {
  _embedded: {
    images: InterpolImageDetail[];
  };
  total: number;
  _links: InterpolLinks; // May contain self, notice, and potentially a root thumbnail
}

// Classification Enum
export type PersonClassification =
  | 'WANTED_CRIMINAL'
  | 'MISSING_PERSON'
  | 'VICTIM_IDENTIFICATION'
  | 'SEEKING_INFORMATION'
  | 'UNSPECIFIED';

// Combined Data Structure
export interface CombinedWantedPerson {
  id: string;
  source: 'fbi' | 'interpol';
  name: string | null;
  firstName?: string | null;
  lastName?: string | null;
  images: string[];
  thumbnailUrl?: string;
  details?: string | null;
  remarks?: string | null;
  warningMessage?: string | null;
  rewardText?: string | null;
  sex?: string | null;
  race?: string | null;
  nationality?: string[] | null;
  dateOfBirth?: string | null;
  age?: number | null;
  placeOfBirth?: string | null;
  height?: string | null;
  weight?: string | null;
  eyeColor?: string | null;
  hairColor?: string | null;
  distinguishingMarks?: string | null;
  charges?: string[] | null;
  fieldOffices?: string[] | null;
  possibleCountries?: string[] | null;
  aliases?: string[] | null;
  originalData: FBIWantedItem | InterpolNotice;
  detailsUrl: string;
  rawId: string;
  classification: PersonClassification;
  caseTypeDescription?: string | null;
}
