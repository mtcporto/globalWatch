
"use client";

import Image from 'next/image';
import type { WantedPerson, FBIWantedItem } from '@/lib/types'; // Updated import
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getPrimaryImageUrl } from '@/lib/api';
import {
  AlertTriangle, Award, Briefcase, CalendarDays, FileText, Globe, MapPin, User, Users, Fingerprint, Scale, Languages, UserMinus, Info, Search, ShieldQuestion, HelpCircle, UserCheck, Baby, Laptop, UserRoundX, UserRoundSearch
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


export function PersonDetailsCard({ person }: { person: WantedPerson }) {
  const fbiData = person.originalData as FBIWantedItem; // Data is always FBI

  const primaryImage = getPrimaryImageUrl(person);
  const placeholderImage = `https://placehold.co/600x800.png?text=${encodeURIComponent(person.name || 'N/A')}`;

  const [formattedPublicationDate, setFormattedPublicationDate] = useState<string | null>(null);
  const [formattedModifiedDate, setFormattedModifiedDate] = useState<string | null>(null);

  useEffect(() => {
    if (fbiData?.publication) {
      try {
        setFormattedPublicationDate(new Date(fbiData.publication).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric'}));
      } catch (e) {
        setFormattedPublicationDate(fbiData.publication.split("T")[0]);
      }
    }
    if (fbiData?.modified) {
      try {
        setFormattedModifiedDate(new Date(fbiData.modified).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric'}));
      } catch (e) {
        setFormattedModifiedDate(fbiData.modified.split("T")[0]);
      }
    }
  }, [fbiData?.publication, fbiData?.modified]);

  const getClassificationBadge = () => {
    const baseClasses = "mb-2 flex items-center gap-1 text-sm py-1 px-2";
    switch(person.classification) {
      case 'MISSING_PERSON':
        return <Badge variant="secondary" className={`${baseClasses} bg-yellow-500 text-black`}><UserRoundX className="mr-1 h-4 w-4"/>Missing Person</Badge>;
      case 'UNIDENTIFIED_PERSON':
        return <Badge variant="secondary" className={`${baseClasses} bg-blue-400 text-black`}><UserRoundSearch className="mr-1 h-4 w-4"/>Unidentified Person</Badge>;
      case 'SEEKING_INFORMATION':
        return <Badge variant="secondary" className={`${baseClasses} bg-green-500 text-white`}><Info className="mr-1 h-4 w-4"/>Seeking Information</Badge>;
      case 'WANTED_CRIMINAL':
         return <Badge variant='destructive' className={`${baseClasses}`}><ShieldQuestion className="mr-1 h-4 w-4"/> FBI Most Wanted</Badge>;
      case 'CYBER_MOST_WANTED':
        return <Badge variant='destructive' className={`${baseClasses} bg-purple-600 text-white`}><Laptop className="mr-1 h-4 w-4"/>Cyber Most Wanted</Badge>;
      case 'CRIMES_AGAINST_CHILDREN':
        return <Badge variant='destructive' className={`${baseClasses} bg-pink-600 text-white`}><Baby className="mr-1 h-4 w-4"/>Crimes Against Children</Badge>;
      case 'CAPTURED':
        return <Badge variant="default" className={`${baseClasses} bg-green-600 text-white`}><UserCheck className="mr-1 h-4 w-4"/>Captured / Resolved</Badge>;
      case 'VICTIM_OF_CRIME':
        return <Badge variant="secondary" className={`${baseClasses} bg-orange-500 text-white`}><AlertTriangle className="mr-1 h-4 w-4"/>Victim of Crime</Badge>;
      case 'UNSPECIFIED':
      default:
        return <Badge variant='default' className={`${baseClasses} bg-gray-500 text-white`}><HelpCircle className="mr-1 h-4 w-4"/> FBI Alert (ID: {person.rawId})</Badge>;
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
              onError={(e) => { (e.target as HTMLImageElement).src = placeholderImage; }}
            />
          </div>
          <div className="flex-1">
            {getClassificationBadge()}
            <CardTitle className="text-3xl font-headline mb-2">{person.name || 'N/A'}</CardTitle>
            {(person.classification === 'WANTED_CRIMINAL' || person.classification === 'CYBER_MOST_WANTED' || person.classification === 'CRIMES_AGAINST_CHILDREN' || person.classification === 'UNSPECIFIED') && person.aliases && person.aliases.length > 0 && (
               <CardDescription className="text-md text-accent mb-1">Aliases: {person.aliases.join(', ')}</CardDescription>
            )}
            <CardDescription className="text-lg text-muted-foreground">
              {person.caseTypeDescription || 'Details not specified.'}
            </CardDescription>
             <div className="mt-2 text-xs text-muted-foreground">FBI UID: {person.rawId}</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-primary mb-3 font-headline">Personal Information</h3>
          <DetailItem icon={User} label="Sex" value={person.sex} />
          <DetailItem icon={CalendarDays} label="Date of Birth" value={person.dateOfBirth} />
          {fbiData?.age_range && (
            <DetailItem 
              icon={CalendarDays} 
              label="Age Range" 
              value={
                Array.isArray(fbiData.age_range) 
                ? fbiData.age_range.join(' - ') 
                : String(fbiData.age_range) 
              } 
            />
          )}
          {person.age && <DetailItem icon={User} label="Age" value={person.age.toString()} />}
          <DetailItem icon={MapPin} label="Place of Birth" value={person.placeOfBirth} />
          <DetailItem icon={Globe} label="Nationality" value={person.nationality?.join(', ')} />
          {fbiData?.race && <DetailItem icon={Users} label="Race" value={fbiData.race} />}
          {fbiData?.languages && fbiData.languages.length > 0 && <DetailItem icon={Languages} label="Languages" value={fbiData.languages.join(', ')} />}
        </div>

        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-primary mb-3 font-headline">Physical Description</h3>
          <DetailItem icon={User} label="Height" value={person.height} />
          <DetailItem icon={User} label="Weight" value={person.weight} />
          <DetailItem icon={User} label="Hair Color" value={person.hairColor} />
          <DetailItem icon={User} label="Eye Color" value={person.eyeColor} />
          {fbiData?.build && <DetailItem icon={User} label="Build" value={fbiData.build} />}
          {fbiData?.complexion && <DetailItem icon={User} label="Complexion" value={fbiData.complexion} />}
          <DetailItem icon={Fingerprint} label="Scars & Marks / Distinguishing Marks" value={person.distinguishingMarks} />
        </div>

        <div className="md:col-span-2 space-y-2">
           <h3 className="text-xl font-semibold text-primary mb-3 font-headline">
            {person.classification === 'WANTED_CRIMINAL' || person.classification === 'CYBER_MOST_WANTED' || person.classification === 'CRIMES_AGAINST_CHILDREN' ? "Case Information" : "Case Details"}
          </h3>
          {(person.classification === 'WANTED_CRIMINAL' || person.classification === 'CYBER_MOST_WANTED' || person.classification === 'CRIMES_AGAINST_CHILDREN' || person.classification === 'UNSPECIFIED') && person.charges && person.charges.length > 0 && (
             <DetailItem icon={Scale} label="Charges/Subjects" value={person.charges} isList />
          )}
          {fbiData?.caution && <DetailItem icon={AlertTriangle} label="Caution" value={fbiData.caution} />}
          {person.warningMessage && <DetailItem icon={AlertTriangle} label="Warning" value={person.warningMessage} />}
          {person.details && person.details !== person.caseTypeDescription && person.details !== fbiData?.caution && (
            <DetailItem icon={FileText} label="Further Details" value={person.details} />
          )}
           {person.remarks && (
            <DetailItem icon={FileText} label="Remarks" value={person.remarks} />
          )}
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
          {fbiData?.ncic && (person.classification === 'WANTED_CRIMINAL' || person.classification === 'CYBER_MOST_WANTED' || person.classification === 'CRIMES_AGAINST_CHILDREN' || person.classification === 'UNSPECIFIED') && <DetailItem icon={Fingerprint} label="NCIC" value={fbiData.ncic} />}
          <DetailItem icon={CalendarDays} label="Publication Date (FBI)" value={formattedPublicationDate || (fbiData?.publication ? fbiData.publication.split("T")[0] : null)} />
          <DetailItem icon={CalendarDays} label="Last Modified (FBI)" value={formattedModifiedDate || (fbiData?.modified ? fbiData.modified.split("T")[0] : null)} />
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
