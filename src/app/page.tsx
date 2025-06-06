import { getCombinedWantedList } from '@/lib/api';
import type { CombinedWantedPerson } from '@/lib/types';
import { WantedCard } from '@/components/WantedCard';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Search } from "lucide-react";

export const revalidate = 3600; // Revalidate data every hour

export default async function HomePage() {
  // For demo, fetch a small number. Increase pageSize for more items.
  const wantedList: CombinedWantedPerson[] = await getCombinedWantedList(1, 20);

  if (!wantedList || wantedList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Search className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-semibold mb-2">No Wanted Persons Found</h2>
        <p className="text-muted-foreground">
          Could not retrieve data from FBI or Interpol at this moment. Please try again later.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-center font-headline text-primary">Global Most Wanted</h1>
      
      <Alert>
        <Search className="h-4 w-4" />
        <AlertTitle>Information Source</AlertTitle>
        <AlertDescription>
          This list compiles publicly available information from the FBI and Interpol. For official inquiries, please refer to the respective agency websites.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {wantedList.map((person) => (
          <WantedCard key={person.id} person={person} />
        ))}
      </div>
    </div>
  );
}
