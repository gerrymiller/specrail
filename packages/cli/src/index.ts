// @specrail/cli -- User-facing command-line interface
//
// This is the entry point for `specrail` commands. It wires together all
// Specrail packages into a coherent user experience. The CLI is the primary
// way humans interact with Specrail; agents interact via MCP/SKILLS exports.

import { Command } from 'commander';
import { ingestCommand } from './commands/ingest.js';
import { inspectCommand } from './commands/inspect.js';
import { exportCommand } from './commands/export.js';
import { execCommand } from './commands/exec.js';
import { cacheCommand } from './commands/cache.js';

const program = new Command()
  .name('specrail')
  .description('Specrail turns API specs and docs into governed capabilities for agents.')
  .version('0.1.0');

program.addCommand(ingestCommand);
program.addCommand(inspectCommand);
program.addCommand(exportCommand);
program.addCommand(execCommand);
program.addCommand(cacheCommand);

program.parse();
