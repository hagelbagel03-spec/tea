#!/usr/bin/env python3
"""
Stadtwache - Datenbank Initialisierung
Erstellt alle notwendigen Collections und Standard-Benutzer
"""

import asyncio
import motor.motor_asyncio
from passlib.context import CryptContext
from datetime import datetime
import os
from dotenv import load_dotenv

# Lade Umgebungsvariablen
load_dotenv()

# MongoDB Verbindung
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DATABASE_NAME = "stadtwache"

# Password Hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def init_database():
    """Initialisiert die komplette Datenbank"""
    
    print("🏛️ Stadtwache - Datenbank Initialisierung")
    print("=" * 50)
    
    # MongoDB Verbindung
    client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URL)
    db = client[DATABASE_NAME]
    
    try:
        # Test der Verbindung
        await client.admin.command('ping')
        print("✅ MongoDB Verbindung erfolgreich")
        
        # Collections erstellen
        collections = [
            "users",
            "incidents", 
            "messages",
            "reports",
            "teams",
            "notifications",
            "audit_logs"
        ]
        
        print("\n📁 Erstelle Collections...")
        for collection_name in collections:
            await db.create_collection(collection_name)
            print(f"✅ Collection '{collection_name}' erstellt")
        
        # Standard-Benutzer erstellen
        print("\n👥 Erstelle Standard-Benutzer...")
        
        users_collection = db.users
        
        # Admin-Benutzer
        admin_user = {
            "email": "admin@stadtwache.de",
            "username": "Administrator",
            "password_hash": pwd_context.hash("admin123"),
            "role": "admin",
            "department": "Leitung",
            "badge_number": "ADM001",
            "is_active": True,
            "created_at": datetime.utcnow(),
            "last_login": None,
            "permissions": [
                "all",
                "user_management", 
                "incident_management",
                "report_access",
                "admin_panel",
                "system_settings"
            ]
        }
        
        # Wächter-Benutzer
        waechter_user = {
            "email": "waechter@stadtwache.de", 
            "username": "Wächter Demo",
            "password_hash": pwd_context.hash("waechter123"),
            "role": "wächter",
            "department": "Streifendienst",
            "badge_number": "SW001",
            "is_active": True,
            "created_at": datetime.utcnow(),
            "last_login": None,
            "permissions": [
                "incident_read",
                "incident_create", 
                "chat_access",
                "team_view",
                "report_create"
            ]
        }
        
        # Benutzer einfügen
        await users_collection.insert_one(admin_user)
        print("✅ Admin-Benutzer erstellt: admin@stadtwache.de")
        
        await users_collection.insert_one(waechter_user)
        print("✅ Wächter-Benutzer erstellt: waechter@stadtwache.de")
        
        # Demo-Vorfälle erstellen
        print("\n📋 Erstelle Demo-Vorfälle...")
        incidents_collection = db.incidents
        
        demo_incidents = [
            {
                "title": "Lärmbelästigung Marktplatz",
                "description": "Mehrere Beschwerden über laute Musik am Marktplatz",
                "location": "Marktplatz Schwelm",
                "priority": "medium",
                "status": "open",
                "assigned_to": "waechter@stadtwache.de",
                "created_by": "admin@stadtwache.de",
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
                "coordinates": {"lat": 51.2889, "lng": 7.2994}
            },
            {
                "title": "Verdächtige Person Bahnhof",
                "description": "Person mit auffälligem Verhalten am Hauptbahnhof gemeldet",
                "location": "Hauptbahnhof Schwelm",
                "priority": "high",
                "status": "in_progress", 
                "assigned_to": "waechter@stadtwache.de",
                "created_by": "admin@stadtwache.de",
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
                "coordinates": {"lat": 51.2865, "lng": 7.2981}
            },
            {
                "title": "Falsch geparktes Fahrzeug",
                "description": "Fahrzeug blockiert Feuerwehrzufahrt in der Hauptstraße",
                "location": "Hauptstraße 45",
                "priority": "low",
                "status": "resolved",
                "assigned_to": "waechter@stadtwache.de", 
                "created_by": "waechter@stadtwache.de",
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
                "coordinates": {"lat": 51.2901, "lng": 7.2976}
            }
        ]
        
        await incidents_collection.insert_many(demo_incidents)
        print(f"✅ {len(demo_incidents)} Demo-Vorfälle erstellt")
        
        # Demo-Nachrichten erstellen
        print("\n💬 Erstelle Demo-Nachrichten...")
        messages_collection = db.messages
        
        demo_messages = [
            {
                "sender": "admin@stadtwache.de",
                "sender_name": "Administrator",
                "message": "Willkommen im Stadtwache Chat-System!",
                "channel": "general",
                "timestamp": datetime.utcnow(),
                "message_type": "text"
            },
            {
                "sender": "waechter@stadtwache.de",
                "sender_name": "Wächter Demo", 
                "message": "Schicht begonnen - alles ruhig im Revier",
                "channel": "general", 
                "timestamp": datetime.utcnow(),
                "message_type": "text"
            },
            {
                "sender": "admin@stadtwache.de",
                "sender_name": "Administrator",
                "message": "Neuer Vorfall am Marktplatz - bitte prüfen",
                "channel": "incidents",
                "timestamp": datetime.utcnow(), 
                "message_type": "alert"
            }
        ]
        
        await messages_collection.insert_many(demo_messages)
        print(f"✅ {len(demo_messages)} Demo-Nachrichten erstellt")
        
        # Team-Daten erstellen
        print("\n👥 Erstelle Team-Daten...")
        teams_collection = db.teams
        
        team_data = [
            {
                "user_email": "admin@stadtwache.de",
                "status": "online",
                "location": "Hauptwache",
                "last_seen": datetime.utcnow(),
                "current_shift": "Tagschicht",
                "availability": "available"
            },
            {
                "user_email": "waechter@stadtwache.de", 
                "status": "on_patrol",
                "location": "Marktplatz Schwelm",
                "last_seen": datetime.utcnow(),
                "current_shift": "Tagschicht", 
                "availability": "busy"
            }
        ]
        
        await teams_collection.insert_many(team_data)
        print(f"✅ {len(team_data)} Team-Einträge erstellt")
        
        # Indizes erstellen für bessere Performance
        print("\n🔍 Erstelle Datenbank-Indizes...")
        
        # Benutzer-Indizes
        await users_collection.create_index("email", unique=True)
        await users_collection.create_index("badge_number", unique=True)
        
        # Vorfälle-Indizes
        await incidents_collection.create_index("status")
        await incidents_collection.create_index("priority")
        await incidents_collection.create_index("created_at")
        
        # Nachrichten-Indizes
        await messages_collection.create_index("channel")
        await messages_collection.create_index("timestamp")
        
        # Team-Indizes
        await teams_collection.create_index("user_email", unique=True)
        
        print("✅ Alle Indizes erstellt")
        
        print("\n" + "=" * 50)
        print("🎉 DATENBANK ERFOLGREICH INITIALISIERT!")
        print("=" * 50)
        print("\n📊 ZUSAMMENFASSUNG:")
        print(f"- Datenbank: {DATABASE_NAME}")
        print(f"- Collections: {len(collections)}")
        print("- Benutzer: 2 (Admin + Wächter)")
        print("- Demo-Vorfälle: 3") 
        print("- Demo-Nachrichten: 3")
        print("- Team-Einträge: 2")
        print("\n🔐 LOGIN-DATEN:")
        print("👨‍💼 Admin: admin@stadtwache.de / admin123")
        print("👮‍♂️ Wächter: waechter@stadtwache.de / waechter123")
        print("\n🚀 Backend ist bereit für Anmeldungen!")
        
    except Exception as e:
        print(f"❌ Fehler bei der Datenbank-Initialisierung: {e}")
        return False
    
    finally:
        client.close()
    
    return True

if __name__ == "__main__":
    print("Starte Datenbank-Initialisierung...")
    result = asyncio.run(init_database())
    
    if result:
        print("\n✅ Initialisierung abgeschlossen!")
    else:
        print("\n❌ Initialisierung fehlgeschlagen!")
        exit(1)