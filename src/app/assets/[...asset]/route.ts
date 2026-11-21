import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { faviconPath, screenshotManifest } from '@/content/assetPaths';
import { categories, projects } from '@/content/projects';

const screenshots = new Set(categories.flatMap((category) => projects[category].map(({ screenshot }) => screenshot)));
const cache = { 'Cache-Control': 'no-store' };

export const dynamic = 'force-dynamic';

function publicFile(path: string) {
  return join(process.cwd(), 'public', path.slice(1));
}

export async function GET(_request: Request, { params }: { params: Promise<{ asset: string[] }> }) {
  const { asset } = await params;
  const path = `/assets/${asset.join('/')}`;

  if (path === screenshotManifest) {
    const available = await Promise.all([...screenshots].map(async (screenshot) => {
      const file = await stat(publicFile(screenshot)).catch(() => undefined);
      return file?.isFile() ? screenshot : null;
    }));
    return Response.json(available.filter(Boolean), { headers: cache });
  }

  // The route only serves the PNGs listed in the catalog and the site's favicon.
  if (path !== faviconPath && !screenshots.has(path)) return new Response(null, { status: 404, headers: cache });

  let image = await readFile(publicFile(path)).catch(() => undefined);
  if (!image && path === faviconPath) {
    image = await readFile(join(process.cwd(), 'public', 'assets', 'branding', 'favicon-fallback.png'));
  }
  if (!image) return new Response(null, { status: 404, headers: cache });

  return new Response(new Uint8Array(image), { headers: { ...cache, 'Content-Type': 'image/png' } });
}
