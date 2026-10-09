import { debug } from '../utils';
import { showDiff } from './index';

/**
 * Disable Claude Code's server-managed settings eligibility gate.
 *
 * This gate controls the initial load, cache use, refresh, and polling paths for
 * settings delivered by Anthropic's API or a configured gateway. Local managed
 * settings files use separate loaders and intentionally remain unaffected.
 * The gate memoizes its verdict; returning before it is recorded also leaves
 * the cached remote settings unread, because the cache is only served once the
 * recorded verdict is eligible.
 *
 * CC 2.1.220:
 * ```diff
 *  function cEe(){
 * +  return !1;
 *    if(lEe!==void 0)return lEe;
 *    if(JOe())return lEe=XOe(!0);
 *    if(Hn()==="gateway")return lEe=XOe(B5e(Cy()));
 * ```
 *
 * CC 2.1.295 (the gateway and override checks moved into a helper that
 * returns `{eligible, ineligibleReason}`):
 * ```diff
 *  function BA(){
 * +  return !1;
 *    let e=Cz();if(e!==void 0)return e;
 *    let{eligible:n,ineligibleReason:i}=k(),E=a.CLAUDE_CODE_EVAL_CONFINED===!0,...
 *    return cko(o,o?void 0:i)}
 * ```
 */
const GATE_PATTERNS = [
  // CC 2.1.220: the override-file and gateway branches identify the gate.
  /[,;{}]\s*function\s+[$\w]+\s*\(\s*\)\s*\{(\s*return\s*!1;)?(?=\s*if\s*\(\s*([$\w]+)\s*!==\s*void\s+0\s*\)\s*return\s+\2;\s*if\s*\(\s*[$\w]+\s*\(\s*\)\s*\)\s*return\s+\(?\s*\2\s*=\s*[$\w]+\s*\(\s*!0\s*\)\s*\)?;\s*if\s*\(\s*[$\w]+\s*\(\s*\)\s*===\s*"gateway"\s*\)\s*return\s+\(?\s*\2\s*=\s*[$\w]+\s*\()/,
  // CC 2.1.295: the memo check followed by the destructured eligibility verdict.
  /[,;{}]\s*function\s+[$\w]+\s*\(\s*\)\s*\{(\s*return\s*!1;)?(?=\s*let\s+([$\w]+)\s*=\s*[$\w]+\s*\(\s*\)\s*;\s*if\s*\(\s*\2\s*!==\s*void\s+0\s*\)\s*return\s+\2\s*;\s*let\s*\{\s*eligible\s*:\s*[$\w]+\s*,\s*ineligibleReason\s*:)/,
];

export const writeDisableServerManagedSettings = (
  oldFile: string
): string | null => {
  for (const pattern of GATE_PATTERNS) {
    const match = oldFile.match(pattern);
    if (!match || match.index === undefined) continue;
    if (match[1] !== undefined) return oldFile;

    const insertIndex = match.index + match[0].length;
    const insertion = 'return !1;';
    const newFile =
      oldFile.slice(0, insertIndex) + insertion + oldFile.slice(insertIndex);

    showDiff(oldFile, newFile, insertion, insertIndex, insertIndex);
    return newFile;
  }

  debug(
    'patch: disableServerManagedSettings: failed to find remote settings eligibility gate'
  );
  return null;
};
