import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, existsSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';

export function createStore(dir) {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const keyPath = join(dir, 'encryption.key');
  if (!existsSync(keyPath)) writeFileSync(keyPath, randomBytes(32), { mode: 0o600, flag: 'wx' });
  const key = readFileSync(keyPath);
  const file = join(dir, 'wordloom.sqlite');
  const db = new DatabaseSync(file);
  chmodSync(file, 0o600);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, password TEXT NOT NULL, created TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS settings (user_id TEXT PRIMARY KEY REFERENCES users(id), value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS connections (user_id TEXT PRIMARY KEY REFERENCES users(id), secret TEXT NOT NULL, updated TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS models (id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), value TEXT NOT NULL, secret TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS snapshots (user_id TEXT REFERENCES users(id), date TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY(user_id,date));
    CREATE TABLE IF NOT EXISTS articles (id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), created TEXT NOT NULL, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS books (id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), name TEXT NOT NULL, created TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS entries (id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), book_id TEXT REFERENCES books(id) ON DELETE CASCADE, word TEXT NOT NULL, value TEXT NOT NULL, UNIQUE(book_id,word));
    CREATE TABLE IF NOT EXISTS attempts (id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), article_id TEXT REFERENCES articles(id), created TEXT NOT NULL, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS generations (user_id TEXT REFERENCES users(id), request_id TEXT, fingerprint TEXT NOT NULL, article_id TEXT REFERENCES articles(id), PRIMARY KEY(user_id,request_id));
    CREATE TABLE IF NOT EXISTS annotations (id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), article_id TEXT REFERENCES articles(id), paragraph INTEGER, start INTEGER, end INTEGER, foreground TEXT, background TEXT, created TEXT);
    CREATE TABLE IF NOT EXISTS cache (user_id TEXT REFERENCES users(id), cache_key TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY(user_id,cache_key));
  `);
  return {
    db,
    seal(value) { const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', key, iv); const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]); return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64'); },
    open(value) { const b = Buffer.from(value, 'base64'); const decipher = createDecipheriv('aes-256-gcm', key, b.subarray(0,12)); decipher.setAuthTag(b.subarray(12,28)); return Buffer.concat([decipher.update(b.subarray(28)), decipher.final()]).toString('utf8'); },
  };
}
