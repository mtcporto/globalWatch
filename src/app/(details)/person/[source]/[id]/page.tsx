
import { getFBIPersonDetails } from '@/lib/api'; 
import type { WantedPerson } from '@/lib/types'; 
import { PersonDetailsCard } from '@/components/PersonDetailsCard';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { UserX } from "lucide-react";
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const revalidate = 86400; // Revalidate data for this page once a day (24 * 60 * 60 seconds)

interface PersonDetailsPageProps {
  params: {
    source: 'fbi'; 
    id: string;
  };
}

export async function generateMetadata({ params }: PersonDetailsPageProps) {
  const person = await getFBIPersonDetails(params.id); 
  if (!person) {
    return { title: 'Person Not Found | Global Watch' };
  }
  return {
    title: `${person.name || 'Wanted Person'} | Global Watch`,
    description: `Details for ${person.name || 'wanted person'} from the FBI.`,
  };
}

export default async function PersonDetailsPage({ params }: PersonDetailsPageProps) {
  const person = await getFBIPersonDetails(params.id);

  if (!person) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
        <UserX className="w-24 h-24 text-destructive mb-6" />
        <Alert variant="destructive" className="max-w-md">
          <AlertTitle className="font-headline text-2xl">Person Not Found</AlertTitle>
          <AlertDescription className="text-base">
            The requested person (FBI ID: {params.id}) could not be found.
            They may have been captured, the information removed, or the ID may be incorrect.
          </AlertDescription>
        </Alert>
        <Button asChild className="mt-8">
          <Link href="/">Return to Wanted List</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <PersonDetailsCard person={person} />
       <div className="mt-8 text-center">
        <Button asChild variant="outline">
          <Link href="/">Back to Full List</Link>
        </Button>
      </div>
    </div>
  );
}
