import fs from 'node:fs/promises';

import { APPLIED_RECORD_FILE, ensureConfigDir } from './config';
import { doesFileExist, hashFileInChunks } from './utils';

/**
 * What tweakcc left at one native binary path after `--apply`. The patched
 * installer (keep-patched-binary) and the SessionStart check both compare a
 * binary against this record; `size`/`mtimeMs` only let the check skip
 * hashing when the file is evidently untouched.
 */
export interface AppliedBinary {
  version: string;
  sha256: string;
  size: number;
  mtimeMs: number;
  appliedAt: string;
}

export interface AppliedRecord {
  binaries: Record<string, AppliedBinary>;
}

export const readAppliedRecord = async (): Promise<AppliedRecord | null> => {
  try {
    const record = JSON.parse(
      await fs.readFile(APPLIED_RECORD_FILE, 'utf8')
    ) as Partial<AppliedRecord>;
    return { binaries: record.binaries ?? {} };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
};

const writeAppliedRecord = async (record: AppliedRecord): Promise<void> => {
  await ensureConfigDir();
  const temporary = `${APPLIED_RECORD_FILE}.${process.pid}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(record, null, 2) + '\n');
  await fs.rename(temporary, APPLIED_RECORD_FILE);
};

export const sha256File = async (filePath: string): Promise<string> =>
  (await hashFileInChunks(filePath)) as string;

/**
 * Records the binary tweakcc just wrote. Entries for binaries that no longer
 * exist (versions Claude Code has cleaned up) are dropped.
 */
export const recordAppliedBinary = async (
  binaryPath: string,
  version: string
): Promise<AppliedBinary> => {
  const key = await fs.realpath(binaryPath);
  const stat = await fs.stat(key);
  const entry: AppliedBinary = {
    version,
    sha256: await sha256File(key),
    size: stat.size,
    mtimeMs: stat.mtimeMs,
    appliedAt: new Date().toISOString(),
  };
  const binaries: Record<string, AppliedBinary> = {};
  for (const [file, previous] of Object.entries(
    (await readAppliedRecord())?.binaries ?? {}
  )) {
    if (file !== key && (await doesFileExist(file))) binaries[file] = previous;
  }
  binaries[key] = entry;
  await writeAppliedRecord({ binaries });
  return entry;
};

/** Forgets every recorded binary (after an explicit restore). */
export const clearAppliedRecord = async (): Promise<void> => {
  await fs.rm(APPLIED_RECORD_FILE, { force: true });
};

/**
 * Whether `binaryPath` is byte-for-byte what tweakcc last wrote there. An
 * unchanged size and mtime is taken as unchanged; otherwise the file is hashed.
 */
export const isRecordedBinary = async (
  record: AppliedRecord,
  binaryPath: string
): Promise<boolean> => {
  const key = await fs.realpath(binaryPath);
  const entry = record.binaries[key];
  if (!entry) return false;
  const stat = await fs.stat(key);
  if (stat.size === entry.size && stat.mtimeMs === entry.mtimeMs) return true;
  return stat.size === entry.size && (await sha256File(key)) === entry.sha256;
};
