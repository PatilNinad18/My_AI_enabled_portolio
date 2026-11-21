import 'server-only';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export type Window = { limit: number; ms: number };
export type Admission = { retryMs: number; cooling?: boolean };
export interface AssistantStore {
  take(key: string, windows: readonly Window[], now: number, cooldownKey?: string): Promise<Admission>;
  get(key: string, now: number): Promise<string | undefined>;
  set(key: string, value: string, expires: number, now: number): Promise<void>;
  defer(key: string, until: number, now: number): Promise<void>;
}

export class SqliteAssistantStore implements AssistantStore {
  private readonly db: DatabaseSync;

  constructor(file: string) {
    if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec(`
      PRAGMA busy_timeout = 1500;
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS admission (key TEXT NOT NULL, time INTEGER NOT NULL, expires INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS admission_key_time ON admission (key, time);
      CREATE INDEX IF NOT EXISTS admission_expires ON admission (expires);
      CREATE TABLE IF NOT EXISTS records (key TEXT PRIMARY KEY, value TEXT NOT NULL, expires INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS records_expires ON records (expires);
    `);
  }

  async take(key: string, windows: readonly Window[], now: number, cooldownKey?: string) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare('DELETE FROM admission WHERE expires <= ?').run(now);
      this.db.prepare('DELETE FROM records WHERE expires <= ?').run(now);
      const cooling = cooldownKey && this.db.prepare('SELECT expires FROM records WHERE key = ?').get(cooldownKey);
      let retryMs = cooling ? Number(cooling.expires) - now : 0;
      if (!retryMs) {
        const restricted = this.db.prepare('SELECT COUNT(*) AS count, MIN(time) AS first FROM admission WHERE key = ? AND time > ?');
        for (const { limit, ms } of windows) {
          const row = restricted.get(key, now - ms)!;
          if (Number(row.count) >= limit) retryMs = Math.max(retryMs, Number(row.first) + ms - now);
        }
        if (!retryMs) {
          this.db.prepare('INSERT INTO admission VALUES (?, ?, ?)').run(key, now, now + Math.max(...windows.map(({ ms }) => ms)));
        }
      }
      this.db.exec('COMMIT');
      return { retryMs, cooling: Boolean(cooling) };
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  async get(key: string, now: number) {
    return this.db.prepare('SELECT value FROM records WHERE key = ? AND expires > ?').get(key, now)?.value as string | undefined;
  }

  async set(key: string, value: string, expires: number) {
    this.db.prepare('INSERT OR REPLACE INTO records VALUES (?, ?, ?)').run(key, value, expires);
  }

  async defer(key: string, until: number) {
    this.db.prepare(`
      INSERT INTO records VALUES (?, 'cooldown', ?)
      ON CONFLICT(key) DO UPDATE SET expires = MAX(records.expires, excluded.expires)
    `).run(key, until);
  }

  close() { this.db.close(); }
}

// A single atomic operation checks every rolling window and inserts the new admission.
const admit = `
local now, longest = tonumber(ARGV[1]), tonumber(ARGV[3])
if KEYS[2] then
  local ttl = redis.call('PTTL', KEYS[2])
  if ttl > 0 then return {ttl, 1} end
end
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now - longest)
local retry = 0
for i = 4, #ARGV, 2 do
  local limit, window = tonumber(ARGV[i]), tonumber(ARGV[i + 1])
  local lower = '(' .. (now - window)
  if redis.call('ZCOUNT', KEYS[1], lower, '+inf') >= limit then
    local first = redis.call('ZRANGEBYSCORE', KEYS[1], lower, '+inf', 'WITHSCORES', 'LIMIT', 0, 1)
    retry = math.max(retry, tonumber(first[2]) + window - now)
  end
end
if retry > 0 then return {retry, 0} end
redis.call('ZADD', KEYS[1], now, ARGV[2])
redis.call('PEXPIRE', KEYS[1], longest)
return {0, 0}
`;

export class RedisAssistantStore implements AssistantStore {
  constructor(private readonly url: string, private readonly token: string) {}

  private async command(args: (string | number)[]): Promise<unknown> {
    const response = await fetch(this.url, {
      method: 'POST', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(2500),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` },
      body: JSON.stringify(args),
    });
    if (!response.ok) throw new Error('Assistant storage request failed');
    const body = await response.json();
    if ('error' in body || !('result' in body)) throw new Error('Assistant storage returned an invalid result');
    return body.result;
  }

  async take(key: string, windows: readonly Window[], now: number, cooldownKey?: string) {
    const keys = cooldownKey ? [key, cooldownKey] : [key];
    const result = await this.command(['EVAL', admit, keys.length, ...keys, now, randomUUID(),
      Math.max(...windows.map(({ ms }) => ms)), ...windows.flatMap(({ limit, ms }) => [limit, ms])]);
    if (!Array.isArray(result) || typeof result[0] !== 'number' || ![0, 1].includes(result[1])) {
      throw new Error('Assistant storage returned an invalid admission');
    }
    return { retryMs: result[0], cooling: result[1] === 1 };
  }

  async get(key: string) {
    const result = await this.command(['GET', key]);
    return typeof result === 'string' ? result : undefined;
  }

  async set(key: string, value: string, expires: number, now: number) {
    await this.command(['SET', key, value, 'PX', Math.max(1, expires - now)]);
  }

  async defer(key: string, until: number, now: number) {
    await this.command(['EVAL', "local ms = tonumber(ARGV[1]); if redis.call('PTTL', KEYS[1]) < ms then redis.call('PSETEX', KEYS[1], ms, 'cooldown') end; return 1", 1, key, Math.max(1, until - now)]);
  }
}

export const storageKey = (key: string) => `{ninad-ai}:${key}`;
let store: AssistantStore | undefined;

export function getAssistantStore(loopback: boolean): AssistantStore {
  if (store) return store;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const file = process.env.NINAD_AI_SQLITE_PATH;
  if (url || token) {
    if (!url || !token) throw new Error('Incomplete shared storage configuration');
    const endpoint = new URL(url);
    if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
      throw new Error('Invalid shared storage URL');
    }
    return store = new RedisAssistantStore(endpoint.href, token);
  }
  if (process.env.VERCEL || process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME || (!file && !loopback)) {
    throw new Error('Persistent assistant storage is required');
  }
  return store = new SqliteAssistantStore(resolve(file || 'data/runtime/assistant.sqlite'));
}
