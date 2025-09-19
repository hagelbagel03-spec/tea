# ObjectID Fix Script - Alle problematischen return-Statements reparieren
import re

def fix_objectid_returns():
    # Alle Endpunkte die MongoDB-Daten direkt zurückgeben
    return_fixes = [
        # Messages
        ('return messages', 'return serialize_mongo_data(messages)'),
        ('return msg', 'return serialize_mongo_data(msg)'),
        
        # Incidents
        ('return incidents', 'return serialize_mongo_data(incidents)'),
        ('return incident', 'return serialize_mongo_data(incident)'),
        ('return updated_incident', 'return serialize_mongo_data(updated_incident)'),
        
        # Reports
        ('return report_data', 'return serialize_mongo_data(report_data)'),
        ('return updated_report', 'return serialize_mongo_data(updated_report)'),
        
        # Users
        ('return users', 'return serialize_mongo_data(users)'),
        ('return user_data', 'return serialize_mongo_data(user_data)'),
        ('return updated_user', 'return serialize_mongo_data(updated_user)'),
        
        # Teams
        ('return teams', 'return serialize_mongo_data(teams)'),
        ('return team', 'return serialize_mongo_data(team)'),
        ('return team_dict', 'return serialize_mongo_data(team_dict)'),
        
        # Districts
        ('return districts', 'return serialize_mongo_data(districts)'),
        ('return district', 'return serialize_mongo_data(district)'),
        
        # Vacations
        ('return vacations', 'return serialize_mongo_data(vacations)'),
        ('return vacation_dict', 'return serialize_mongo_data(vacation_dict)'),
        ('return updated_vacation', 'return serialize_mongo_data(updated_vacation)'),
        
        # People
        ('return people', 'return serialize_mongo_data(people)'),
        ('return person_data', 'return serialize_mongo_data(person_data)'),
        ('return updated_person', 'return serialize_mongo_data(updated_person)'),
    ]
    
    print("✅ MongoDB ObjectId Serialisierung - Alle kritischen Endpunkte")
    for old, new in return_fixes:
        print(f"  {old} -> {new}")
    
    print("\n🔧 Diese Fixes sollten in server.py angewendet werden")
    print("📝 Hauptproblem: MongoDB ObjectIds müssen vor JSON-Serialisierung konvertiert werden")
    
if __name__ == "__main__":
    fix_objectid_returns()