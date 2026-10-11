import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { installSessionStartHook, removeSessionStartHook } from './autoReapply';

describe('SessionStart hook', () => {
  let dir: string;
  const settingsFile = () => path.join(dir, 'settings.json');
  const read = async () =>
    JSON.parse(await fs.readFile(settingsFile(), 'utf8'));
  const other = {
    matcher: '',
    hooks: [{ type: 'command', command: 'echo hi' }],
  };

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tweakcc-hook-'));
    process.env.CLAUDE_CONFIG_DIR = dir;
    await fs.writeFile(
      settingsFile(),
      JSON.stringify({ model: 'opus', hooks: { SessionStart: [other] } })
    );
  });
  afterEach(async () => {
    delete process.env.CLAUDE_CONFIG_DIR;
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('installs once next to existing hooks and removes only its own', async () => {
    await installSessionStartHook();
    await installSessionStartHook();
    const installed = await read();
    expect(installed.model).toBe('opus');
    expect(installed.hooks.SessionStart).toHaveLength(2);
    expect(installed.hooks.SessionStart[0]).toEqual(other);
    expect(installed.hooks.SessionStart[1].matcher).toBe('startup|resume');
    expect(installed.hooks.SessionStart[1].hooks[0].command).toMatch(
      / --session-start-check$/
    );

    await removeSessionStartHook();
    expect(await read()).toEqual({
      model: 'opus',
      hooks: { SessionStart: [other] },
    });
  });
});
