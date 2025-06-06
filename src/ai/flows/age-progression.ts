// src/ai/flows/age-progression.ts
'use server';
/**
 * @fileOverview Implements age progression for a photo of a missing person.
 *
 * - ageProgression - A function that handles the age progression process.
 * - AgeProgressionInput - The input type for the ageProgression function.
 * - AgeProgressionOutput - The return type for the ageProgression function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AgeProgressionInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "The last known photo of the missing person, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  yearsElapsed: z
    .number()
    .describe('The number of years that have passed since the photo was taken.'),
});

export type AgeProgressionInput = z.infer<typeof AgeProgressionInputSchema>;

const AgeProgressionOutputSchema = z.object({
  updatedPhotoDataUri: z
    .string()
    .describe('The age-progressed photo of the missing person.'),
});

export type AgeProgressionOutput = z.infer<typeof AgeProgressionOutputSchema>;

export async function ageProgression(input: AgeProgressionInput): Promise<AgeProgressionOutput> {
  return ageProgressionFlow(input);
}

const ageProgressionPrompt = ai.definePrompt({
  name: 'ageProgressionPrompt',
  input: {schema: AgeProgressionInputSchema},
  output: {schema: AgeProgressionOutputSchema},
  prompt: [
    {media: {url: '{{{photoDataUri}}}'}},
    {
      text:
        'Generate an image of this person, but aged by {{{yearsElapsed}}} years.',
    },
  ],
  config: {
    responseModalities: ['TEXT', 'IMAGE'],
  },
});

const ageProgressionFlow = ai.defineFlow(
  {
    name: 'ageProgressionFlow',
    inputSchema: AgeProgressionInputSchema,
    outputSchema: AgeProgressionOutputSchema,
  },
  async input => {
    const {media} = await ageProgressionPrompt(input);
    return {updatedPhotoDataUri: media!.url!};
  }
);
