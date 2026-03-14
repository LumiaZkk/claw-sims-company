import { DatabaseSync } from "node:sqlite";

const AUTHORITY_SQLITE_BUSY_TIMEOUT_MS = 5_000;

export function isAuthoritySqliteLockErrorMessage(
  message: string | null | undefined,
): boolean {
  if (!message) {
    return false;
  }
  return /database (table )?is locked/i.test(message);
}

export function openAuthoritySqlite(
  dbPath: string,
  input?: {
    enableWal?: boolean;
  },
) {
  const db = new DatabaseSync(dbPath);
  if (input?.enableWal) {
    db.exec("PRAGMA journal_mode = WAL;");
  }
  db.exec(`PRAGMA busy_timeout = ${AUTHORITY_SQLITE_BUSY_TIMEOUT_MS};`);
  db.exec("PRAGMA foreign_keys = ON;");
  return db;
}
