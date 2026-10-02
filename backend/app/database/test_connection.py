from app.database.database import engine

try:
    conn = engine.connect()
    print("SUCCESS: Connected to Vibemap database")
    conn.close()

except Exception as e:
    print("FAILED")
    print(e)