import type { Env } from '../env';

export interface UpdateInfo {
  current: string;
  latest: string | null;
  available: boolean;
  url: string | null;
  notes: string | null;
  publishedAt: string | null;
  checkedAt: number;
}

export function isNewer(latest: string, current: string): boolean {
  const parse = (v: string) => v.replace(/^v/, '').split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  const a = parse(latest);
  const b = parse(current);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  }
  return false;
}

// External update checks are disabled.
export async function checkForUpdate(_env?: Env, _fresh = false): Promise<UpdateInfo> {
  return {
    current: __APP_VERSION__,
    latest: null,
    available: false,
    url: null,
    notes: null,
    publishedAt: null,
    checkedAt: Date.now(),
  };
}
