#!/usr/bin/env python3
"""
migrate_v2.py — Add Phase 2 columns to the signals table.
Run once on the server: python3 scripts/migrate_v2.py
Safe to re-run (uses IF NOT EXISTS logic).
"""
import sqlite3
import os

DB_PATH = os.getenv("DATABASE_URL", "sqlite:///signals.db").replace("sqlite:///", "")

COLUMNS = [
    ("highest_tp_hit",     "TEXT"),
    ("adjusted_sl",        "REAL"),
    ("partial_profit_pct", "REAL"),
]

def migrate():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Get existing columns
    cursor.execute("PRAGMA table_info(signals)")
    existing = {row[1] for row in cursor.fetchall()}

    added = 0
    for col_name, col_type in COLUMNS:
        if col_name not in existing:
            cursor.execute(f"ALTER TABLE signals ADD COLUMN {col_name} {col_type}")
            print(f"  ✅ Added column: {col_name} ({col_type})")
            added += 1
        else:
            print(f"  ⏭  Column exists: {col_name}")

    conn.commit()
    conn.close()

    if added:
        print(f"\n✅ Migration complete — {added} column(s) added.")
    else:
        print("\n✅ All columns already exist. No changes needed.")


if __name__ == "__main__":
    print(f"Migrating database: {DB_PATH}")
    migrate()
