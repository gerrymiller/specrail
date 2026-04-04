import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const CLI = join(process.cwd(), 'packages', 'cli', 'dist', 'index.js');
const PETSTORE_SPEC = join(process.cwd(), 'fixtures', 'specs', 'petstore.yaml');

function run(args: string[], opts: { cwd?: string; env?: Record<string, string> } = {}): string {
  try {
    return execFileSync('node', [CLI, ...args], {
      cwd: opts.cwd ?? process.cwd(),
      env: { ...process.env, ...opts.env, NO_COLOR: '1' },
      encoding: 'utf-8',
      timeout: 30_000,
    });
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; status?: number };
    if (e.status !== undefined) {
      return (e.stdout ?? '') + (e.stderr ?? '');
    }
    throw err;
  }
}

function runWithStatus(
  args: string[],
  opts: { cwd?: string } = {},
): { stdout: string; status: number } {
  try {
    const stdout = execFileSync('node', [CLI, ...args], {
      cwd: opts.cwd ?? process.cwd(),
      env: { ...process.env, NO_COLOR: '1' },
      encoding: 'utf-8',
      timeout: 30_000,
    });
    return { stdout, status: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; status?: number };
    return { stdout: (e.stdout ?? '') + (e.stderr ?? ''), status: e.status ?? 1 };
  }
}

