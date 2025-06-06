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
  ncic: string | null;
  age_min: number | null;
  age_max: number | null;
  age_range: string | null; // Not in example but might exist
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
    images?: InterpolImageDetail[];
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

export interface InterpolImageDetail {
  _links: {
    self: { href: string };
    picture: { href: string }; // This seems to be the actual image URL
  };
  _embedded?: any;
  picture_id: string; // numeric string
}

export interface InterpolImagesResponse {
  _embedded: {
    images: InterpolImageDetail[];
  };
  total: number;
}

// Combined Data Structure
export interface CombinedWantedPerson {
  id: string; // unique ID, e.g., "fbi-UID" or "interpol-ENTITY_ID"
  source: 'fbi' | 'interpol';
  name: string | null;
  firstName?: string | null;
  lastName?: string | null;
  images: string[]; // URLs of full-size images
  thumbnailUrl?: string;
  details?: string | null; // FBI: details, Interpol: constructed from arrest_warrants
  remarks?: string | null; // FBI specific
  warningMessage?: string | null; // FBI specific, Interpol: maybe from UN notices if applicable
  rewardText?: string | null; // FBI specific
  sex?: string | null;
  race?: string | null; // FBI specific
  nationality?: string[] | null;
  dateOfBirth?: string | null;
  age?: number | null; // Calculated or from API
  placeOfBirth?: string | null;
  height?: string | null; // e.g., "1.75m" or "5'9\""
  weight?: string | null; // e.g., "70kg" or "154lbs"
  eyeColor?: string | null;
  hairColor?: string | null;
  distinguishingMarks?: string | null; // Scars, marks, etc.
  charges?: string[] | null; // FBI: subjects, Interpol: arrest_warrants.charge
  fieldOffices?: string[] | null; // FBI specific
  possibleCountries?: string[] | null; // FBI specific
  aliases?: string[] | null; // FBI specific
  originalData: FBIWantedItem | InterpolNotice;
  detailsUrl: string; // Path to the detail page, e.g. /person/fbi/some-uid
  rawId: string; // Original ID from the source API (FBI uid or Interpol entity_id without modification)
}
