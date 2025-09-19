# 🗄️ Database Configuration für SQL-Datenbanken
# Beispiel-Konfigurationen für MySQL, PostgreSQL, SQLite

import os
from sqlalchemy import create_engine, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

# ================================================
# DATENBANK-KONFIGURATIONEN
# ================================================

class DatabaseConfig:
    """Datenbank-Konfiguration für verschiedene SQL-Datenbanken"""
    
    # MySQL/MariaDB
    MYSQL_CONFIG = {
        "host": os.getenv("MYSQL_HOST", "localhost"),
        "port": os.getenv("MYSQL_PORT", "3306"),
        "database": os.getenv("MYSQL_DATABASE", "stadtwache_db"),
        "username": os.getenv("MYSQL_USER", "root"),
        "password": os.getenv("MYSQL_PASSWORD", "password"),
        "charset": "utf8mb4"
    }
    
    # PostgreSQL
    POSTGRES_CONFIG = {
        "host": os.getenv("POSTGRES_HOST", "localhost"),
        "port": os.getenv("POSTGRES_PORT", "5432"),
        "database": os.getenv("POSTGRES_DB", "stadtwache_db"),
        "username": os.getenv("POSTGRES_USER", "postgres"),
        "password": os.getenv("POSTGRES_PASSWORD", "password")
    }
    
    # SQLite (für lokale Entwicklung)
    SQLITE_CONFIG = {
        "database": os.getenv("SQLITE_DB", "/app/data/stadtwache.db")
    }

# ================================================
# CONNECTION STRINGS
# ================================================

def get_mysql_url():
    """MySQL Connection String"""
    config = DatabaseConfig.MYSQL_CONFIG
    return f"mysql+aiomysql://{config['username']}:{config['password']}@{config['host']}:{config['port']}/{config['database']}?charset={config['charset']}"

def get_postgres_url():
    """PostgreSQL Connection String"""
    config = DatabaseConfig.POSTGRES_CONFIG
    return f"postgresql+asyncpg://{config['username']}:{config['password']}@{config['host']}:{config['port']}/{config['database']}"

def get_sqlite_url():
    """SQLite Connection String"""
    config = DatabaseConfig.SQLITE_CONFIG
    return f"sqlite+aiosqlite:///{config['database']}"

# ================================================
# DATABASE CONNECTION FACTORY
# ================================================

def create_database_engine(db_type="mysql"):
    """Database Engine basierend auf Typ erstellen"""
    
    if db_type.lower() == "mysql":
        database_url = get_mysql_url()
        engine = create_async_engine(
            database_url,
            echo=True,  # SQL-Queries loggen
            pool_size=20,
            max_overflow=30,
            pool_pre_ping=True,
            pool_recycle=3600
        )
        print(f"🔗 MySQL Engine erstellt: {database_url.split('@')[1]}")
        
    elif db_type.lower() == "postgresql" or db_type.lower() == "postgres":
        database_url = get_postgres_url()
        engine = create_async_engine(
            database_url,
            echo=True,
            pool_size=20,
            max_overflow=30,
            pool_pre_ping=True,
            pool_recycle=3600
        )
        print(f"🔗 PostgreSQL Engine erstellt: {database_url.split('@')[1]}")
        
    elif db_type.lower() == "sqlite":
        database_url = get_sqlite_url()
        engine = create_async_engine(
            database_url,
            echo=True,
            connect_args={"check_same_thread": False}
        )
        print(f"🔗 SQLite Engine erstellt: {database_url}")
        
    else:
        raise ValueError(f"Unsupported database type: {db_type}")
    
    return engine

# ================================================
# SESSION FACTORY
# ================================================

def create_session_factory(engine):
    """Session Factory für Datenbank-Operationen"""
    return sessionmaker(
        engine, 
        class_=AsyncSession, 
        expire_on_commit=False
    )

# ================================================
# BEISPIEL-USAGE
# ================================================

async def test_database_connection(db_type="mysql"):
    """Test-Verbindung zur Datenbank"""
    try:
        engine = create_database_engine(db_type)
        
        async with engine.begin() as conn:
            result = await conn.execute(text("SELECT 1 as test"))
            row = result.fetchone()
            print(f"✅ {db_type.upper()} Verbindung erfolgreich: {row}")
            
        await engine.dispose()
        return True
        
    except Exception as e:
        print(f"❌ {db_type.upper()} Verbindung fehlgeschlagen: {e}")
        return False

# ================================================
# ENVIRONMENT VARIABLES BEISPIEL
# ================================================

"""
Erstellen Sie eine .env Datei mit Ihren Datenbank-Credentials:

# MySQL/MariaDB
MYSQL_HOST=ihr-mysql-server.com
MYSQL_PORT=3306
MYSQL_DATABASE=stadtwache_db
MYSQL_USER=stadtwache_user
MYSQL_PASSWORD=ihr-sicheres-passwort

# PostgreSQL
POSTGRES_HOST=ihr-postgres-server.com
POSTGRES_PORT=5432
POSTGRES_DB=stadtwache_db
POSTGRES_USER=stadtwache_user
POSTGRES_PASSWORD=ihr-sicheres-passwort

# SQLite (lokale Entwicklung)
SQLITE_DB=/pfad/zu/ihrer/stadtwache.db

# Datenbank-Typ auswählen
DATABASE_TYPE=mysql  # oder postgresql, sqlite
"""

# ================================================
# MIGRATION SCRIPT
# ================================================

async def run_database_migrations(db_type="mysql"):
    """Datenbank-Schema aus SQL-Datei ausführen"""
    try:
        engine = create_database_engine(db_type)
        
        # SQL-Schema-Datei laden
        with open('/app/STADTWACHE_DATABASE_SCHEMA.sql', 'r', encoding='utf-8') as f:
            schema_sql = f.read()
        
        # SQL in einzelne Statements aufteilen
        statements = [stmt.strip() for stmt in schema_sql.split(';') if stmt.strip()]
        
        async with engine.begin() as conn:
            for statement in statements:
                if statement and not statement.startswith('--'):
                    try:
                        await conn.execute(text(statement))
                        print(f"✅ SQL Statement ausgeführt: {statement[:50]}...")
                    except Exception as e:
                        print(f"⚠️ SQL Statement übersprungen: {e}")
        
        await engine.dispose()
        print("🎉 Datenbank-Migration abgeschlossen!")
        return True
        
    except Exception as e:
        print(f"❌ Migration fehlgeschlagen: {e}")
        return False

# ================================================
# MAIN EXECUTION
# ================================================

if __name__ == "__main__":
    import asyncio
    
    async def main():
        # Test verschiedene Datenbank-Typen
        db_types = ["mysql", "postgresql", "sqlite"]
        
        for db_type in db_types:
            print(f"\n=== Testing {db_type.upper()} ===")
            await test_database_connection(db_type)
    
    asyncio.run(main())