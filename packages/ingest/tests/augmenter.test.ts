import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildAugmentation } from '../src/augmenter.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('buildAugmentation', () => {
  it('returns undefined when no options are provided', async () => {
    const result = await buildAugmentation('My API', {});
    expect(result).toBeUndefined();
  });

  it('returns undefined when useContext7 is false and no docsUrl', async () => {
    const result = await buildAugmentation('My API', { useContext7: false });
    expect(result).toBeUndefined();
  });

  describe('docsUrl augmentation', () => {
    it('returns undefined when docsUrl fetch throws', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
      const result = await buildAugmentation('My API', {
        docsUrl: 'https://example.com/docs',
      });
      expect(result).toBeUndefined();
    });

    it('returns undefined when docsUrl response is not ok', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
      const result = await buildAugmentation('My API', {
        docsUrl: 'https://example.com/docs',
      });
      expect(result).toBeUndefined();
    });

    it('returns docsContext when docsUrl fetch succeeds', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          text: vi.fn().mockResolvedValue('Full API documentation content'),
        }),
      );
      const result = await buildAugmentation('My API', {
        docsUrl: 'https://example.com/docs',
      });
      expect(result).toBeDefined();
      expect(result!.docsContext).toBe('Full API documentation content');
    });

    it('sets docsUrl on source when provided', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          text: vi.fn().mockResolvedValue('docs'),
        }),
      );
      const result = await buildAugmentation('My API', {
        docsUrl: 'https://example.com/docs',
      });
      expect(result).toBeDefined();
    });
  });

  describe('context7 augmentation', () => {
    it('returns undefined when context7 library resolution fails', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
      const result = await buildAugmentation('My API', { useContext7: true });
      expect(result).toBeUndefined();
    });

    it('returns undefined when context7 fetch throws', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Context7 unavailable')));
      const result = await buildAugmentation('My API', { useContext7: true });
      expect(result).toBeUndefined();
    });

    it('returns context7 docs when augmentation succeeds', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({ id: 'lib-123', name: 'My API' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({ docs: 'Context7 documentation for My API' }),
        });
      vi.stubGlobal('fetch', fetchMock);

      const result = await buildAugmentation('My API', { useContext7: true });
      expect(result).toBeDefined();
      expect(result!.context7Docs).toBe('Context7 documentation for My API');
      expect(result!.context7LibraryId).toBe('lib-123');
    });

    it('uses context7Library override when provided', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({ id: 'custom-lib', name: 'Custom' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({ docs: 'Custom library docs' }),
        });
      vi.stubGlobal('fetch', fetchMock);

      const result = await buildAugmentation('My API', {
        useContext7: true,
        context7Library: 'custom-override',
      });
      expect(result).toBeDefined();
    });

    it('returns undefined when docs response is ok but has no docs field', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({ id: 'lib-123', name: 'My API' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({}), // response ok but no docs field
        });
      vi.stubGlobal('fetch', fetchMock);

      const result = await buildAugmentation('My API', { useContext7: true });
      expect(result).toBeUndefined();
    });

    it('returns undefined when library resolved but docs fetch fails', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({ id: 'lib-123', name: 'My API' }),
        })
        .mockResolvedValueOnce({ ok: false });
      vi.stubGlobal('fetch', fetchMock);

      const result = await buildAugmentation('My API', { useContext7: true });
      expect(result).toBeUndefined();
    });

    it('returns undefined when resolved library has no id', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: vi.fn().mockResolvedValue({ name: 'My API' }), // no id field
        }),
      );
      const result = await buildAugmentation('My API', { useContext7: true });
      expect(result).toBeUndefined();
    });
  });

  describe('combined augmentation', () => {
    it('combines docsUrl and context7 results when both succeed', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          // docsUrl fetch
          ok: true,
          text: vi.fn().mockResolvedValue('External docs'),
        })
        .mockResolvedValueOnce({
          // context7 resolve
          ok: true,
          json: vi.fn().mockResolvedValue({ id: 'lib-123', name: 'My API' }),
        })
        .mockResolvedValueOnce({
          // context7 docs
          ok: true,
          json: vi.fn().mockResolvedValue({ docs: 'Context7 docs' }),
        });
      vi.stubGlobal('fetch', fetchMock);

      const result = await buildAugmentation('My API', {
        docsUrl: 'https://example.com/docs',
        useContext7: true,
      });
      expect(result).toBeDefined();
      expect(result!.docsContext).toBe('External docs');
      expect(result!.context7Docs).toBe('Context7 docs');
    });
  });
});
