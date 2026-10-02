import sqlite3
import sys

DB_PATH = 'vibemap.db'

try:
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("PRAGMA table_info(users)")
    cols = [r[1] for r in c.fetchall()]
    if 'sos_pin_hash' in cols:
        print('Column sos_pin_hash already exists')
        sys.exit(0)
    c.execute("ALTER TABLE users ADD COLUMN sos_pin_hash TEXT")
    conn.commit()
    print('Added column sos_pin_hash')
except Exception as e:
    print('ERROR:', e)
    sys.exit(1)
finally:
    try:
        conn.close()
    except:
        pass
