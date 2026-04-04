import type { Augmentation } from '@specrail/core';
import { augmentWithContext7 } from './context7.js';

// Augmentation options controlling which external sources to pull from
export interface AugmentOptions {
  docsUrl?: string;
  useContext7?: boolean;
  context7Library?: string;
}

// Fetch external documentation from a URL.
// Used when --docs flag is provided. Fetches raw text content.
async function fetchDocs(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

// Build augmentation data from external sources.
// This enriches capabilities with real documentation beyond the raw spec.
//
// Augmentation is additive -- it never replaces spec-provided information,
// only supplements it. If an external source is unavailable, the capability
// still works with spec-only data.
export async function buildAugmentation(
  specTitle: string,
  options: AugmentOptions,
): Promise<Augmentation | undefined> {
  const augmentation: Augmentation = {};
  let hasData = false;

  // Fetch external docs if URL provided
  if (options.docsUrl) {
    const docs = await fetchDocs(options.docsUrl);
    if (docs) {
      augmentation.docsContext = docs;
      hasData = true;
    }
  }

  // Context7 augmentation
  if (options.useContext7) {
    const libraryName = options.context7Library ?? specTitle;
    const result = await augmentWithContext7(libraryName);
    if (result) {
      augmentation.context7Docs = result.docs;
      augmentation.context7LibraryId = result.libraryId;
      hasData = true;
    }
  }

  return hasData ? augmentation : undefined;
}
