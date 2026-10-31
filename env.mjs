import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));

export async function readProjectEnv() {
  const values = {};
  try {
    const source = await readFile(resolve(projectRoot, '.env.local'), 'utf8');
    for (const line of source.split(/\r?\n/)) {
      const match = line.match(/^\s*(SUPABASE_URL|SUPABASE_PUBLISHABLE_KEY|SUPABASE_ANON_KEY)\s*=\s*(.*?)\s*$/);
      if (!match || match[2].startsWith('#')) continue;
      values[match[1]] = match[2].replace(/^(["'])(.*)\1$/, '$2');
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  return values;
}
