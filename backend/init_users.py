#!/usr/bin/env python3
"""
Stadtwache User Initialization Script
Erstellt Standard-Benutzer für die Stadtwache App
"""

import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from datetime import datetime
import uuid

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Database connection
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "stadtwache_db")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

def hash_password(password: str) -> str:
    """Hash password using bcrypt"""
    return pwd_context.hash(password)

async def create_standard_users():
    """Erstelle Standard-Benutzer für die Stadtwache"""
    
    users_to_create = [
        {
            "id": str(uuid.uuid4()),
            "email": "admin@stadtwache.de",
            "username": "Administrator",
            "role": "admin",
            "badge_number": "ADMIN-001",
            "department": "Leitung",
            "phone": "+49 2336 xxx",
            "service_number": "001",
            "rank": "Wachleiter",
            "status": "Im Dienst",
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "hashed_password": hash_password("admin2024")
        },
        {
            "id": str(uuid.uuid4()),
            "email": "beamter@stadtwache.de",
            "username": "Beamter Müller",
            "role": "police",
            "badge_number": "SW-001",
            "department": "Streifendienst",
            "phone": "+49 2336 xxx",
            "service_number": "101",
            "rank": "Hauptwachtmeister",
            "status": "Im Dienst",
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "hashed_password": hash_password("stadtwache2024")
        },
        {
            "id": str(uuid.uuid4()),
            "email": "wache@stadtwache.de",
            "username": "Beamter Schmidt",
            "role": "police",
            "badge_number": "SW-002",
            "department": "Streifendienst",
            "phone": "+49 2336 xxx",
            "service_number": "102",
            "rank": "Polizeiobermeister",
            "status": "Im Dienst",
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "hashed_password": hash_password("stadtwache2024")
        },
        {
            "id": str(uuid.uuid4()),
            "email": "dienst@stadtwache.de",
            "username": "Beamtin Weber",
            "role": "police",
            "badge_number": "SW-003",
            "department": "Streifendienst",
            "phone": "+49 2336 xxx",
            "service_number": "103",
            "rank": "Polizeihauptmeisterin",
            "status": "Im Dienst",
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "hashed_password": hash_password("stadtwache2024")
        }
    ]
    
    # Prüfe ob Benutzer bereits existieren
    existing_users = await db.users.count_documents({})
    
    if existing_users > 0:
        print(f"⚠️  {existing_users} Benutzer bereits vorhanden - überspringe Initialisierung")
        return
    
    # Erstelle Standard-Benutzer
    print("🏗️  Erstelle Standard-Benutzer für Stadtwache Schwelm...")
    
    for user in users_to_create:
        await db.users.insert_one(user)
        print(f"✅ Benutzer erstellt: {user['username']} ({user['email']})")
    
    print(f"\n🎉 Erfolgreich {len(users_to_create)} Benutzer erstellt!")
    print("\n📋 Anmeldedaten:")
    print("┌─────────────────────────┬─────────────────┬──────────────────┐")
    print("│ Benutzer                │ E-Mail          │ Passwort         │")
    print("├─────────────────────────┼─────────────────┼──────────────────┤")
    print("│ Administrator           │ admin@...       │ admin2024        │")
    print("│ Standard-Beamte         │ beamter@...     │ stadtwache2024   │")
    print("│                         │ wache@...       │ stadtwache2024   │")
    print("│                         │ dienst@...      │ stadtwache2024   │")
    print("└─────────────────────────┴─────────────────┴──────────────────┘")
    print("\n🔒 Server: 212.227.57.238:8001")

async def create_sample_incidents():
    """Erstelle Beispiel-Vorfälle"""
    
    sample_incidents = [
        {
            "id": str(uuid.uuid4()),
            "title": "Ruhestörung in der Hauptstraße",
            "description": "Laute Musik bis spät in die Nacht",
            "priority": "low",
            "status": "open",
            "location": {"lat": 51.2879, "lng": 7.2954},
            "address": "Hauptstraße 45, 58332 Schwelm",
            "reported_by": "system",
            "assigned_to": None,
            "assigned_to_name": None,
            "images": [],
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Parkverstoß am Marktplatz",
            "description": "Fahrzeug blockiert Feuerwehrzufahrt",
            "priority": "medium",
            "status": "open",
            "location": {"lat": 51.2885, "lng": 7.2960},
            "address": "Marktplatz 1, 58332 Schwelm",
            "reported_by": "system",
            "assigned_to": None,
            "assigned_to_name": None,
            "images": [],
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
    ]
    
    # Prüfe ob Vorfälle bereits existieren
    existing_incidents = await db.incidents.count_documents({})
    
    if existing_incidents > 0:
        print(f"📋 {existing_incidents} Vorfälle bereits vorhanden")
        return
    
    print("📝 Erstelle Beispiel-Vorfälle...")
    
    for incident in sample_incidents:
        await db.incidents.insert_one(incident)
        print(f"✅ Vorfall erstellt: {incident['title']}")

async def main():
    """Hauptfunktion"""
    try:
        print("🚀 Stadtwache Schwelm - Initialisierung")
        print("=" * 50)
        
        # Teste Datenbankverbindung
        await client.admin.command('ping')
        print("✅ MongoDB-Verbindung erfolgreich")
        
        # Erstelle Benutzer
        await create_standard_users()
        
        # Erstelle Beispiel-Vorfälle
        await create_sample_incidents()
        
        print("\n🏁 Initialisierung abgeschlossen!")
        print("🌐 Die App kann jetzt mit EAS Build kompiliert werden")
        
    except Exception as e:
        print(f"❌ Fehler bei Initialisierung: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(main())