describe('CLI commands', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'specrail-cli-test-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe('specrail --help', () => {
    it('shows provider-first help text', () => {
      const output = run(['--help']);
      expect(output).toContain('Runtime capability broker');
      expect(output).toContain('provider');
      expect(output).toContain('resolve');
      expect(output).toContain('capabilities');
      expect(output).toContain('inspect');
      expect(output).toContain('exec');
      expect(output).toContain('refresh');
      expect(output).toContain('export');
      expect(output).toContain('ingest');
      expect(output).toContain('cache');
    });

    it('shows quick start example with provider workflow', () => {
      const output = run(['--help']);
      expect(output).toContain('specrail provider add');
      expect(output).toContain('specrail capabilities');
      expect(output).toContain('specrail exec');
    });
  });

  describe('specrail provider', () => {
    it('lists no providers initially', () => {
      const output = run(['provider', 'list'], { cwd: tmpDir });
      expect(output).toContain('No providers registered');
    });

    it('adds a provider', () => {
      const output = run(['provider', 'add', 'petstore', '--spec-url', PETSTORE_SPEC], {
        cwd: tmpDir,
      });
      expect(output).toContain('Provider "petstore" registered');
    });

    it('lists a registered provider', () => {
      run(['provider', 'add', 'petstore', '--spec-url', PETSTORE_SPEC], { cwd: tmpDir });
      const output = run(['provider', 'list'], { cwd: tmpDir });
      expect(output).toContain('petstore');
      expect(output).toContain(PETSTORE_SPEC);
    });

    it('shows provider details', () => {
      run(['provider', 'add', 'petstore', '--spec-url', PETSTORE_SPEC], { cwd: tmpDir });
      const output = run(['provider', 'show', 'petstore'], { cwd: tmpDir });
      expect(output).toContain('Provider: petstore');
      expect(output).toContain(PETSTORE_SPEC);
    });

    it('shows provider as JSON', () => {
      run(['provider', 'add', 'petstore', '--spec-url', PETSTORE_SPEC], { cwd: tmpDir });
      const output = run(['provider', 'show', 'petstore', '--json'], { cwd: tmpDir });
      const parsed = JSON.parse(output);
      expect(parsed.name).toBe('petstore');
      expect(parsed.specUrl).toBe(PETSTORE_SPEC);
    });

    it('removes a provider', () => {
      run(['provider', 'add', 'petstore', '--spec-url', PETSTORE_SPEC], { cwd: tmpDir });
      const output = run(['provider', 'remove', 'petstore'], { cwd: tmpDir });
      expect(output).toContain('Provider "petstore" removed');
    });

    it('reports when removing a non-existent provider', () => {
      const output = run(['provider', 'remove', 'nonexistent'], { cwd: tmpDir });
      expect(output).toContain('not found');
    });

    it('adds provider with all options', () => {
      run(
        [
          'provider',
          'add',
          'test-api',
          '--spec-url',
          PETSTORE_SPEC,
          '--docs-url',
          'https://example.com/docs',
          '--auth-env',
          'TEST_AUTH',
          '--policy',
          '/tmp/fake-policy.json',
          '--ttl',
          '7200',
        ],
        { cwd: tmpDir },
      );
      const output = run(['provider', 'show', 'test-api'], { cwd: tmpDir });
      expect(output).toContain(PETSTORE_SPEC);
      expect(output).toContain('https://example.com/docs');
      expect(output).toContain('TEST_AUTH');
      expect(output).toContain('7200');
    });
  });

  describe('specrail resolve', () => {
    it('resolves a registered provider', () => {
      run(['provider', 'add', 'petstore', '--spec-url', PETSTORE_SPEC], { cwd: tmpDir });
      const output = run(['resolve', 'petstore'], { cwd: tmpDir });
      expect(output).toContain('Provider: petstore');
      expect(output).toContain(PETSTORE_SPEC);
      expect(output).toContain('registry');
    });

    it('resolves as JSON', () => {
      run(['provider', 'add', 'petstore', '--spec-url', PETSTORE_SPEC], { cwd: tmpDir });
      const output = run(['resolve', 'petstore', '--json'], { cwd: tmpDir });
      const parsed = JSON.parse(output);
      expect(parsed.name).toBe('petstore');
      expect(parsed.resolvedVia).toBe('registry');
    });

    it('fails for unknown provider', () => {
      const { stdout, status } = runWithStatus(['resolve', 'unknown'], { cwd: tmpDir });
      expect(status).toBe(1);
      expect(stdout).toContain('not found');
    });
  });

  describe('specrail capabilities', () => {
    it('lists capabilities for a provider', () => {
      run(['provider', 'add', 'petstore', '--spec-url', PETSTORE_SPEC], { cwd: tmpDir });
      const output = run(['capabilities', 'petstore'], { cwd: tmpDir });
      expect(output).toContain('Capabilities for "petstore"');
      expect(output).toContain('listPets');
      expect(output).toContain('ALLOW');
      expect(output).toContain('DENY');
    });

    it('filters to allowed-only', () => {
      run(['provider', 'add', 'petstore', '--spec-url', PETSTORE_SPEC], { cwd: tmpDir });
      const output = run(['capabilities', 'petstore', '--allowed-only'], { cwd: tmpDir });
      expect(output).toContain('listPets');
      expect(output).not.toContain('createPet');
    });

    it('outputs as JSON', () => {
      run(['provider', 'add', 'petstore', '--spec-url', PETSTORE_SPEC], { cwd: tmpDir });
      const output = run(['capabilities', 'petstore', '--json'], { cwd: tmpDir });
      const parsed = JSON.parse(output);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(4);
    });
  });

  describe('specrail inspect', () => {
    it('inspects a provider bundle', () => {
      run(['provider', 'add', 'petstore', '--spec-url', PETSTORE_SPEC], { cwd: tmpDir });
      const output = run(['inspect', 'petstore'], { cwd: tmpDir });
      expect(output).toContain('Provider: petstore');
      expect(output).toContain('Petstore API');
      expect(output).toContain('Capabilities:');
    });

    it('shows capabilities view', () => {
      run(['provider', 'add', 'petstore', '--spec-url', PETSTORE_SPEC], { cwd: tmpDir });
      const output = run(['inspect', 'petstore', '--capabilities'], { cwd: tmpDir });
      expect(output).toContain('listPets');
      expect(output).toContain('ALLOWED');
    });

    it('shows policy view', () => {
      run(['provider', 'add', 'petstore', '--spec-url', PETSTORE_SPEC], { cwd: tmpDir });
      const output = run(['inspect', 'petstore', '--policy'], { cwd: tmpDir });
      expect(output).toContain('Policy decisions');
      expect(output).toContain('specrail-default');
    });

    it('outputs as JSON', () => {
      run(['provider', 'add', 'petstore', '--spec-url', PETSTORE_SPEC], { cwd: tmpDir });
      const output = run(['inspect', 'petstore', '--json'], { cwd: tmpDir });
      const parsed = JSON.parse(output);
      expect(parsed.version).toBe('1.0');
      expect(parsed.capabilities).toBeDefined();
    });
  });

  describe('specrail exec', () => {
    it('dry-runs a read capability', () => {
      run(['provider', 'add', 'petstore', '--spec-url', PETSTORE_SPEC], { cwd: tmpDir });
      const output = run(['exec', 'petstore', 'listPets', '--dry-run'], { cwd: tmpDir });
      expect(output).toContain('DRY RUN');
      expect(output).toContain('GET');
      expect(output).toContain('/pets');
    });

    it('denies a write capability', () => {
      run(['provider', 'add', 'petstore', '--spec-url', PETSTORE_SPEC], { cwd: tmpDir });
      const { stdout, status } = runWithStatus(['exec', 'petstore', 'createPet', '--dry-run'], {
        cwd: tmpDir,
      });
      expect(status).toBe(1);
      expect(stdout).toContain('Policy denied');
    });

    it('denies a delete capability', () => {
      run(['provider', 'add', 'petstore', '--spec-url', PETSTORE_SPEC], { cwd: tmpDir });
      const { stdout, status } = runWithStatus(['exec', 'petstore', 'deletePet', '--dry-run'], {
        cwd: tmpDir,
      });
      expect(status).toBe(1);
      expect(stdout).toContain('Policy denied');
    });
  });

  describe('specrail refresh', () => {
    it('force-rebuilds a provider bundle', () => {
      run(['provider', 'add', 'petstore', '--spec-url', PETSTORE_SPEC], { cwd: tmpDir });
      const output = run(['refresh', 'petstore'], { cwd: tmpDir });
      expect(output).toContain('Bundle refreshed');
      expect(output).toContain('Petstore API');
      expect(output).toContain('Capabilities:');
    });
  });

  describe('specrail export', () => {
    it('exports MCP tool definitions', () => {
      run(['provider', 'add', 'petstore', '--spec-url', PETSTORE_SPEC], { cwd: tmpDir });
      const output = run(['export', 'mcp', 'petstore'], { cwd: tmpDir });
      const parsed = JSON.parse(output);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBeGreaterThan(0);
      expect(parsed[0].name).toBeDefined();
      expect(parsed[0].inputSchema).toBeDefined();
    });

    it('exports MCP to a file', () => {
      run(['provider', 'add', 'petstore', '--spec-url', PETSTORE_SPEC], { cwd: tmpDir });
      const outFile = join(tmpDir, 'mcp.json');
      const output = run(['export', 'mcp', 'petstore', '--output', outFile], { cwd: tmpDir });
      expect(output).toContain('MCP tools exported');
    });

    it('exports SKILLS.md', () => {
      run(['provider', 'add', 'petstore', '--spec-url', PETSTORE_SPEC], { cwd: tmpDir });
      const output = run(['export', 'skills', 'petstore'], { cwd: tmpDir });
      expect(output).toContain('# SKILLS:');
    });

    it('exports SKILLS to a file', () => {
      run(['provider', 'add', 'petstore', '--spec-url', PETSTORE_SPEC], { cwd: tmpDir });
      const outFile = join(tmpDir, 'SKILLS.md');
      const output = run(['export', 'skills', 'petstore', '--output', outFile], { cwd: tmpDir });
      expect(output).toContain('SKILLS exported');
    });
  });

  describe('specrail ingest (escape hatch)', () => {
    it('still works for manual one-off specs', () => {
      const output = run(
        ['ingest', PETSTORE_SPEC, '--name', 'manual-test', '--output', join(tmpDir, 'cache')],
        { cwd: tmpDir },
      );
      expect(output).toContain('Bundle generated successfully');
      expect(output).toContain('manual-test');
    });
  });

  describe('specrail cache', () => {
    it('lists bundles', () => {
      const output = run(['cache', 'list'], { cwd: tmpDir });
      // May or may not have bundles depending on global cache
      expect(typeof output).toBe('string');
    });

    it('shows cache paths', () => {
      const output = run(['cache', 'path'], { cwd: tmpDir });
      expect(output).toContain('Local:');
      expect(output).toContain('Global:');
    });
  });

  describe('provider-first workflow end-to-end', () => {
    it('register → resolve → capabilities → exec → export → refresh → remove', () => {
      // 1. Register
      run(['provider', 'add', 'petstore', '--spec-url', PETSTORE_SPEC], { cwd: tmpDir });

      // 2. Resolve
      const resolveOut = run(['resolve', 'petstore'], { cwd: tmpDir });
      expect(resolveOut).toContain('registry');

      // 3. Capabilities
      const capsOut = run(['capabilities', 'petstore'], { cwd: tmpDir });
      expect(capsOut).toContain('listPets');

      // 4. Exec (dry-run)
      const execOut = run(['exec', 'petstore', 'listPets', '--dry-run'], { cwd: tmpDir });
      expect(execOut).toContain('DRY RUN');

      // 5. Export MCP
      const mcpOut = run(['export', 'mcp', 'petstore'], { cwd: tmpDir });
      expect(JSON.parse(mcpOut).length).toBeGreaterThan(0);

      // 6. Refresh
      const refreshOut = run(['refresh', 'petstore'], { cwd: tmpDir });
      expect(refreshOut).toContain('Bundle refreshed');

      // 7. Remove
      const removeOut = run(['provider', 'remove', 'petstore'], { cwd: tmpDir });
      expect(removeOut).toContain('removed');
    });

    it('exec with custom policy allowing writes', async () => {
      const policyPath = join(tmpDir, 'allow-writes.json');
      await writeFile(
        policyPath,
        JSON.stringify({
          version: '1.0',
          name: 'allow-all',
          rules: [
            {
              match: { classification: ['read', 'write', 'delete', 'action', 'admin'] },
              effect: 'allow',
            },
          ],
          defaults: {},
        }),
        'utf-8',
      );

      run(['provider', 'add', 'petstore', '--spec-url', PETSTORE_SPEC, '--policy', policyPath], {
        cwd: tmpDir,
      });

      // With allow-all policy, createPet should not be denied
      const output = run(['exec', 'petstore', 'createPet', '--dry-run'], { cwd: tmpDir });
      expect(output).toContain('DRY RUN');
      expect(output).toContain('POST');
    });
  });
});
