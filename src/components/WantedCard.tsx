
"use client";

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { WantedPerson } from '@/lib/types'; // Updated import
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building, UserMinus, Info, Search, ShieldAlert, HelpCircle, Globe2, CheckCircle2 } from 'lucide-react';
import { getDisplayImageUrl } from '@/lib/image-url';

export function WantedCard({ person }: { person: WantedPerson }) {
  const placeholderImage = `https://placehold.co/300x400.png?text=${encodeURIComponent(person.name || 'N/A')}`;
  const sourceImage = person.thumbnailUrl
    ? getDisplayImageUrl(person.thumbnailUrl, person.source)
    : placeholderImage;
  const [imageSrc, setImageSrc] = useState(sourceImage);
  const sourceCaseLabel = person.source === 'fbi'
    ? 'FBI Case'
    : person.source === 'eu-most-wanted'
      ? 'EU Most Wanted Case'
      : 'MJSP Captura Case';

  let cardDescription = person.caseTypeDescription || 'Details not available.';
  if (person.classification === 'WANTED_CRIMINAL' && person.charges && person.charges.length > 0) {
    cardDescription = person.charges.join(', ');
  }


  const getClassificationBadge = () => {
    switch(person.classification) {
      case 'MISSING_PERSON':
        return <Badge variant="secondary" className="absolute top-2 right-2 bg-yellow-500 text-black flex items-center gap-1 text-xs py-0.5 px-1.5"><UserMinus className="h-3 w-3"/>Missing</Badge>;
      case 'UNIDENTIFIED_PERSON':
        return <Badge variant="secondary" className="absolute top-2 right-2 bg-blue-400 text-black flex items-center gap-1 text-xs py-0.5 px-1.5"><Search className="h-3 w-3"/>Unidentified</Badge>;
      case 'SEEKING_INFORMATION':
        return <Badge variant="secondary" className="absolute top-2 right-2 bg-green-500 text-white flex items-center gap-1 text-xs py-0.5 px-1.5"><Info className="h-3 w-3"/>Seeking Info</Badge>;
      case 'VICTIM_OF_CRIME':
        return <Badge variant="secondary" className="absolute top-2 right-2 bg-orange-500 text-white flex items-center gap-1 text-xs py-0.5 px-1.5"><Info className="h-3 w-3"/>Victim of Crime</Badge>;
      case 'WANTED_CRIMINAL':
      default: // Also covers UNSPECIFIED if it somehow appears before specific badge logic
        return <Badge 
                  variant='destructive' // FBI is typically red/destructive
                  className="absolute top-2 right-2 text-xs py-0.5 px-1.5"
                >
                  {person.classification === 'UNSPECIFIED' ? 'General Alert' : 'Most Wanted'}
                </Badge>;
    }
  };
  
  return (
    <Link href={person.detailsUrl} legacyBehavior>
      <a className="group block h-full rounded-lg transition-shadow duration-200 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
        <Card className="h-full flex flex-col overflow-hidden transform hover:scale-105 transition-transform duration-200">
          <CardHeader className="p-0 relative">
            <div className="relative aspect-square w-full overflow-hidden">
              <Image
                src={imageSrc}
                alt={`Photo of ${person.name || 'person'}`}
                layout="fill"
                objectFit="cover"
                objectPosition="top"
                className="bg-muted"
                unoptimized
                data-ai-hint="person portrait"
                onError={() => setImageSrc(placeholderImage)}
              />
              <div className="pointer-events-none absolute inset-0 flex items-end bg-gradient-to-t from-black/85 via-black/20 to-transparent p-4 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
                <p className="line-clamp-4 text-sm font-medium leading-5 text-white">
                  {cardDescription}
                </p>
              </div>
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
                <span className="flex items-center"><ShieldAlert className="h-3 w-3 mr-1 text-primary/70"/> {sourceCaseLabel}</span>
              )}
              {!person.fieldOffices?.[0] && person.classification === 'MISSING_PERSON' && (
                <span className="flex items-center"><UserMinus className="h-3 w-3 mr-1 text-yellow-600"/> Missing Person</span>
              )}
              {!person.fieldOffices?.[0] && person.classification === 'SEEKING_INFORMATION' && (
                <span className="flex items-center"><Info className="h-3 w-3 mr-1 text-green-600"/> Seeking Information</span>
              )}
              {!person.fieldOffices?.[0] && person.classification === 'VICTIM_OF_CRIME' && (
                <span className="flex items-center"><Info className="h-3 w-3 mr-1 text-orange-600"/> Victim of Crime</span>
              )}
              {!person.fieldOffices?.[0] && person.classification === 'UNIDENTIFIED_PERSON' && (
                <span className="flex items-center"><Search className="h-3 w-3 mr-1 text-blue-600"/> Victim Identification</span>
              )}
              {!person.fieldOffices?.[0] && person.classification === 'CAPTURED' && (
                <span className="flex items-center"><CheckCircle2 className="h-3 w-3 mr-1 text-green-600"/> Resolved</span>
              )}
              {!person.fieldOffices?.[0] && person.classification !== 'WANTED_CRIMINAL' && person.classification !== 'MISSING_PERSON' && person.classification !== 'SEEKING_INFORMATION' && person.classification !== 'VICTIM_OF_CRIME' && person.classification !== 'UNIDENTIFIED_PERSON' && person.classification !== 'CAPTURED' && (
                <span className="flex items-center"><Globe2 className="h-3 w-3 mr-1 text-primary/70"/> {person.source.toUpperCase()} source</span>
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
