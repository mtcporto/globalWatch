
"use client";

import Link from 'next/link';
import Image from 'next/image';
import type { CombinedWantedPerson } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Globe, Building, UserMinus, Info, SearchHelp, ShieldAlert } from 'lucide-react';

export function WantedCard({ person }: { person: CombinedWantedPerson }) {
  const placeholderImage = `https://placehold.co/300x400.png?text=${encodeURIComponent(person.name || 'N/A')}`;

  let cardDescription = person.caseTypeDescription || 'Details not available.';
  // For wanted criminals, prioritize actual charges if available
  if (person.classification === 'WANTED_CRIMINAL' && person.charges && person.charges.length > 0) {
    cardDescription = person.charges.join(', ');
  }


  const getSourceBadge = () => {
    switch(person.classification) {
      case 'MISSING_PERSON':
        return <Badge variant="secondary" className="absolute top-2 right-2 bg-yellow-500 text-black flex items-center gap-1"><UserMinus className="h-3 w-3"/>Missing</Badge>;
      case 'VICTIM_IDENTIFICATION':
        return <Badge variant="secondary" className="absolute top-2 right-2 bg-blue-400 text-black flex items-center gap-1"><SearchHelp className="h-3 w-3"/>Unidentified</Badge>;
      case 'SEEKING_INFORMATION':
        return <Badge variant="secondary" className="absolute top-2 right-2 bg-green-500 text-white flex items-center gap-1"><Info className="h-3 w-3"/>Seeking Info</Badge>;
      case 'WANTED_CRIMINAL':
      default:
        return <Badge 
                  variant={person.source === 'fbi' ? 'destructive' : 'default'} 
                  className="absolute top-2 right-2"
                >
                  {person.source.toUpperCase()}
                </Badge>;
    }
  };
  
  return (
    <Link href={person.detailsUrl} legacyBehavior>
      <a className="block hover:shadow-lg transition-shadow duration-200 rounded-lg">
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
            {getSourceBadge()}
          </CardHeader>
          <CardContent className="p-4 flex-grow flex flex-col justify-between">
            <div>
              <CardTitle className="text-lg font-headline mb-1 truncate" title={person.name || 'N/A'}>
                {person.name || 'N/A'}
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground mb-2 line-clamp-3">
                {cardDescription}
              </CardDescription>
            </div>
            <div className="mt-2 flex items-center text-xs text-muted-foreground">
              {person.source === 'fbi' && person.fieldOffices?.[0] && person.classification === 'WANTED_CRIMINAL' && (
                <>
                  <Building className="h-3 w-3 mr-1" />
                  <span>{person.fieldOffices[0]}</span>
                </>
              )}
              {person.source === 'interpol' && person.nationality?.[0] && person.classification === 'WANTED_CRIMINAL' && (
                <>
                  <Globe className="h-3 w-3 mr-1" />
                  <span>{person.nationality[0]}</span>
                </>
              )}
               {person.classification === 'MISSING_PERSON' && (
                <>
                  <UserMinus className="h-3 w-3 mr-1 text-yellow-600" />
                  <span>Missing Person</span>
                </>
              )}
              {person.classification === 'SEEKING_INFORMATION' && (
                <>
                  <Info className="h-3 w-3 mr-1 text-green-600" />
                  <span>Seeking Information</span>
                </>
              )}
              {person.classification === 'VICTIM_IDENTIFICATION' && (
                <>
                  <SearchHelp className="h-3 w-3 mr-1 text-blue-600" />
                  <span>Victim Identification</span>
                </>
              )}
               {person.classification !== 'WANTED_CRIMINAL' && person.source === 'fbi' && person.fieldOffices?.[0] && (
                 <span className="flex items-center"><ShieldAlert className="h-3 w-3 mr-1 text-primary/70"/> {person.fieldOffices[0]}</span>
               )}
            </div>
          </CardContent>
        </Card>
      </a>
    </Link>
  );
}
