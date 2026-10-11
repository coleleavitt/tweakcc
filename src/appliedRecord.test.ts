import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  clearAppliedRecord,
  isRecordedBinary,
  readAppliedRecord,
  recordAppliedBinary,
} from './appliedRecord';

describe('applied record', () => {
  let dir: string;
  let binary: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tweakcc-applied-'));
    binary = path.join(dir, '2.1.296');
    await fs.writeFile(binary, 'patched');
    await clearAppliedRecord();
  });
  afterEach(async () => {
    await clearAppliedRecord();
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('recognizes the recorded bytes and nothing else', async () => {
    await recordAppliedBinary(binary, '2.1.296');
    const record = (await readAppliedRecord())!;
    expect(record.binaries[await fs.realpath(binary)].version).toBe('2.1.296');
    expect(await isRecordedBinary(record, binary)).toBe(true);

    await fs.writeFile(binary, 'tampere');
    expect(await isRecordedBinary(record, binary)).toBe(false);
  });

  it('drops entries for binaries that no longer exist', async () => {
    const old = path.join(dir, '2.1.295');
    await fs.writeFile(old, 'old');
    await recordAppliedBinary(old, '2.1.295');
    await fs.rm(old);
    await recordAppliedBinary(binary, '2.1.296');
    expect(Object.keys((await readAppliedRecord())!.binaries)).toEqual([
      await fs.realpath(binary),
    ]);
  });
});
