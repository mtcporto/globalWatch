
import { getCombinedWantedList } from '@/lib/api';
import type { CombinedWantedPerson } from '@/lib/types';
import { WantedCard } from '@/components/WantedCard';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Search, ShieldQuestion } from "lucide-react";

export const revalidate = 3600; // Revalidate data every hour

export default async function HomePage() {
  const wantedList: CombinedWantedPerson[] = await getCombinedWantedList(1, 20); 

  if (!wantedList || wantedList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Search className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-semibold mb-2">No Data Found</h2>
        <p className="text-muted-foreground">
          Could not retrieve data from FBI or Interpol at this moment. Please try again later.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-center font-headline text-primary">Global Watch List</h1>
      
      <Alert variant="default" className="border-primary/30 bg-primary/5">
        <ShieldQuestion className="h-5 w-5 text-primary mt-1" />
        <AlertTitle className="text-primary font-semibold">Information Source & Purpose</AlertTitle>
        <AlertDescription className="text-foreground/80">
          This platform compiles publicly available information from the FBI and Interpol.
          It includes data on wanted individuals, missing persons, unidentified victims, and cases where public information is sought. 
          For official inquiries or to report information, please refer directly to the respective agency websites. 
          This site is for informational awareness only.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {wantedList.map((person) => (
          person && person.id ? <WantedCard key={person.id} person={person} /> : null
        ))}
      </div>
    </div>
  );
}
