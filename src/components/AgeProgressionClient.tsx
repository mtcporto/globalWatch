import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function AgeProgressionClient() {
  return (
    <Card className="max-w-2xl mx-auto shadow-xl">
      <CardHeader>
        <CardTitle>Age progression is temporarily unavailable</CardTitle>
        <CardDescription>Photo generation is not available with the current AI service.</CardDescription>
      </CardHeader>
      <CardContent>
        <p>No photos can be uploaded or processed here at this time. You can continue browsing the wanted-person listings.</p>
      </CardContent>
    </Card>
  );
}
