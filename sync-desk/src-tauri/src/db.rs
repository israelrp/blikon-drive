use rusqlite::{Connection, Result, params};
use crate::models::{AppConfig, SyncEntry, SyncFolder};

pub fn open(data_dir: &std::path::Path) -> Result<Connection> {
    let path = data_dir.join("blikon-sync.db");
    let conn = Connection::open(path)?;
    conn.execute_batch("
        PRAGMA journal_mode=WAL;

        CREATE TABLE IF NOT EXISTS config (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sync_entries (
            id             TEXT PRIMARY KEY,
            sync_folder_id TEXT NOT NULL,
            file_name      TEXT NOT NULL,
            local_path     TEXT NOT NULL,
            file_id        TEXT,
            size_bytes     INTEGER NOT NULL DEFAULT 0,
            status         TEXT NOT NULL DEFAULT 'pending',
            progress       INTEGER NOT NULL DEFAULT 0,
            error          TEXT,
            updated_at     TEXT NOT NULL
        );
    ")?;
    Ok(conn)
}

pub fn save_config(conn: &Connection, config: &AppConfig) -> Result<()> {
    let json = serde_json::to_string(config).unwrap();
    conn.execute(
        "INSERT OR REPLACE INTO config (key, value) VALUES ('app_config', ?1)",
        params![json],
    )?;
    Ok(())
}

pub fn load_config(conn: &Connection) -> Option<AppConfig> {
    conn.query_row(
        "SELECT value FROM config WHERE key = 'app_config'",
        [],
        |row| row.get::<_, String>(0),
    )
    .ok()
    .and_then(|s| serde_json::from_str(&s).ok())
}

pub fn upsert_entry(conn: &Connection, entry: &SyncEntry) -> Result<()> {
    conn.execute(
        "INSERT OR REPLACE INTO sync_entries
         (id, sync_folder_id, file_name, local_path, file_id, size_bytes, status, progress, error, updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
        params![
            entry.id, entry.sync_folder_id, entry.file_name, entry.local_path,
            entry.file_id, entry.size_bytes, entry.status, entry.progress,
            entry.error, entry.updated_at,
        ],
    )?;
    Ok(())
}

pub fn load_entries(conn: &Connection) -> Result<Vec<SyncEntry>> {
    let mut stmt = conn.prepare(
        "SELECT id, sync_folder_id, file_name, local_path, file_id, size_bytes,
                status, progress, error, updated_at
         FROM sync_entries ORDER BY updated_at DESC LIMIT 200"
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(SyncEntry {
            id:             row.get(0)?,
            sync_folder_id: row.get(1)?,
            file_name:      row.get(2)?,
            local_path:     row.get(3)?,
            file_id:        row.get(4)?,
            size_bytes:     row.get(5)?,
            status:         row.get(6)?,
            progress:       row.get(7)?,
            error:          row.get(8)?,
            updated_at:     row.get(9)?,
        })
    })?;
    rows.collect()
}

pub fn clear_entries(conn: &Connection) -> Result<usize> {
    conn.execute("DELETE FROM sync_entries", [])
}

pub fn entry_exists_synced(conn: &Connection, local_path: &str) -> bool {
    conn.query_row(
        "SELECT 1 FROM sync_entries WHERE local_path = ?1 AND status = 'synced'",
        params![local_path],
        |_| Ok(true),
    ).unwrap_or(false)
}
