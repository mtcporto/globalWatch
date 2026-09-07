import { NextRequest, NextResponse } from 'next/server';

const FBI_HOSTNAME = 'www.fbi.gov';

export async function GET(request: NextRequest) {
  const imageUrl = request.nextUrl.searchParams.get('url');

  if (!imageUrl) {
    return NextResponse.json({ error: 'Missing image URL' }, { status: 400 });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(imageUrl);
  } catch {
    return NextResponse.json({ error: 'Invalid image URL' }, { status: 400 });
  }

  if (parsedUrl.protocol !== 'https:' || parsedUrl.hostname !== FBI_HOSTNAME) {
    return NextResponse.json({ error: 'Image host is not allowed' }, { status: 403 });
  }

  const response = await fetch(parsedUrl, {
    headers: {
      Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      Referer: 'https://www.fbi.gov/',
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/128 Safari/537.36',
    },
    next: { revalidate: 86400 },
  });

  if (!response.ok) {
    return NextResponse.json({ error: 'Upstream image request failed' }, { status: response.status });
  }

  return new NextResponse(response.body, {
    headers: {
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      'Content-Type': response.headers.get('content-type') || 'image/jpeg',
    },
  });
}
