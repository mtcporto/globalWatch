
import { getAllFBIWantedData } from '@/lib/api'; 
import type { WantedPerson, PersonClassification } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Search, ShieldQuestion, UserX, Info, HelpCircle, Users, Activity, 
  Laptop, Baby, UserCheck, AlertTriangle, FileText 
} from "lucide-react";
import { PaginatedCategoryContent } from '@/components/PaginatedCategoryContent';

export const revalidate = 60 * 60 * 24 * 7; // Revalidate data every 7 days

const classificationTitles: Record<PersonClassification, string> = {
  WANTED_CRIMINAL: "Most Wanted",
  CYBER_MOST_WANTED: "Cyber's Most Wanted",
  CRIMES_AGAINST_CHILDREN: "Crimes Against Children",
  MISSING_PERSON: "Missing Persons",
  UNIDENTIFIED_PERSON: "Unidentified Persons",
  VICTIM_OF_CRIME: "Victims of Crime",
  SEEKING_INFORMATION: "Seeking Info",
  CAPTURED: "Captured / Resolved",
  UNSPECIFIED: "Other Cases"
};

const classificationIcons: Record<PersonClassification, React.ElementType> = {
  WANTED_CRIMINAL: ShieldQuestion,
  CYBER_MOST_WANTED: Laptop,
  CRIMES_AGAINST_CHILDREN: Baby,
  MISSING_PERSON: UserX,
  UNIDENTIFIED_PERSON: Search,
  VICTIM_OF_CRIME: AlertTriangle, 
  SEEKING_INFORMATION: Info,
  CAPTURED: UserCheck,
  UNSPECIFIED: HelpCircle
};

const classificationOrder: PersonClassification[] = [
  'WANTED_CRIMINAL',
  'CYBER_MOST_WANTED',
  'CRIMES_AGAINST_CHILDREN',
  'MISSING_PERSON',
  'SEEKING_INFORMATION',
  'UNIDENTIFIED_PERSON',
  'VICTIM_OF_CRIME',
  'CAPTURED',
  'UNSPECIFIED'
];

export default async function HomePage() {
  const allFBIPersons: WantedPerson[] = await getAllFBIWantedData();

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

  const stats = classificationOrder.map(cls => ({
    title: classificationTitles[cls],
    value: groupedPersons[cls]?.length || 0,
    icon: classificationIcons[cls],
    colorClass: cls === 'WANTED_CRIMINAL' || cls === 'CYBER_MOST_WANTED' || cls === 'CRIMES_AGAINST_CHILDREN' ? "text-destructive" 
              : cls === 'MISSING_PERSON' ? "text-yellow-600" 
              : cls === 'CAPTURED' ? "text-green-600"
              : cls === 'UNIDENTIFIED_PERSON' ? "text-blue-600"
              : cls === 'VICTIM_OF_CRIME' ? "text-orange-600"
              : "text-primary" 
  })).filter(stat => stat.value > 0); // Only show stats for categories with data

  const totalAlertsStat = { title: "Total FBI Records Processed", value: allFBIPersons.length, icon: Activity, colorClass: "text-primary" };
  const displayStats = [totalAlertsStat, ...stats];
  
  const activeClassifications = classificationOrder.filter(
    c => groupedPersons[c] && groupedPersons[c]!.length > 0
  );

  return (
    <div className="space-y-12">
      <div className="text-center">
        <h1 className="text-4xl font-bold font-headline text-primary">Global Watch</h1>
        <p className="text-lg text-muted-foreground mt-2">FBI Wanted List & Public Information</p>
      </div>
      
      <section className="space-y-6">
        <h2 className="text-2xl font-bold font-headline text-primary text-center">Current Overview (Full Dataset)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayStats.map((stat) => (
            <Card key={stat.title} className="shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-medium text-muted-foreground">{stat.title}</CardTitle>
                <stat.icon className={`h-6 w-6 ${stat.colorClass || 'text-muted-foreground'}`} />
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-primary">{stat.value.toLocaleString()}</div>
                 {stat.title === "Total FBI Records Processed" && <p className="text-xs text-muted-foreground">Reflects all records fetched & processed from the FBI API.</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
      
      {activeClassifications.length > 0 && (
        <Tabs defaultValue={activeClassifications[0]} className="w-full">
          <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:flex lg:flex-wrap lg:justify-center gap-1 mb-6">
            {activeClassifications.map(classification => {
                const IconComponent = classificationIcons[classification] || HelpCircle;
                return (
                  <TabsTrigger 
                    key={classification} 
                    value={classification} 
                    className="px-3 py-1.5 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    <span className="flex items-center gap-2">
                      <IconComponent className="h-4 w-4" />
                      {classificationTitles[classification]} ({groupedPersons[classification]?.length || 0})
                    </span>
                  </TabsTrigger>
                );
            })}
          </TabsList>

          {activeClassifications.map(classification => {
            const personsInClassification = groupedPersons[classification];
            if (personsInClassification && personsInClassification.length > 0) { 
              return (
                <TabsContent key={classification} value={classification} className="mt-0 pt-6 border-t">
                  <PaginatedCategoryContent items={personsInClassification} itemsPerPage={25} />
                </TabsContent>
              );
            }
            return null;
          })}
        </Tabs>
      )}

      <Alert variant="default" className="border-primary/30 bg-primary/5 mt-12">
        <ShieldQuestion className="h-5 w-5 text-primary mt-1" />
        <AlertTitle className="text-primary font-semibold">Information Source & Purpose</AlertTitle>
        <AlertDescription className="text-foreground/80">
          This platform compiles publicly available information from the FBI.
          It includes data on wanted individuals, missing persons, unidentified victims, victims of crime, and cases where public information is sought. 
          For official inquiries or to report information, please refer directly to the FBI website. 
          This site is for informational awareness only.
        </AlertDescription>
      </Alert>
    </div>
  );
}
