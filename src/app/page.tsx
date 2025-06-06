
import { getFBIWantedListData } from '@/lib/api';
import type { WantedPerson, PersonClassification } from '@/lib/types';
import { WantedCard } from '@/components/WantedCard';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Search, ShieldQuestion, User, UserX, Info, HelpCircle } from "lucide-react";

export const revalidate = 3600; // Revalidate data every hour

const classificationTitles: Record<PersonClassification, string> = {
  WANTED_CRIMINAL: "Most Wanted Criminals",
  MISSING_PERSON: "Missing Persons",
  VICTIM_IDENTIFICATION: "Unidentified Persons (Victim Identification)",
  SEEKING_INFORMATION: "Seeking Information",
  UNSPECIFIED: "Other Cases"
};

const classificationIcons: Record<PersonClassification, React.ElementType> = {
  WANTED_CRIMINAL: ShieldQuestion,
  MISSING_PERSON: UserX,
  VICTIM_IDENTIFICATION: Search,
  SEEKING_INFORMATION: Info,
  UNSPECIFIED: HelpCircle
};

const classificationOrder: PersonClassification[] = [
  'WANTED_CRIMINAL',
  'MISSING_PERSON',
  'SEEKING_INFORMATION',
  'VICTIM_IDENTIFICATION',
  'UNSPECIFIED'
];

export default async function HomePage() {
  // Fetch a larger list for categorization, e.g., 100 items
  const allFBIPersons: WantedPerson[] = await getFBIWantedListData(1, 100);

  if (!allFBIPersons || allFBIPersons.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Search className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-semibold mb-2">No Data Found</h2>
        <p className="text-muted-foreground">
          Could not retrieve data from the FBI at this moment. Please try again later.
        </p>
      </div>
    );
  }

  const groupedPersons: Partial<Record<PersonClassification, WantedPerson[]>> = {};
  allFBIPersons.forEach(person => {
    if (!groupedPersons[person.classification]) {
      groupedPersons[person.classification] = [];
    }
    groupedPersons[person.classification]?.push(person);
  });

  return (
    <div className="space-y-12">
      <div className="text-center">
        <h1 className="text-4xl font-bold font-headline text-primary">Global Watch</h1>
        <p className="text-lg text-muted-foreground mt-2">FBI Wanted List & Public Information</p>
      </div>
      
      <Alert variant="default" className="border-primary/30 bg-primary/5">
        <ShieldQuestion className="h-5 w-5 text-primary mt-1" />
        <AlertTitle className="text-primary font-semibold">Information Source & Purpose</AlertTitle>
        <AlertDescription className="text-foreground/80">
          This platform compiles publicly available information from the FBI.
          It includes data on wanted individuals, missing persons, unidentified victims, and cases where public information is sought. 
          For official inquiries or to report information, please refer directly to the FBI website. 
          This site is for informational awareness only.
        </AlertDescription>
      </Alert>

      {classificationOrder.map(classification => {
        const personsInClassification = groupedPersons[classification];
        if (personsInClassification && personsInClassification.length > 0) {
          const IconComponent = classificationIcons[classification] || HelpCircle;
          return (
            <section key={classification} className="space-y-6">
              <div className="flex items-center gap-3 pb-2 border-b border-primary/20">
                <IconComponent className="h-7 w-7 text-accent" />
                <h2 className="text-2xl font-bold font-headline text-primary">
                  {classificationTitles[classification]}
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {personsInClassification.map((person) => (
                  person && person.id ? <WantedCard key={person.id} person={person} /> : null
                ))}
              </div>
            </section>
          );
        }
        return null;
      })}
    </div>
  );
}
