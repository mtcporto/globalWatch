"use client";

import { useState, type ChangeEvent, type FormEvent } from 'react';
import Image from 'next/image';
import { ageProgression } from '@/ai/flows/age-progression';
import type { AgeProgressionInput, AgeProgressionOutput } from '@/ai/flows/age-progression';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { UploadCloud, Wand2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { LoadingSpinner } from './LoadingSpinner'; // Assuming you have this component
import { useToast } from "@/hooks/use-toast";

export function AgeProgressionClient() {
  const [photoDataUri, setPhotoDataUri] = useState<string | null>(null);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null); // For client-side preview
  const [yearsElapsed, setYearsElapsed] = useState<number>(10);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AgeProgressionOutput | null>(null);
  const { toast } = useToast();

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 4 * 1024 * 1024) { // Limit file size (e.g., 4MB)
        setError("File size exceeds 4MB limit.");
        toast({
          variant: "destructive",
          title: "File Too Large",
          description: "Please upload an image smaller than 4MB.",
        });
        setPhotoDataUri(null);
        setOriginalImageUrl(null);
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoDataUri(reader.result as string);
        setOriginalImageUrl(URL.createObjectURL(file)); // For preview
        setError(null); // Clear previous errors
        setResult(null); // Clear previous results
      };
      reader.onerror = () => {
        setError("Failed to read file.");
        toast({
          variant: "destructive",
          title: "File Read Error",
          description: "Could not read the selected file. Please try again.",
        });
      }
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!photoDataUri || yearsElapsed <= 0) {
      setError('Please upload a photo and specify a valid number of years.');
      toast({
          variant: "destructive",
          title: "Invalid Input",
          description: "Ensure a photo is uploaded and years elapsed is positive.",
        });
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const input: AgeProgressionInput = { photoDataUri, yearsElapsed };
      const output = await ageProgression(input);
      setResult(output);
      toast({
        title: "Age Progression Successful",
        description: "The image has been updated.",
        action: <CheckCircle2 className="text-green-500" />,
      });
    } catch (err) {
      console.error('Age progression failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred during age progression.';
      setError(errorMessage);
      toast({
        variant: "destructive",
        title: "Age Progression Failed",
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto shadow-xl">
      <CardHeader>
        <CardTitle className="text-2xl font-headline flex items-center gap-2">
          <Wand2 className="h-6 w-6 text-primary" />
          Age Progression Tool
        </CardTitle>
        <CardDescription>
          Upload a photo and specify the years elapsed to see an AI-generated age progression.
          This tool is for illustrative purposes only.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="photo" className="text-base">Upload Photo</Label>
            <div className="flex items-center justify-center w-full">
                <label htmlFor="photo-upload" className="flex flex-col items-center justify-center w-full h-48 border-2 border-border border-dashed rounded-lg cursor-pointer bg-card hover:bg-muted transition-colors">
                    {originalImageUrl ? (
                        <div className="relative w-36 h-36">
                             <Image src={originalImageUrl} alt="Uploaded preview" layout="fill" objectFit="contain" className="rounded-md" />
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <UploadCloud className="w-10 h-10 mb-3 text-muted-foreground" />
                            <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                            <p className="text-xs text-muted-foreground">PNG, JPG, GIF up to 4MB</p>
                        </div>
                    )}
                    <Input id="photo-upload" type="file" className="hidden" accept="image/png, image/jpeg, image/gif" onChange={handleFileChange} />
                </label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="years" className="text-base">Years Elapsed</Label>
            <Input
              id="years"
              type="number"
              value={yearsElapsed}
              onChange={(e) => setYearsElapsed(Math.max(1, parseInt(e.target.value, 10)))}
              min="1"
              max="100"
              required
              className="text-base"
            />
          </div>
          
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <Button type="submit" disabled={isLoading || !photoDataUri} className="w-full text-lg py-3">
            {isLoading ? (
              <>
                <LoadingSpinner size={20} className="mr-2" /> Processing...
              </>
            ) : (
              <>
                <Wand2 className="mr-2 h-5 w-5" /> Generate Age Progression
              </>
            )}
          </Button>
        </form>
      </CardContent>

      {result?.updatedPhotoDataUri && (
        <CardFooter className="flex flex-col items-center gap-6 pt-6 border-t">
            <h3 className="text-xl font-semibold text-center font-headline">Age Processed Result</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                <div className="text-center">
                    <p className="font-medium mb-2">Original</p>
                    {originalImageUrl && (
                         <div className="relative aspect-square w-full max-w-xs mx-auto rounded-lg overflow-hidden border">
                            <Image src={originalImageUrl} alt="Original photo" layout="fill" objectFit="cover" data-ai-hint="person portrait" />
                         </div>
                    )}
                </div>
                <div className="text-center">
                    <p className="font-medium mb-2">Processed ({yearsElapsed} years later)</p>
                     <div className="relative aspect-square w-full max-w-xs mx-auto rounded-lg overflow-hidden border">
                        <Image src={result.updatedPhotoDataUri} alt="Age progressed photo" layout="fill" objectFit="cover" data-ai-hint="person portrait aged" />
                     </div>
                </div>
            </div>
            <Alert variant="default" className="mt-4">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertTitle>Result Generated</AlertTitle>
              <AlertDescription>
                The age-progressed image is shown above. Results may vary and are AI-generated estimations.
              </AlertDescription>
            </Alert>
        </CardFooter>
      )}
    </Card>
  );
}
