
"use client";

import Image from 'next/image';
import type { CombinedWantedPerson, FBIWantedItem, InterpolNotice } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getPrimaryImageUrl, SEX_MAP, HAIR_COLOR_MAP, EYE_COLOR_MAP, mapInterpolColorCodes } from '@/lib/api';
import {
  AlertTriangle, Award, Briefcase, CalendarDays, FileText, Globe, MapPin, User, Users, Fingerprint, Scale, Languages, UserMinus, Info, Search, ShieldQuestion
} from 'lucide-react';
import { useState, useEffect } from 'react';

interface DetailItemProps {
  icon: React.ElementType;
  label: string;
  value?: string | string[] | null | React.ReactNode;
  isList?: boolean;
}

function DetailItem({ icon: Icon, label, value, isList = false }: DetailItemProps) {
  if (value === null || value === undefined || (Array.isArray(value) && value.length === 0) || (typeof value === 'string' && value.trim() === '')) {
    return null;
  }

  let displayValue: React.ReactNode;
  if (Array.isArray(value)) {
    if (isList) {
      displayValue = (
        <ul className="list-disc list-inside">
          {value.map((item, index) => (
            <li key={index}>{String(item)}</li>
          ))}
        </ul>
      );
    } else {
      displayValue = value.join(', ');
    }
  } else {
    displayValue = value;
  }
  
  const isHtmlString = typeof displayValue === 'string' && (displayValue.includes('<p>') || displayValue.includes('<li>') || displayValue.includes('<br'));

  return (
    <div className="flex items-start gap-3 py-2 border-b border-dashed">
      <Icon className="h-5 w-5 text-accent mt-1 shrink-0" />
      <div>
        <p className="text-sm font-semibold text-foreground">{label}</p>
        {isHtmlString ? (
          <div className="text-sm text-muted-foreground prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: displayValue as string }} />
        ) : isList ? (
          <div className="text-sm text-muted-foreground">{displayValue}</div>
        ) : (
          <p className="text-sm text-muted-foreground">{String(displayValue)}</p>
        )}
      </div>
    </div>
  );
}


