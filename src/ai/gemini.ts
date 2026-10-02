// Server-side Gemini client. Credentials never enter URLs or client bundles.
export type GeminiPart = { text?: string; inlineData?: { mimeType: string; data: string } };

export async function generateGemini(
  parts: GeminiPart[],
  options: { model?: string; generationConfig?: Record<string, unknown> } = {},
): Promise<GeminiPart[]> {
  if (typeof window !== 'undefined') throw new Error('Gemini requires a server runtime');
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error('Configure GEMINI_API_KEY or GOOGLE_API_KEY');
  const model = options.model || process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  if (!/^[a-zA-Z0-9._-]+$/.test(model)) throw new Error('Invalid Gemini model');
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: options.generationConfig }),
    signal: AbortSignal.timeout(60_000),
    cache: 'no-store',
    redirect: 'error',
  });
  if (!response.ok) throw new Error(`Gemini request failed (HTTP ${response.status})`);
  const data = await response.json();
  const candidate = data.candidates?.[0];
  if (data.promptFeedback?.blockReason || (candidate?.finishReason && candidate.finishReason !== 'STOP')) {
    throw new Error('Gemini did not complete the requested generation');
  }
  if (!Array.isArray(candidate?.content?.parts) || !candidate.content.parts.length) {
    throw new Error('Gemini returned no content');
  }
  return candidate.content.parts;
}

export async function generateJson(prompt: string, schema: Record<string, unknown>): Promise<unknown> {
  const parts = await generateGemini([{ text: prompt }], {
    generationConfig: { responseMimeType: 'application/json', responseSchema: schema },
  });
  return JSON.parse(parts.map(part => part.text || '').join(''));
}
