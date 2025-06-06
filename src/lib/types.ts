
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
  age_range: string | string[] | null; // Can be a single descriptive string or an array of numbers/strings
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

// Classification Enum
export type PersonClassification =
  | 'WANTED_CRIMINAL'
  | 'CYBER_MOST_WANTED'
  | 'CRIMES_AGAINST_CHILDREN'
  | 'MISSING_PERSON'
  | 'UNIDENTIFIED_PERSON'
  | 'VICTIM_OF_CRIME'
  | 'SEEKING_INFORMATION'
  | 'CAPTURED'
  | 'UNSPECIFIED';

// Simplified Data Structure for FBI Only
export interface WantedPerson {
  id: string; // Will be fbi-uid
  rawId: string; // uid
  source: 'fbi'; // Always 'fbi'
  name: string | null;
  images: string[];
  thumbnailUrl?: string;
  details?: string | null;
  remarks?: string | null;
  warningMessage?: string | null;
  rewardText?: string | null;
  sex?: string | null;
  race?: string | null;
  nationality?: string[] | null; // FBI nationality is a single string, normalized to array
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
  originalData: FBIWantedItem;
  detailsUrl: string;
  classification: PersonClassification;
  caseTypeDescription?: string | null;
  status?: string; // To store the original status, e.g., 'captured'
}

