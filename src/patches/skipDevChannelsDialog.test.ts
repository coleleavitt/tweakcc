import { afterEach, describe, expect, it, vi } from 'vitest';

import { writeSkipDevChannelsDialog } from './skipDevChannelsDialog';

// Excerpt of the development channels chunk in Claude Code 2.1.291, with its
// React plumbing replaced by stubs.
const CHUNK =
  'function R(p){return`server:${p.name}`}' +
  'function k(D){let o=w(13),{channels:m,onAccept:h}=D,f;' +
  'f=function a(L){F:switch(L){case"accept":{h();break F}}};' +
  'return{title:"WARNING: Loading development channels",onConfirm:()=>f("accept")}}';

/** Evaluates the chunk and renders the dialog once. */
const render = async (source: string) => {
  const calls: string[] = [];
  const k = new Function('w', `${source};return k;`)(() => []);
  const rendered = k({
    channels: [{ name: 'whatsapp' }],
    onAccept: () => calls.push('onAccept'),
  });
  await new Promise(resolve => queueMicrotask(() => resolve(undefined)));
  return { rendered, calls };
};

describe('writeSkipDevChannelsDialog', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('accepts and closes without drawing', async () => {
    const { rendered, calls } = await render(
      writeSkipDevChannelsDialog(CHUNK)!
    );
    expect(rendered).toBeNull();
    expect(calls).toEqual(['onAccept']);
  });

  it('draws the dialog when unpatched', async () => {
    const { rendered, calls } = await render(CHUNK);
    expect(rendered).not.toBeNull();
    expect(calls).toEqual([]);
  });

  it('is idempotent', () => {
    const patched = writeSkipDevChannelsDialog(CHUNK)!;
    expect(writeSkipDevChannelsDialog(patched)).toBe(patched);
  });

  it('matches identifiers containing `$`', () => {
    const input =
      'function $k($D){let o=w(13),{channels:m$,onAccept:$h}=$D,f;return"Loading development channels"}';
    expect(writeSkipDevChannelsDialog(input)).toContain(
      'return queueMicrotask($D.onAccept),null;'
    );
  });

  it('patches the Claude Code 2.1.295 dialog component', () => {
    // Head of the dialog component in chunk-cep7bkgd.js (2.1.295).
    const input =
      'var A=(m)=>m;function b(R){let o=w(13),{channels:m,onAccept:h}=R,f;if(o[0]!==h)f=function a(D){z:switch(D){case"accept":{h();break z}case"exit":{Os(1)}}},o[0]=h,o[1]=f;else f=o[1];return"WARNING: Loading development channels"}';

    expect(writeSkipDevChannelsDialog(input)).toBe(
      input.replace(
        'function b(R){',
        'function b(R){/* tweakcc:skip-dev-channels-dialog */return queueMicrotask(R.onAccept),null;'
      )
    );
  });
});
