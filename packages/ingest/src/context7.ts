// Context7 integration for documentation augmentation.
//
// Context7 (by Upstash) provides REST endpoints for retrieving up-to-date
// library documentation. We use it to enrich capability descriptions with
// real docs content beyond what the OpenAPI spec provides.
//
// Two-step process:
//   1. Resolve a library name to a Context7 library ID
//   2. Fetch documentation for that library
//
// This is a "best effort" augmentation -- if Context7 is unavailable or
// the library isn't found, we skip gracefully with a warning.

const CONTEXT7_API = 'https://api.context7.com/v1';

export interface Context7Library {
  id: string;
  name: string;
  description?: string;
}

export interface Context7DocsOptions {
  topic?: string;
  maxTokens?: number;
}

// Resolve a library name to its Context7 library ID.
// Returns null if the library is not found or Context7 is unavailable.
export async function resolveLibraryId(libraryName: string): Promise<Context7Library | null> {
  try {
    const response = await fetch(`${CONTEXT7_API}/resolve-library-id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ libraryName }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as Context7Library;
    return data.id ? data : null;
  } catch {
    // Context7 unavailable -- graceful degradation
    return null;
  }
}

// Fetch documentation for a library by its Context7 ID.
// Returns the raw documentation text, or null if unavailable.
export async function getLibraryDocs(
  libraryId: string,
  options?: Context7DocsOptions,
): Promise<string | null> {
  try {
    const body: Record<string, unknown> = { libraryId };
    if (options?.topic) body.topic = options.topic;
    if (options?.maxTokens) body.maxTokens = options.maxTokens;

    const response = await fetch(`${CONTEXT7_API}/get-library-docs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as { docs?: string };
    return data.docs ?? null;
  } catch {
    return null;
  }
}

// Convenience: resolve + fetch in one call.
// Used by the ingest pipeline when --context7 flag is set.
export async function augmentWithContext7(
  libraryName: string,
  topic?: string,
): Promise<{ libraryId: string; docs: string } | null> {
  const library = await resolveLibraryId(libraryName);
  if (!library) return null;

  const docs = await getLibraryDocs(library.id, { topic });
  if (!docs) return null;

  return { libraryId: library.id, docs };
}
