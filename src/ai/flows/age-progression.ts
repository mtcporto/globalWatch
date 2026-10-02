// src/ai/flows/age-progression.ts
'use server';
/**
 * @fileOverview Implements age progression for a photo of a missing person.
 *
 * - ageProgression - A function that handles the age progression process.
 * - AgeProgressionInput - The input type for the ageProgression function.
 * - AgeProgressionOutput - The return type for the ageProgression function.
 */

import {generateGemini} from '@/ai/gemini';
import {z} from 'zod';

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

export async function ageProgression(rawInput: AgeProgressionInput): Promise<AgeProgressionOutput> {
  const input = AgeProgressionInputSchema.parse(rawInput);
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(input.photoDataUri);
  if (!match || input.photoDataUri.length > 14_000_000) throw new Error('Provide a JPEG, PNG or WebP image up to 10 MB');
  if (!Number.isFinite(input.yearsElapsed) || input.yearsElapsed < 0 || input.yearsElapsed > 120) throw new Error('Invalid elapsed years');
  const parts = await generateGemini([
    { inlineData: { mimeType: match[1], data: match[2] } },
    { text: `Generate an image of this person, but aged by ${input.yearsElapsed} years.` },
  ], { model: process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image', generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } });
  const image = parts.find(part => part.inlineData?.mimeType?.startsWith('image/'))?.inlineData;
  if (!image?.data || !/^image\/(png|jpeg|webp)$/.test(image.mimeType)) throw new Error('Gemini returned no supported image');
  return AgeProgressionOutputSchema.parse({ updatedPhotoDataUri: `data:${image.mimeType};base64,${image.data}` });
}