export function PersonDetailsCard({ person }: { person: CombinedWantedPerson }) {
  const fbiData = person.source === 'fbi' ? person.originalData as FBIWantedItem : null;
  const interpolData = person.source === 'interpol' ? person.originalData as InterpolNotice : null;

  const primaryImage = getPrimaryImageUrl(person);
  const placeholderImage = `https://placehold.co/600x800.png?text=${encodeURIComponent(person.name || 'N/A')}`;

  const [formattedPublicationDate, setFormattedPublicationDate] = useState<string | null>(
    fbiData?.publication ? fbiData.publication.split("T")[0] : null
  );
  const [formattedModifiedDate, setFormattedModifiedDate] = useState<string | null>(
    fbiData?.modified ? fbiData.modified.split("T")[0] : null
  );

  useEffect(() => {
    if (fbiData?.publication) {
      try {
        setFormattedPublicationDate(new Date(fbiData.publication).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric'}));
      } catch (e) {
        // Fallback already set in useState
      }
    }
    if (fbiData?.modified) {
      try {
        setFormattedModifiedDate(new Date(fbiData.modified).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric'}));
      } catch (e) {
         // Fallback already set in useState
      }
    }
  }, [fbiData?.publication, fbiData?.modified]);

  const getClassificationBadge = () => {
    switch(person.classification) {
      case 'MISSING_PERSON':
        return <Badge variant="secondary" className="mb-2 bg-yellow-500 text-black flex items-center gap-1 text-sm py-1 px-2"><UserMinus className="mr-1 h-4 w-4"/>Missing Person</Badge>;
      case 'VICTIM_IDENTIFICATION':
        return <Badge variant="secondary" className="mb-2 bg-blue-400 text-black flex items-center gap-1 text-sm py-1 px-2"><Search className="mr-1 h-4 w-4"/>Unidentified Person</Badge>;
      case 'SEEKING_INFORMATION':
        return <Badge variant="secondary" className="mb-2 bg-green-500 text-white flex items-center gap-1 text-sm py-1 px-2"><Info className="mr-1 h-4 w-4"/>Seeking Information</Badge>;
      case 'WANTED_CRIMINAL':
      default:
        return <Badge variant={person.source === 'fbi' ? 'destructive' : 'default'} className="mb-2 text-sm py-1 px-2">
                 <ShieldQuestion className="mr-1 h-4 w-4"/> {person.source.toUpperCase()} ID: {person.rawId}
               </Badge>;
    }
  };

  return (
    <Card className="overflow-hidden shadow-xl">
      <CardHeader className="bg-muted p-6">
        <div className="flex flex-col md:flex-row gap-6 items-start">
          <div className="w-full md:w-1/3 lg:w-1/4 relative aspect-[3/4] rounded-lg overflow-hidden shadow-md border">
            <Image
              src={primaryImage}
              alt={`Photo of ${person.name || 'person'}`}
              layout="fill"
              objectFit="cover"
              data-ai-hint="person portrait"
              unoptimized={person.source === 'interpol'}
              onError={(e) => { (e.target as HTMLImageElement).src = placeholderImage; }}
            />
          </div>
          <div className="flex-1">
            {getClassificationBadge()}
            <CardTitle className="text-3xl font-headline mb-2">{person.name || 'N/A'}</CardTitle>
            {person.classification === 'WANTED_CRIMINAL' && person.aliases && person.aliases.length > 0 && (
               <CardDescription className="text-md text-accent mb-1">Aliases: {person.aliases.join(', ')}</CardDescription>
            )}
            <CardDescription className="text-lg text-muted-foreground">
              {person.caseTypeDescription || 'Details not specified.'}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-primary mb-3 font-headline">Personal Information</h3>
          <DetailItem icon={User} label="Sex" value={person.sex || (interpolData?.sex_id ? SEX_MAP[interpolData.sex_id] : null)} />
          <DetailItem icon={CalendarDays} label="Date of Birth" value={person.dateOfBirth} />
          {fbiData?.age_range && <DetailItem icon={CalendarDays} label="Age Range" value={fbiData.age_range.join(' - ')} />}
          {person.age && <DetailItem icon={User} label="Age" value={person.age.toString()} />}
          <DetailItem icon={MapPin} label="Place of Birth" value={person.placeOfBirth} />
          <DetailItem icon={Globe} label="Nationality" value={person.nationality?.join(', ')} />
          {fbiData?.race && <DetailItem icon={Users} label="Race" value={fbiData.race} />}
          {interpolData?.country_of_birth_id && <DetailItem icon={MapPin} label="Country of Birth" value={interpolData.country_of_birth_id} />}
          {fbiData?.languages && fbiData.languages.length > 0 && <DetailItem icon={Languages} label="Languages" value={fbiData.languages.join(', ')} />}
        </div>

        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-primary mb-3 font-headline">Physical Description</h3>
          <DetailItem icon={User} label="Height" value={person.height} />
          <DetailItem icon={User} label="Weight" value={person.weight} />
          <DetailItem icon={User} label="Hair Color" value={person.hairColor || mapInterpolColorCodes(interpolData?.hairs_id, HAIR_COLOR_MAP)} />
          <DetailItem icon={User} label="Eye Color" value={person.eyeColor || mapInterpolColorCodes(interpolData?.eyes_colors_id, EYE_COLOR_MAP)} />
          {fbiData?.build && <DetailItem icon={User} label="Build" value={fbiData.build} />}
          {fbiData?.complexion && <DetailItem icon={User} label="Complexion" value={fbiData.complexion} />}
          <DetailItem icon={Fingerprint} label="Scars & Marks / Distinguishing Marks" value={person.distinguishingMarks} />
        </div>

        <div className="md:col-span-2 space-y-2">
           <h3 className="text-xl font-semibold text-primary mb-3 font-headline">
            {person.classification === 'WANTED_CRIMINAL' ? "Case Information" : "Case Details"}
          </h3>
          {person.classification === 'WANTED_CRIMINAL' && person.charges && person.charges.length > 0 && (
             <DetailItem icon={Scale} label="Charges" value={person.charges} isList />
          )}
          {fbiData?.caution && <DetailItem icon={AlertTriangle} label="Caution" value={fbiData.caution} />}
          {person.warningMessage && <DetailItem icon={AlertTriangle} label="Warning" value={person.warningMessage} />}
          {/* 'Details' for FBI can be repetitive if already in caseTypeDescription or caution, so ensure it adds new info */}
          {person.details && person.details !== person.caseTypeDescription && person.details !== fbiData?.caution && (
            <DetailItem icon={FileText} label="Further Details" value={person.details} />
          )}
          {person.remarks && <DetailItem icon={FileText} label="Remarks" value={person.remarks} />}
          {fbiData?.additional_information && <DetailItem icon={FileText} label="Additional Information (FBI)" value={fbiData.additional_information} />}
          {person.rewardText && <DetailItem icon={Award} label="Reward" value={person.rewardText} />}
          
          {fbiData?.field_offices && fbiData.field_offices.length > 0 && (
            <DetailItem icon={Briefcase} label="FBI Field Office(s)" value={fbiData.field_offices.join(', ')} />
          )}
          {fbiData?.possible_countries && fbiData.possible_countries.length > 0 && (
            <DetailItem icon={Globe} label="Possible Countries (FBI)" value={fbiData.possible_countries.join(', ')} />
          )}
          {fbiData?.possible_states && fbiData.possible_states.length > 0 && (
             <DetailItem icon={MapPin} label="Possible States (FBI)" value={fbiData.possible_states.join(', ')} />
          )}
          {fbiData?.ncic && person.classification === 'WANTED_CRIMINAL' && <DetailItem icon={Fingerprint} label="NCIC" value={fbiData.ncic} />}
          {fbiData?.publication && formattedPublicationDate && <DetailItem icon={CalendarDays} label="Publication Date (FBI)" value={formattedPublicationDate} />}
          {fbiData?.modified && formattedModifiedDate && <DetailItem icon={CalendarDays} label="Last Modified (FBI)" value={formattedModifiedDate} />}
        </div>
        
        {person.images && person.images.length > 1 && (
          <div className="md:col-span-2 space-y-2">
            <h3 className="text-xl font-semibold text-primary mt-4 mb-3 font-headline">Additional Images</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {person.images.slice(1).map((imgUrl, index) => (
                imgUrl && <div key={index} className="relative aspect-square rounded-md overflow-hidden border">
                  <Image
                    src={imgUrl}
                    alt={`Additional photo ${index + 1} of ${person.name || 'person'}`}
                    layout="fill"
                    objectFit="cover"
                    data-ai-hint="person portrait"
                    unoptimized={person.source === 'interpol'}
                    onError={(e) => { (e.target as HTMLImageElement).src = `https://placehold.co/300x300.png?text=Image+Error`; }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
