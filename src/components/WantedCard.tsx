
"use client";

import Link from 'next/link';
import Image from 'next/image';
import type { WantedPerson } from '@/lib/types'; // Updated import
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building, UserMinus, Info, Search, ShieldAlert, HelpCircle } from 'lucide-react';

export function WantedCard({ person }: { person: WantedPerson }) {
  const placeholderImage = `https://placehold.co/300x400.png?text=${encodeURIComponent(person.name || 'N/A')}`;

  let cardDescription = person.caseTypeDescription || 'Details not available.';
  if (person.classification === 'WANTED_CRIMINAL' && person.charges && person.charges.length > 0) {
    cardDescription = person.charges.join(', ');
  }


  const getClassificationBadge = () => {
    switch(person.classification) {
      case 'MISSING_PERSON':
        return <Badge variant="secondary" className="absolute top-2 right-2 bg-yellow-500 text-black flex items-center gap-1 text-xs py-0.5 px-1.5"><UserMinus className="h-3 w-3"/>Missing</Badge>;
      case 'VICTIM_IDENTIFICATION':
        return <Badge variant="secondary" className="absolute top-2 right-2 bg-blue-400 text-black flex items-center gap-1 text-xs py-0.5 px-1.5"><Search className="h-3 w-3"/>Unidentified</Badge>;
      case 'SEEKING_INFORMATION':
        return <Badge variant="secondary" className="absolute top-2 right-2 bg-green-500 text-white flex items-center gap-1 text-xs py-0.5 px-1.5"><Info className="h-3 w-3"/>Seeking Info</Badge>;
      case 'WANTED_CRIMINAL':
      default: // Also covers UNSPECIFIED if it somehow appears before specific badge logic
        return <Badge 
                  variant='destructive' // FBI is typically red/destructive
                  className="absolute top-2 right-2 text-xs py-0.5 px-1.5"
                >
                  FBI MOST WANTED
                </Badge>;
    }
  };
  
  return (
    <Link href={person.detailsUrl} legacyBehavior>
      <a className="block hover:shadow-lg transition-shadow duration-200 rounded-lg h-full">
        <Card className="h-full flex flex-col overflow-hidden transform hover:scale-105 transition-transform duration-200">
          <CardHeader className="p-0 relative">
            <div className="aspect-[3/4] w-full relative">
              <Image
                src={person.thumbnailUrl || placeholderImage}
                alt={`Photo of ${person.name || 'person'}`}
                layout="fill"
                objectFit="cover"
                className="bg-muted"
                data-ai-hint="person portrait"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = placeholderImage;
                }}
              />
            </div>
            {getClassificationBadge()}
          </CardHeader>
          <CardContent className="p-4 flex-grow flex flex-col justify-between">
            <div>
              <CardTitle className="text-lg font-headline mb-1 truncate" title={person.name || 'N/A'}>
                {person.name || 'N/A'}
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground mb-2 line-clamp-3" title={cardDescription}>
                {cardDescription}
              </CardDescription>
            </div>
            <div className="mt-2 flex items-center text-xs text-muted-foreground">
              {person.fieldOffices?.[0] && (
                 <span className="flex items-center truncate" title={person.fieldOffices[0]}>
                    <Building className="h-3 w-3 mr-1 flex-shrink-0" />
                    {person.fieldOffices[0]}
                 </span>
              )}
              {/* Display a generic icon if no field office and it's not a specific other classification */}
              {!person.fieldOffices?.[0] && person.classification === 'WANTED_CRIMINAL' && (
                <span className="flex items-center"><ShieldAlert className="h-3 w-3 mr-1 text-primary/70"/> FBI Case</span>
              )}
              {!person.fieldOffices?.[0] && person.classification === 'MISSING_PERSON' && (
                <span className="flex items-center"><UserMinus className="h-3 w-3 mr-1 text-yellow-600"/> Missing Person</span>
              )}
              {!person.fieldOffices?.[0] && person.classification === 'SEEKING_INFORMATION' && (
                <span className="flex items-center"><Info className="h-3 w-3 mr-1 text-green-600"/> Seeking Information</span>
              )}
              {!person.fieldOffices?.[0] && person.classification === 'VICTIM_IDENTIFICATION' && (
                <span className="flex items-center"><Search className="h-3 w-3 mr-1 text-blue-600"/> Victim Identification</span>
              )}
               {!person.fieldOffices?.[0] && person.classification === 'UNSPECIFIED' && (
                <span className="flex items-center"><HelpCircle className="h-3 w-3 mr-1"/> General Alert</span>
              )}
            </div>
          </CardContent>
        </Card>
      </a>
    </Link>
  );
}
