import { describe, it, expect, vi, afterEach } from 'vitest';
import { resolveLibraryId, getLibraryDocs, augmentWithContext7 } from '../src/context7.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('resolveLibraryId', () => {
  it('returns library when found', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ id: 'lib-123', name: 'My API' }),
      }),
    );
    const result = await resolveLibraryId('My API');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('lib-123');
  });

  it('returns null when response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    const result = await resolveLibraryId('My API');
    expect(result).toBeNull();
  });

  it('returns null when response has no id', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ name: 'My API' }), // no id field
      }),
    );
    const result = await resolveLibraryId('My API');
    expect(result).toBeNull();
  });

  it('returns null on fetch error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    const result = await resolveLibraryId('My API');
    expect(result).toBeNull();
  });
});

describe('getLibraryDocs', () => {
  it('returns docs string on successful response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ docs: 'Some documentation content' }),
      }),
    );
    const result = await getLibraryDocs('lib-123');
    expect(result).toBe('Some documentation content');
  });

  it('returns null when docs field is absent from response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({}), // no docs field → data.docs ?? null
      }),
    );
    const result = await getLibraryDocs('lib-123');
    expect(result).toBeNull();
  });

  it('returns null when response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    const result = await getLibraryDocs('lib-123');
    expect(result).toBeNull();
  });

  it('returns null on fetch error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    const result = await getLibraryDocs('lib-123');
    expect(result).toBeNull();
  });

  it('passes topic option when provided', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ docs: 'Topic docs' }),
    });
    vi.stubGlobal('fetch', fetchSpy);
    const result = await getLibraryDocs('lib-123', { topic: 'authentication' });
    expect(result).toBe('Topic docs');
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toHaveProperty('topic', 'authentication');
  });

  it('passes maxTokens option when provided', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ docs: 'Truncated docs' }),
    });
    vi.stubGlobal('fetch', fetchSpy);
    const result = await getLibraryDocs('lib-123', { maxTokens: 500 });
    expect(result).toBe('Truncated docs');
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toHaveProperty('maxTokens', 500);
  });
});

describe('augmentWithContext7', () => {
  it('returns null when library not found', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    const result = await augmentWithContext7('My API');
    expect(result).toBeNull();
  });

  it('returns null when docs are empty', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ id: 'lib-123', name: 'My API' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({}), // no docs
      });
    vi.stubGlobal('fetch', fetchMock);
    const result = await augmentWithContext7('My API');
    expect(result).toBeNull();
  });

  it('returns libraryId and docs on success', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ id: 'lib-456', name: 'My API' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ docs: 'Full library documentation' }),
      });
    vi.stubGlobal('fetch', fetchMock);
    const result = await augmentWithContext7('My API');
    expect(result).not.toBeNull();
    expect(result!.libraryId).toBe('lib-456');
    expect(result!.docs).toBe('Full library documentation');
  });
});
