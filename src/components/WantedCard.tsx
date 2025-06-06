"use client";

import Link from 'next/link';
import Image from 'next/image';
import type { CombinedWantedPerson } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Globe, Building } from 'lucide-react'; // FBI uses "Building" for field offices, Interpol uses "Globe" for nationality

export function WantedCard({ person }: { person: CombinedWantedPerson }) {
  const placeholderImage = `https://placehold.co/300x400.png?text=${encodeURIComponent(person.name || 'N/A')}`;
  
  return (
    <Link href={person.detailsUrl} legacyBehavior>
      <a className="block hover:shadow-lg transition-shadow duration-200 rounded-lg">
        <Card className="h-full flex flex-col overflow-hidden transform hover:scale-105 transition-transform duration-200">
          <CardHeader className="p-0 relative">
            <div className="aspect-[3/4] w-full relative">
              <Image
                src={person.thumbnailUrl || placeholderImage}
                alt={`Photo of ${person.name || 'wanted person'}`}
                layout="fill"
                objectFit="cover"
                className="bg-muted"
                data-ai-hint="person portrait"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = placeholderImage;
                }}
              />
            </div>
             <Badge 
              variant={person.source === 'fbi' ? 'destructive' : 'default'} 
              className="absolute top-2 right-2"
            >
              {person.source.toUpperCase()}
            </Badge>
          </CardHeader>
          <CardContent className="p-4 flex-grow flex flex-col justify-between">
            <div>
              <CardTitle className="text-lg font-headline mb-1 truncate" title={person.name || 'N/A'}>
                {person.name || 'N/A'}
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground mb-2 line-clamp-2">
                {person.charges?.join(', ') || person.details || 'Details not available.'}
              </CardDescription>
            </div>
            <div className="mt-2 flex items-center text-xs text-muted-foreground">
              {person.source === 'fbi' && person.fieldOffices?.[0] && (
                <>
                  <Building className="h-3 w-3 mr-1" />
                  <span>{person.fieldOffices[0]}</span>
                </>
              )}
              {person.source === 'interpol' && person.nationality?.[0] && (
                <>
                  <Globe className="h-3 w-3 mr-1" />
                  <span>{person.nationality[0]}</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </a>
    </Link>
  );
}
