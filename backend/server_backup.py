from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
# from bson import ObjectId
import socketio
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
import hashlib
import secrets

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Database connection - Use environment variable or fallback
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017/stadtwache_db")
DB_NAME = os.getenv("DB_NAME", "stadtwache_db")

# Handle both local and cloud MongoDB URLs
if MONGO_URL.startswith("mongodb://localhost") or MONGO_URL.startswith("mongodb://127.0.0.1"):
    # Local development
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    print(f"🔗 Connected to local MongoDB: {MONGO_URL}")
else:
    # Production/Cloud MongoDB
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]  
    print(f"🔗 Connected to cloud MongoDB: {MONGO_URL[:20]}...")

# Test connection
async def test_db_connection():
    try:
        await client.admin.command('ping')
        print("✅ MongoDB connection successful!")
    except Exception as e:
        print(f"❌ MongoDB connection failed: {e}")

# Security
SECRET_KEY = os.environ.get("SECRET_KEY", "your-secret-key-here-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 Tage

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Socket.IO server
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')

# Online users tracking
online_users = {}  # {user_id: {"last_seen": datetime, "socket_id": str, "username": str}}
user_sockets = {}  # {socket_id: user_id}

# Create FastAPI app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Wrap FastAPI app with Socket.IO
socket_app = socketio.ASGIApp(sio, app)

# User roles
class UserRole:
    ADMIN = "admin"          # Eigentümer
    POLICE = "police"        # Stadtwache
    COMMUNITY = "community"  # Member
    TRAINEE = "trainee"      # Praktikant

# Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    username: str
    role: str
    badge_number: Optional[str] = None
    department: Optional[str] = None
    phone: Optional[str] = None
    service_number: Optional[str] = None
    rank: Optional[str] = None
    status: str = "Im Dienst"  # Im Dienst, Pause, Einsatz, Streife, Nicht verfügbar
    photo: Optional[str] = None  # base64 encoded profile photo
    is_active: bool = True
    # Neue Profil-Einstellungen
    notification_sound: str = "default"  # default, siren, beep, chime
    vibration_pattern: str = "standard"  # standard, intense, pulse, custom
    battery_saver_mode: bool = False
    check_in_interval: int = 30  # Minuten
    assigned_district: Optional[str] = None
    patrol_team: Optional[str] = None
    last_check_in: Optional[datetime] = None
    missed_check_ins: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class UserCreate(BaseModel):
    email: EmailStr
    username: str
    password: str
    role: Optional[str] = UserRole.POLICE  # Default role
    badge_number: Optional[str] = None
    department: Optional[str] = None
    phone: Optional[str] = None
    service_number: Optional[str] = None
    rank: Optional[str] = None
    photo: Optional[str] = None

class UserUpdate(BaseModel):
    username: Optional[str] = None
    phone: Optional[str] = None
    service_number: Optional[str] = None
    rank: Optional[str] = None
    department: Optional[str] = None
    status: Optional[str] = None
    photo: Optional[str] = None
    # Neue Profil-Einstellungen
    notification_sound: Optional[str] = None
    vibration_pattern: Optional[str] = None
    battery_saver_mode: Optional[bool] = None
    check_in_interval: Optional[int] = None
    assigned_district: Optional[str] = None
    patrol_team: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: User

class Incident(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    priority: str  # high, medium, low
    status: str = "open"  # open, in_progress, closed
    location: Dict[str, float]  # lat, lng
    address: str
    reported_by: str  # user_id
    assigned_to: Optional[str] = None
    assigned_to_name: Optional[str] = None
    assigned_at: Optional[datetime] = None
    images: List[str] = []  # base64 encoded images
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class IncidentCreate(BaseModel):
    title: str
    description: str
    priority: str
    location: Dict[str, float]
    address: str
    images: List[str] = []

class Message(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    content: str
    sender_id: str
    sender_name: str  # Add sender name field
    recipient_id: Optional[str] = None  # None for group messages
    channel: str = "general"  # general, emergency, incidents
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    message_type: str = "text"  # text, location, image

class MessageCreate(BaseModel):
    content: str
    recipient_id: Optional[str] = None
    channel: str = "general"
    message_type: str = "text"

class LocationUpdate(BaseModel):
    user_id: str
    location: Dict[str, float]
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class Person(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    first_name: str
    last_name: str
    address: Optional[str] = None
    age: Optional[int] = None
    birth_date: Optional[str] = None  # Format: YYYY-MM-DD
    status: str  # "gesucht", "vermisst", "gefunden", "erledigt", "archiviert"
    description: Optional[str] = None
    last_seen_location: Optional[str] = None
    last_seen_date: Optional[str] = None
    contact_info: Optional[str] = None
    case_number: Optional[str] = None
    priority: str = "medium"  # "low", "medium", "high"
    photo: Optional[str] = None  # base64 encoded image
    created_by: str  # user_id
    created_by_name: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = True

class PersonCreate(BaseModel):
    first_name: str
    last_name: str
    address: Optional[str] = None
    age: Optional[int] = None
    birth_date: Optional[str] = None
    status: str = "vermisst"
    description: Optional[str] = None
    last_seen_location: Optional[str] = None
    last_seen_date: Optional[str] = None
    contact_info: Optional[str] = None
    case_number: Optional[str] = None
    priority: str = "medium"
    photo: Optional[str] = None

class PersonUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    address: Optional[str] = None
    age: Optional[int] = None
    birth_date: Optional[str] = None
    status: Optional[str] = None
    description: Optional[str] = None
    last_seen_location: Optional[str] = None
    last_seen_date: Optional[str] = None
    contact_info: Optional[str] = None
    case_number: Optional[str] = None
    priority: Optional[str] = None
    photo: Optional[str] = None

class AppConfiguration(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    app_name: str = "Stadtwache"
    app_subtitle: str = "Polizei Management System"
    app_icon: Optional[str] = None  # base64 encoded icon
    organization_name: str = "Sicherheitsbehörde Schwelm"
    primary_color: str = "#1E40AF"
    secondary_color: str = "#3B82F6"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class AppConfigurationUpdate(BaseModel):
    app_name: Optional[str] = None
    app_subtitle: Optional[str] = None
    app_icon: Optional[str] = None
    organization_name: Optional[str] = None
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None

# Admin-spezifische Models
class District(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    area_description: str
    coordinates: Optional[Dict[str, float]] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Team(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    district_id: Optional[str] = None
    members: List[str] = []  # user IDs
    leader_id: Optional[str] = None
    status: str = "Einsatzbereit"  # Einsatzbereit, Im Einsatz, Pause
    created_at: datetime = Field(default_factory=datetime.utcnow)

class VacationApproval(BaseModel):
    action: str  # "approve" or "reject"
    reason: Optional[str] = None

class DistrictCreate(BaseModel):
    name: str
    area_description: str

class TeamCreate(BaseModel):
    name: str
    district_id: Optional[str] = None

class TeamAssignment(BaseModel):
    user_id: str
    team_id: Optional[str] = None
    district_id: Optional[str] = None

class Vacation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    user_name: str
    start_date: datetime
    end_date: datetime
    reason: str
    status: str = "pending"  # pending, approved, rejected
    approved_by: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class CheckIn(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    user_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    location: Optional[Dict[str, float]] = None
    status: str = "ok"  # ok, emergency, help_needed
    message: Optional[str] = None

class VacationCreate(BaseModel):
    start_date: str
    end_date: str
    reason: str

class ShiftCreate(BaseModel):
    team_id: str
    district_id: str
    start_time: str
    end_time: str

# Security functions
def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception as e:
        print(f"Password verification error: {e}")
        return False

def get_password_hash(password: str) -> str:
    """Generate password hash"""
    return pwd_context.hash(password)

def hash_password(password: str) -> str:
    """Hash password using bcrypt"""
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_identifier: str = payload.get("sub")  # Could be email or user_id
        user_id: str = payload.get("user_id")  # Token also contains user_id
        
        if user_identifier is None:
            raise credentials_exception
    except JWTError as e:
        raise credentials_exception
    
    # Try to find user by different methods
    user = None
    
    # First, try to find by ID (if the identifier looks like a UUID)
    if user_identifier and '-' in user_identifier and len(user_identifier) == 36:
        user = await db.users.find_one({"id": user_identifier})
    
    # If not found by ID, try by email
    if user is None:
        user = await db.users.find_one({"email": user_identifier})
    
    # If still not found and we have a separate user_id, try that
    if user is None and user_id:
        user = await db.users.find_one({"id": user_id})
    
    if user is None:
        raise credentials_exception
    
    return User(**user)

# Socket.IO events
@sio.event
async def connect(sid, environ):
    print(f"🔗 Client {sid} connected")

@sio.event
async def disconnect(sid):
    print(f"🔌 Client {sid} disconnected")
    # Remove from user_sockets mapping
    if sid in user_sockets:
        user_id = user_sockets[sid]
        del user_sockets[sid]
        # Update online status
        if user_id in online_users:
            online_users[user_id]["socket_id"] = None

@sio.event
async def join_user_room(sid, user_id):
    """Join user to their personal room for notifications"""
    await sio.enter_room(sid, f"user_{user_id}")
    user_sockets[sid] = user_id
    if user_id in online_users:
        online_users[user_id]["socket_id"] = sid
    print(f"👤 User {user_id} joined personal room")

@sio.event
async def join_channel(sid, channel):
    """Join a channel room"""
    await sio.enter_room(sid, f"channel_{channel}")
    print(f"📺 Socket {sid} joined channel: {channel}")

@sio.event
async def join_private_room(sid, data):
    """Join private chat room between two users"""
    user1 = data.get('user1')
    user2 = data.get('user2')
    # Create consistent room name regardless of order
    users = sorted([user1, user2])
    room_name = f"private_{users[0]}_{users[1]}"
    await sio.enter_room(sid, room_name)
    print(f"💬 Socket {sid} joined private room: {room_name}")

@sio.event
async def send_message(sid, data):
    """Handle real-time message sending"""
    try:
        channel = data.get('channel')
        content = data.get('content')
        sender_id = data.get('sender_id')
        recipient_id = data.get('recipient_id')
        message_type = data.get('message_type', 'text')
        
        # Create message object
        message_data = {
            "id": str(uuid.uuid4()),
            "content": content,
            "sender_id": sender_id,
            "channel": channel,
            "timestamp": datetime.utcnow(),
            "created_at": datetime.utcnow(),
            "message_type": message_type
        }
        
        if recipient_id:
            # Private message
            message_data["recipient_id"] = recipient_id
            # Save to database
            await db.messages.insert_one(message_data)
            
            # Send to private room
            users = sorted([sender_id, recipient_id])
            room_name = f"private_{users[0]}_{users[1]}"
            await sio.emit('new_message', message_data, room=room_name)
            
            # Send notification to recipient's personal room
            await sio.emit('new_message', message_data, room=f"user_{recipient_id}")
        else:
            # Channel message
            await db.messages.insert_one(message_data)
            # Send to channel room
            await sio.emit('new_message', message_data, room=f"channel_{channel}")
            
        print(f"📩 Message sent: {content[:50]}...")
        
    except Exception as e:
        print(f"❌ Error sending message: {e}")

@sio.event
async def join_room(sid, data):
    room = data.get('room', 'general')
    await sio.enter_room(sid, room)
    await sio.emit('joined_room', {'room': room}, room=sid)

@sio.event
async def location_update(sid, data):
    # Save location update
    location_data = {
        "user_id": data.get('user_id'),
        "location": data.get('location'),
        "timestamp": datetime.utcnow()
    }
    await db.locations.insert_one(location_data)
    
    # Broadcast to all connected clients
    await sio.emit('location_updated', location_data)

# API Routes
@api_router.post("/auth/register", response_model=User)
async def register_user(user_data: UserCreate):
    # Check if user already exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Hash password
    hashed_password = get_password_hash(user_data.password)
    
    # Create user object with all required fields
    user_dict = {
        "id": str(uuid.uuid4()),
        "email": user_data.email,
        "username": user_data.username,
        "role": user_data.role,
        "badge_number": user_data.badge_number,
        "department": user_data.department,
        "phone": user_data.phone,
        "service_number": user_data.service_number,
        "rank": user_data.rank,
        "status": "Im Dienst",
        "is_active": True,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "hashed_password": hashed_password  # Store hashed password
    }
    
    # Insert user into database
    await db.users.insert_one(user_dict)
    
    # Return user without password
    user_dict.pop('hashed_password')
    return User(**user_dict)

@api_router.post("/auth/login", response_model=Token)
async def login(user_data: UserLogin):
    user = await db.users.find_one({"email": user_data.email})
    if not user:
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    
    # Check both possible password field names
    stored_password = user.get("hashed_password") or user.get("password_hash")
    if not stored_password:
        raise HTTPException(status_code=400, detail="User password not found")
    
    if not verify_password(user_data.password, stored_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["email"], "user_id": user["id"], "role": user.get("role", "user")},
        expires_delta=access_token_expires
    )
    
    # Create user object for response
    user_obj = User(**user)
    return Token(access_token=access_token, token_type="bearer", user=user_obj)

@api_router.get("/auth/me", response_model=User)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    return current_user

@api_router.put("/auth/profile", response_model=User)
async def update_profile(user_updates: UserUpdate, current_user: User = Depends(get_current_user)):
    # Prepare update data
    update_data = {k: v for k, v in user_updates.dict().items() if v is not None}
    update_data['updated_at'] = datetime.utcnow()
    
    # Update user in database
    result = await db.users.update_one(
        {"id": current_user.id}, 
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get updated user
    updated_user = await db.users.find_one({"id": current_user.id})
    return User(**updated_user)

@api_router.put("/incidents/{incident_id}/assign", response_model=Incident)
async def assign_incident(incident_id: str, current_user: User = Depends(get_current_user)):
    # Allow all authenticated users to assign incidents (removed admin restriction)
    # Old restriction: Only police and admin can assign incidents
    # if current_user.role not in [UserRole.POLICE, UserRole.ADMIN]:
    #     raise HTTPException(status_code=403, detail="Not authorized")
    
    updates = {
        'assigned_to': current_user.id,
        'assigned_to_name': current_user.username,
        'status': 'in_progress',
        'updated_at': datetime.utcnow()
    }
    
    result = await db.incidents.update_one({"id": incident_id}, {"$set": updates})
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Incident not found")
    
    incident = await db.incidents.find_one({"id": incident_id})
    incident_obj = Incident(**incident)
    
    # Notify about incident assignment
    await sio.emit('incident_assigned', {
        'incident_id': incident_id,
        'assigned_to': current_user.username,
        'incident': incident_obj.dict()
    })
    
    return incident_obj

@api_router.get("/users/by-status")
async def get_users_by_status(current_user: User = Depends(get_current_user)):
    """Get users grouped by their work status with online information"""
    users = await db.users.find().to_list(100)
    now = datetime.utcnow()
    offline_threshold = timedelta(minutes=2)
    
    users_by_status = {}
    for user_doc in users:
        user_status = user_doc.get("status", "Im Dienst")
        
        # Check if user is online (last activity within 2 minutes)
        last_activity = user_doc.get("last_activity")
        is_online = False
        if last_activity and isinstance(last_activity, datetime):
            is_online = now - last_activity < offline_threshold
        
        if user_status not in users_by_status:
            users_by_status[user_status] = []
            
        user_data = {
            "id": user_doc.get("id"),
            "username": user_doc.get("username"),
            "phone": user_doc.get("phone"),
            "service_number": user_doc.get("service_number"),
            "rank": user_doc.get("rank"),
            "department": user_doc.get("department"),
            "status": user_status,
            "is_online": is_online,
            "online_status": "Online" if is_online else "Offline",
            "last_activity": last_activity.isoformat() if last_activity else None
        }
        users_by_status[user_status].append(user_data)
    
    return users_by_status

@api_router.delete("/messages/{message_id}")
async def delete_message(message_id: str, current_user: User = Depends(get_current_user)):
    # Find the message first
    message = await db.messages.find_one({"id": message_id})
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    # Allow all users to delete any message (removed admin restriction)
    # Old restriction: Check if user owns the message or is admin
    # if message["sender_id"] != current_user.id and current_user.role != UserRole.ADMIN:
    #     raise HTTPException(status_code=403, detail="Not authorized to delete this message")
    
    # Delete the message
    result = await db.messages.delete_one({"id": message_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Message not found")
    
    # Notify about message deletion
    await sio.emit('message_deleted', {'message_id': message_id, 'channel': message['channel']})
    
    return {"status": "success", "message": "Message deleted"}

class Report(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    content: str
    author_id: str
    author_name: str
    shift_date: str
    images: List[str] = []  # base64 encoded images from incidents
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    status: str = "draft"  # draft, submitted, reviewed
    last_edited_by: Optional[str] = None  # ID of last editor
    last_edited_by_name: Optional[str] = None  # Name of last editor
    edit_history: List[Dict[str, Any]] = []  # Track edit history

class ReportCreate(BaseModel):
    title: str
    content: str
    shift_date: str

@api_router.post("/reports", response_model=Report)
async def create_report(report_data: ReportCreate, current_user: User = Depends(get_current_user)):
    report_dict = report_data.dict()
    report_dict['author_id'] = current_user.id
    report_dict['author_name'] = current_user.username
    report_dict['status'] = 'draft'
    report_dict['created_at'] = datetime.utcnow()
    report_dict['updated_at'] = datetime.utcnow()
    
    report_obj = Report(**report_dict)
    result = await db.reports.insert_one(report_obj.dict())
    if not result.inserted_id:
        raise HTTPException(status_code=500, detail="Failed to create report")
    
    return report_obj

@api_router.put("/reports/{report_id}", response_model=Report)
async def update_report(
    report_id: str, 
    report_data: ReportCreate, 
    current_user: User = Depends(get_current_user)
):
    """Update an existing report including status changes"""
    try:
        # Find the existing report
        existing_report = await db.reports.find_one({"id": report_id})
        
        if not existing_report:
            raise HTTPException(status_code=404, detail="Report not found")
        
        # Check if user has permission to update this report
        if existing_report.get("author_id") != current_user.id and current_user.role != 'admin':
            raise HTTPException(status_code=403, detail="Permission denied")
        
        # Prepare update data
        update_data = report_data.dict()
        update_data['updated_at'] = datetime.utcnow()
        
        # Update the report
        result = await db.reports.update_one(
            {"id": report_id},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Report not found")
        
        # Get the updated report
        updated_report = await db.reports.find_one({"id": report_id})
        if '_id' in updated_report:
            del updated_report['_id']
        
        logger.info(f"Report updated: {report_id} by {current_user.username} - Status: {update_data.get('status', 'unchanged')}")
        return Report(**updated_report)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating report: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@api_router.delete("/reports/{report_id}")
async def delete_report(report_id: str, current_user: User = Depends(get_current_user)):
    """Delete a report"""
    # Find the report
    report = await db.reports.find_one({"id": report_id})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    # Check if user owns the report or is admin
    if report["author_id"] != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized to delete this report")
    
    # Delete the report
    result = await db.reports.delete_one({"id": report_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Report not found")
    
    return {"status": "success", "message": "Report deleted"}

@api_router.get("/reports", response_model=List[Report])
async def get_reports(current_user: User = Depends(get_current_user)):
    if current_user.role == UserRole.ADMIN:
        # Admin can see all reports
        reports = await db.reports.find().sort("created_at", -1).to_list(100)
    else:
        # Users can only see their own reports
        reports = await db.reports.find({"author_id": current_user.id}).sort("created_at", -1).to_list(100)
    
    return [Report(**report) for report in reports]

@api_router.put("/users/{user_id}", response_model=User)
async def update_user(user_id: str, updates: UserUpdate, current_user: User = Depends(get_current_user)):
    """Update user data (admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = {k: v for k, v in updates.dict().items() if v is not None}
    update_data['updated_at'] = datetime.utcnow()
    
    result = await db.users.update_one({"id": user_id}, {"$set": update_data})
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    updated_user = await db.users.find_one({"id": user_id})
    return User(**updated_user)

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: User = Depends(get_current_user)):
    """Delete a user (admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    result = await db.users.delete_one({"id": user_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"status": "success", "message": "User deleted"}

@api_router.delete("/incidents/{incident_id}")
async def delete_incident(incident_id: str, current_user: User = Depends(get_current_user)):
    """Delete an incident (admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    result = await db.incidents.delete_one({"id": incident_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Incident not found")
    
    return {"status": "success", "message": "Incident deleted"}

@api_router.put("/incidents/{incident_id}/complete", response_model=dict)
async def complete_incident(incident_id: str, current_user: User = Depends(get_current_user)):
    # Allow all authenticated users to complete incidents (removed admin restriction)
    # Old restriction: Only police and admin can complete incidents
    # if current_user.role not in [UserRole.POLICE, UserRole.ADMIN]:
    #     raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get incident details first
    incident = await db.incidents.find_one({"id": incident_id})
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    
    # Create archive report with images
    archive_report = {
        "id": str(uuid.uuid4()),
        "title": f"Archiv: {incident['title']}",
        "content": f"Vorfall abgeschlossen:\n\nTitel: {incident['title']}\nBeschreibung: {incident['description']}\nOrt: {incident['address']}\nPriorität: {incident['priority']}\n\nAbgeschlossen von: {current_user.username}\nDatum: {datetime.utcnow().strftime('%d.%m.%Y %H:%M')}",
        "author_id": current_user.id,
        "author_name": current_user.username,
        "shift_date": datetime.utcnow().strftime('%Y-%m-%d'),
        "status": "archived",
        "incident_id": incident_id,
        "images": incident.get('images', []),  # Transfer images from incident to report
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    # Save to archive
    await db.reports.insert_one(archive_report)
    
    # Delete the incident from active incidents
    result = await db.incidents.delete_one({"id": incident_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Incident not found")
    
    # Notify about incident completion
    await sio.emit('incident_completed', {
        'incident_id': incident_id,
        'completed_by': current_user.username,
        'archived_as': archive_report['id']
    })
    
    return {"status": "success", "message": "Incident completed and archived", "archive_id": archive_report['id']}

@api_router.get("/reports/folders")
async def get_report_folders(current_user: User = Depends(get_current_user)):
    """Get all report folders and their contents"""
    if current_user.role == UserRole.ADMIN:
        # Admin can see all reports
        reports = await db.reports.find().sort("created_at", -1).to_list(1000)
    else:
        # Users can only see their own reports
        reports = await db.reports.find({"author_id": current_user.id}).sort("created_at", -1).to_list(1000)
    
    # Organize reports by folders (year/month)
    folders = {}
    for report in reports:
        created_date = report['created_at']
        if isinstance(created_date, str):
            from datetime import datetime
            created_date = datetime.fromisoformat(created_date.replace('Z', '+00:00'))
        
        year = str(created_date.year)
        month = created_date.strftime('%B')  # Full month name
        
        folder_path = f"Berichte/{year}/{month}"
        
        if folder_path not in folders:
            folders[folder_path] = []
        
        folders[folder_path].append({
            "id": report["id"],
            "title": report["title"],
            "content": report["content"],
            "author_name": report["author_name"],
            "shift_date": report["shift_date"],
            "created_at": report["created_at"],
            "status": report.get("status", "submitted")
        })
    
    return folders

@api_router.put("/reports/{report_id}", response_model=Report)
async def update_report(report_id: str, updated_data: ReportCreate, current_user: User = Depends(get_current_user)):
    """Update an existing report"""
    # Find the report
    report = await db.reports.find_one({"id": report_id})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    # Check if user owns the report or is admin
    if report["author_id"] != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized to edit this report")
    
    # Create edit history entry
    edit_history_entry = {
        "edited_by": current_user.id,
        "edited_by_name": current_user.username,
        "edited_at": datetime.utcnow(),
        "changes": {
            "title": {"old": report.get("title"), "new": updated_data.title},
            "content": {"old": report.get("content"), "new": updated_data.content},
            "shift_date": {"old": report.get("shift_date"), "new": updated_data.shift_date}
        }
    }
    
    # Update the report
    update_fields = {
        "title": updated_data.title,
        "content": updated_data.content,
        "shift_date": updated_data.shift_date,
        "updated_at": datetime.utcnow(),
        "last_edited_by": current_user.id,
        "last_edited_by_name": current_user.username
    }
    
    result = await db.reports.update_one(
        {"id": report_id}, 
        {
            "$set": update_fields,
            "$push": {"edit_history": edit_history_entry}
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Report not found")
    
    # Get updated report
    updated_report = await db.reports.find_one({"id": report_id})
    return Report(**updated_report)

# Person Database Endpoints
@api_router.post("/persons", response_model=Person)
async def create_person(person_data: PersonCreate, current_user: User = Depends(get_current_user)):
    """Erstelle eine neue Person in der Datenbank"""
    # Allow all authenticated users to create person entries (removed admin restriction)
    # Old restriction: Only police and admin can create person entries
    # if current_user.role not in [UserRole.POLICE, UserRole.ADMIN]:
    #     raise HTTPException(status_code=403, detail="Not authorized")
    
    person_dict = person_data.dict()
    person_dict['created_by'] = current_user.id
    person_dict['created_by_name'] = current_user.username
    person_obj = Person(**person_dict)
    
    await db.persons.insert_one(person_obj.dict())
    
    # Notify all users about new person entry
    await sio.emit('new_person', person_obj.dict())
    
    return person_obj

@api_router.get("/persons", response_model=List[Person])
async def get_persons(status: Optional[str] = None, current_user: User = Depends(get_current_user)):
    """Lade alle Personen oder nach Status gefiltert"""
    query = {"is_active": True}
    if status:
        query["status"] = status
    
    persons = await db.persons.find(query).sort("created_at", -1).to_list(100)
    return [Person(**person) for person in persons]

@api_router.get("/persons/{person_id}", response_model=Person)
async def get_person(person_id: str, current_user: User = Depends(get_current_user)):
    """Lade eine spezifische Person"""
    person = await db.persons.find_one({"id": person_id})
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    return Person(**person)

@api_router.put("/persons/{person_id}", response_model=Person)
async def update_person(person_id: str, updates: PersonUpdate, current_user: User = Depends(get_current_user)):
    """Aktualisiere Person-Daten"""
    # Allow all authenticated users to update person entries (removed admin restriction)
    # Old restriction: Only police and admin can update person entries
    # if current_user.role not in [UserRole.POLICE, UserRole.ADMIN]:
    #     raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = {k: v for k, v in updates.dict().items() if v is not None}
    update_data['updated_at'] = datetime.utcnow()
    
    result = await db.persons.update_one({"id": person_id}, {"$set": update_data})
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Person not found")
    
    person = await db.persons.find_one({"id": person_id})
    person_obj = Person(**person)
    
    # Notify about person update
    await sio.emit('person_updated', person_obj.dict())
    
    return person_obj

@api_router.delete("/persons/{person_id}")
async def delete_person(person_id: str, current_user: User = Depends(get_current_user)):
    """Lösche eine Person (nur Admin)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    result = await db.persons.update_one(
        {"id": person_id}, 
        {"$set": {"is_active": False, "updated_at": datetime.utcnow()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Person not found")
    
    return {"status": "success", "message": "Person archived"}

@api_router.get("/persons/stats/overview")
async def get_person_stats(current_user: User = Depends(get_current_user)):
    """Statistiken über Personen-Datenbank"""
    total_persons = await db.persons.count_documents({"is_active": True})
    missing_persons = await db.persons.count_documents({"is_active": True, "status": "vermisst"})
    wanted_persons = await db.persons.count_documents({"is_active": True, "status": "gesucht"})
    found_persons = await db.persons.count_documents({"is_active": True, "status": "gefunden"})
    
    return {
        "total_persons": total_persons,
        "missing_persons": missing_persons,
        "wanted_persons": wanted_persons,
        "found_persons": found_persons
    }

@api_router.post("/emergency/broadcast")
async def broadcast_emergency_alert(
    alert_data: dict,
    current_user: User = Depends(get_current_user)
):
    """Broadcast emergency alert to all active users with GPS location"""
    try:
        # Extract location data
        location_data = alert_data.get("location", None)
        location_status = alert_data.get("location_status", "Unbekannt")
        
        # Create comprehensive emergency broadcast record
        broadcast_dict = {
            "id": str(uuid.uuid4()),
            "type": alert_data.get("type", "sos_alarm"),
            "message": alert_data.get("message", "Notfall-Alarm"),
            "sender_id": current_user.id,
            "sender_name": current_user.username,
            "sender_badge": getattr(current_user, 'badge_number', 'N/A'),
            "location": location_data,
            "location_status": location_status,
            "has_gps": location_data is not None,
            "timestamp": datetime.utcnow(),
            "priority": alert_data.get("priority", "urgent"),
            "recipients": "all_users",
            "status": "sent"
        }
        
        # Store in database
        result = await db.emergency_broadcasts.insert_one(broadcast_dict)
        
        if not result.inserted_id:
            raise HTTPException(status_code=500, detail="Failed to create emergency broadcast")
        
        # Log detailed info
        location_info = ""
        if location_data:
            try:
                # Safely format GPS coordinates with validation
                lat = location_data.get('latitude')
                lng = location_data.get('longitude')
                accuracy = location_data.get('accuracy', 0)
                
                if lat is not None and lng is not None and isinstance(lat, (int, float)) and isinstance(lng, (int, float)):
                    location_info = f" at GPS: {float(lat):.6f}, {float(lng):.6f} (±{float(accuracy):.0f}m)"
                else:
                    location_info = f" - GPS: Invalid coordinates provided"
            except (ValueError, TypeError) as e:
                location_info = f" - GPS: Error formatting coordinates ({str(e)})"
        else:
            location_info = f" - GPS: {location_status}"
            
        logger.info(f"🚨 EMERGENCY BROADCAST: {broadcast_dict['id']} by {current_user.username}{location_info}")
        
        # TODO: Implement real-time notification to all users via WebSocket/Push notifications
        # This would trigger push notifications to all team members with GPS coordinates
        
        return {
            "success": True,
            "broadcast_id": broadcast_dict["id"],
            "message": "Emergency alert broadcasted to all team members",
            "location_transmitted": location_data is not None,
            "location_status": location_status,
            "timestamp": broadcast_dict["timestamp"].isoformat()
        }
        
    except Exception as e:
        logger.error(f"❌ Error creating emergency broadcast: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@api_router.get("/emergency/broadcasts")
async def get_emergency_broadcasts(current_user: User = Depends(get_current_user)):
    """Get recent emergency broadcasts for monitoring"""
    try:
        # Get recent emergency broadcasts (last 24 hours)
        yesterday = datetime.utcnow() - timedelta(days=1)
        cursor = db.emergency_broadcasts.find(
            {"timestamp": {"$gte": yesterday}}
        ).sort("timestamp", -1).limit(50)
        
        broadcasts = await cursor.to_list(length=50)
        
        result = []
        for broadcast in broadcasts:
            if '_id' in broadcast:
                del broadcast['_id']
            result.append(broadcast)
        
        logger.info(f"Retrieved {len(result)} emergency broadcasts")
        return result
        
    except Exception as e:
        logger.error(f"Error retrieving emergency broadcasts: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@api_router.post("/incidents", response_model=Incident)
async def create_incident(incident_data: IncidentCreate, current_user: User = Depends(get_current_user)):
    """Create a new incident with geocoding support"""
    incident_dict = incident_data.dict()
    incident_dict["id"] = str(uuid.uuid4())
    incident_dict["created_at"] = datetime.utcnow()
    incident_dict["updated_at"] = datetime.utcnow()
    incident_dict["status"] = "open"
    incident_dict["reported_by"] = current_user.username
    
    # FIXED: Handle coordinates from GPS data correctly
    if isinstance(incident_dict.get("coordinates"), dict):
        # Convert coordinates dict to location format AND preserve coordinates
        coords = incident_dict["coordinates"]
        incident_dict["location"] = {
            "lat": coords.get("lat", 51.2879),
            "lng": coords.get("lng", 7.2954)
        }
        # KEEP coordinates for GoogleMapsView compatibility
        incident_dict["coordinates"] = {
            "lat": coords.get("lat"),
            "lng": coords.get("lng")
        }
    elif not incident_dict.get("location"):
        # Default location if no coordinates provided
        incident_dict["location"] = {
            "lat": 51.2879,
            "lng": 7.2954
        }
    
    await db.incidents.insert_one(incident_dict)
    return Incident(**incident_dict)

@api_router.get("/incidents", response_model=List[Incident])
async def get_incidents(current_user: User = Depends(get_current_user)):
    incidents = await db.incidents.find().sort("created_at", -1).to_list(100)
    return [Incident(**incident) for incident in incidents]

@api_router.get("/incidents/{incident_id}", response_model=Incident)
async def get_incident(incident_id: str, current_user: User = Depends(get_current_user)):
    incident = await db.incidents.find_one({"id": incident_id})
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return Incident(**incident)

@api_router.put("/incidents/{incident_id}", response_model=Incident)
async def update_incident(incident_id: str, updates: Dict[str, Any], current_user: User = Depends(get_current_user)):
    # Allow all authenticated users to update incidents (removed admin restriction)
    # Old restriction: Only police and admin can update incidents
    # if current_user.role not in [UserRole.POLICE, UserRole.ADMIN]:
    #     raise HTTPException(status_code=403, detail="Not authorized")
    
    updates['updated_at'] = datetime.utcnow()
    result = await db.incidents.update_one({"id": incident_id}, {"$set": updates})
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Incident not found")
    
    incident = await db.incidents.find_one({"id": incident_id})
    incident_obj = Incident(**incident)
    
    # Notify about incident update
    await sio.emit('incident_updated', incident_obj.dict())
    
    return incident_obj

@api_router.get("/messages", response_model=List[Message])
async def get_messages(channel: str = "general", current_user: User = Depends(get_current_user)):
    """Get messages from specified channel"""
    try:
        messages = await db.messages.find({"channel": channel}).sort("timestamp", 1).limit(100).to_list(100)
        return [Message(**message) for message in messages]
    except Exception as e:
        # Return empty list if no messages found
        return []

@api_router.get("/messages/private", response_model=List[Message])
async def get_private_messages(unread_only: bool = False, current_user: User = Depends(get_current_user)):
    """Get private messages for current user"""
    query = {
        "channel": "private",
        "recipient_id": current_user.id
    }
    
    # If unread_only is true, add filter for unread messages
    if unread_only:
        query["is_read"] = {"$ne": True}
    
    messages = await db.messages.find(query).sort("timestamp", -1).limit(50).to_list(50)
    return [Message(**message) for message in messages]

@api_router.post("/messages", response_model=Message)
async def send_message(message_data: MessageCreate, current_user: User = Depends(get_current_user)):
    message_dict = message_data.dict()
    message_dict['sender_id'] = current_user.id
    message_dict['sender_name'] = current_user.username  # Add sender name
    message_dict['timestamp'] = datetime.utcnow()  # Add timestamp
    message_dict['created_at'] = datetime.utcnow()  # Add created_at for compatibility
    message_obj = Message(**message_dict)
    
    await db.messages.insert_one(message_obj.dict())
    
    # Emit to socket room
    await sio.emit('new_message', message_obj.dict(), room=message_data.channel)
    
    return message_obj

@api_router.post("/notifications")
async def create_notification(
    request: dict,
    current_user: User = Depends(get_current_user)
):
    """Create a notification for a user"""
    try:
        recipient_id = request.get("recipient_id")
        title = request.get("title")
        content = request.get("content")
        notification_type = request.get("notification_type", "info")
        
        notification_dict = {
            "id": str(uuid.uuid4()),
            "recipient_id": recipient_id,
            "sender_id": current_user.id,
            "sender_name": current_user.username,
            "title": title,
            "content": content,
            "type": notification_type,
            "is_read": False,
            "created_at": datetime.utcnow(),
            "timestamp": datetime.utcnow()
        }
        
        await db.notifications.insert_one(notification_dict)
        return {"success": True, "message": "Notification created"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create notification: {str(e)}")

@api_router.get("/locations/live")
async def get_live_locations(current_user: User = Depends(get_current_user)):
    """Get live officer locations"""
    try:
        # Mock officer locations for demo - in production this would come from GPS tracking
        officers = await db.users.find({"status": "Im Dienst"}).to_list(100)
        
        live_locations = []
        for i, officer in enumerate(officers):
            # Generate mock locations around Schwelm area
            base_lat = 51.2878
            base_lng = 7.3372
            
            location = {
                "id": officer.get("id", str(uuid.uuid4())),
                "username": officer.get("username", f"Officer {i+1}"),
                "status": officer.get("status", "Im Dienst"),
                "location": {
                    "lat": base_lat + (i * 0.001) + (0.002 * (i % 3)),
                    "lng": base_lng + (i * 0.0015) + (0.003 * (i % 2))
                },
                "timestamp": datetime.utcnow().isoformat()
            }
            live_locations.append(location)
        
        return live_locations
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get live locations: {str(e)}")

@api_router.get("/users", response_model=List[User])
async def get_users(current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    users = await db.users.find().to_list(100)
    return [User(**user) for user in users]

@api_router.get("/locations/live")
async def get_live_locations(current_user: User = Depends(get_current_user)):
    # Get latest location for each user (last 10 minutes)
    cutoff_time = datetime.utcnow() - timedelta(minutes=10)
    
    pipeline = [
        {"$match": {"timestamp": {"$gte": cutoff_time}}},
        {"$sort": {"timestamp": -1}},
        {"$group": {
            "_id": "$user_id",
            "latest_location": {"$first": "$$ROOT"}
        }}
    ]
    
    locations = await db.locations.aggregate(pipeline).to_list(100)
    
    # Convert ObjectId to string for JSON serialization
    result = []
    for loc in locations:
        location_data = loc["latest_location"]
        if "_id" in location_data:
            location_data["_id"] = str(location_data["_id"])
        result.append(location_data)
    
    return result

@api_router.post("/locations/update")
async def update_location(location_data: LocationUpdate, current_user: User = Depends(get_current_user)):
    location_data.user_id = current_user.id
    await db.locations.insert_one(location_data.dict())
    
    # Emit location update
    await sio.emit('location_updated', location_data.dict())
    
    return {"status": "success"}

# Admin routes
@api_router.get("/admin/stats")
async def get_admin_stats(current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    total_users = await db.users.count_documents({})
    total_incidents = await db.incidents.count_documents({})
    open_incidents = await db.incidents.count_documents({"status": "open"})
    total_messages = await db.messages.count_documents({})
    
    return {
        "total_users": total_users,
        "total_incidents": total_incidents,
        "open_incidents": open_incidents,
        "total_messages": total_messages
    }

# Online Status Management
@api_router.post("/users/online-status")
async def set_online_status(current_user: User = Depends(get_current_user)):
    """Mark user as online and update last seen"""
    user_id = current_user.id
    now = datetime.utcnow()
    
    online_users[user_id] = {
        "last_seen": now,
        "username": current_user.username,
        "socket_id": None  # Will be updated when socket connects
    }
    
    # Notify all clients about user coming online
    await sio.emit('user_online', {
        'user_id': user_id,
        'username': current_user.username,
        'timestamp': now.isoformat()
    })
    
    return {"status": "online", "user_id": user_id, "timestamp": now}

@api_router.post("/users/heartbeat")
async def user_heartbeat(current_user: User = Depends(get_current_user)):
    """Update user's last seen timestamp (heartbeat)"""
    user_id = current_user.id
    now = datetime.utcnow()
    
    if user_id in online_users:
        online_users[user_id]["last_seen"] = now
    else:
        online_users[user_id] = {
            "last_seen": now,
            "username": current_user.username,
            "socket_id": None
        }
    
    return {"status": "heartbeat", "timestamp": now}

@api_router.get("/users/online")
async def get_online_users(current_user: User = Depends(get_current_user)):
    """Get list of currently online users"""
    now = datetime.utcnow()
    offline_threshold = timedelta(minutes=2)  # Consider offline after 2 minutes
    
    online_list = []
    users_to_remove = []
    
    for user_id, data in online_users.items():
        time_diff = now - data["last_seen"]
        if time_diff <= offline_threshold:
            online_list.append({
                "user_id": user_id,
                "username": data["username"],
                "last_seen": data["last_seen"].isoformat(),
                "minutes_ago": int(time_diff.total_seconds() / 60)
            })
        else:
            users_to_remove.append(user_id)
    
    # Clean up offline users
    for user_id in users_to_remove:
        del online_users[user_id]
        await sio.emit('user_offline', {'user_id': user_id})
    
    return online_list

@api_router.post("/users/logout")
async def logout_user(current_user: User = Depends(get_current_user)):
    """Mark user as offline when logging out"""
    user_id = current_user.id
    
    if user_id in online_users:
        del online_users[user_id]
        
    # Notify all clients about user going offline
    await sio.emit('user_offline', {'user_id': user_id})
    
    return {"status": "logged_out", "user_id": user_id}


# Admin route to create first user
@api_router.post("/admin/create-first-user")
async def create_first_user(user_data: UserCreate):
    """Create the first admin user - only works if no users exist"""
    # Check if any users already exist
    existing_users = await db.users.count_documents({})
    if existing_users > 0:
        raise HTTPException(status_code=400, detail="Users already exist. Use normal registration.")
    
    # Create first admin user
    hashed_password = hash_password(user_data.password)
    user_dict = user_data.dict()
    user_dict["hashed_password"] = hashed_password  # Use consistent field name
    user_dict.pop("password", None)  # Remove plain password
    user_dict["role"] = UserRole.ADMIN  # Force admin role for first user
    user_dict["id"] = str(uuid.uuid4())
    user_dict["created_at"] = datetime.utcnow()
    user_dict["updated_at"] = datetime.utcnow()
    user_dict["is_active"] = True
    user_dict["status"] = "Im Dienst"
    
    await db.users.insert_one(user_dict)
    
    # Return user without password
    user_dict.pop("hashed_password", None)
    
    # Convert datetime objects to strings for JSON serialization
    user_dict["created_at"] = user_dict["created_at"].isoformat()
    user_dict["updated_at"] = user_dict["updated_at"].isoformat()
    
    return {"message": "First admin user created successfully", "user": user_dict}

# Database reset endpoint (DANGER!)
@api_router.delete("/admin/reset-database")
async def reset_database():
    """Reset the database - DANGER ZONE"""
    try:
        # Clear all collections
        collections_cleared = 0
        total_documents_deleted = 0
        collection_names = []
        
        for collection_name in await db.list_collection_names():
            collection = db[collection_name]
            result = await collection.delete_many({})
            collections_cleared += 1
            total_documents_deleted += result.deleted_count
            collection_names.append(collection_name)
        
        return {
            "message": "Database completely reset!",
            "collections_cleared": collections_cleared,
            "total_documents_deleted": total_documents_deleted,
            "collections": collection_names
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Reset failed: {str(e)}")

# App Configuration Endpoints
@api_router.get("/app/config", response_model=AppConfiguration)
async def get_app_configuration():
    """Get current app configuration"""
    config = await db.app_config.find_one()
    if not config:
        # Create default configuration
        default_config = AppConfiguration()
        await db.app_config.insert_one(default_config.dict())
        return default_config
    
    # Convert MongoDB _id to our id field
    if "_id" in config:
        del config["_id"]
    
    return AppConfiguration(**config)

@api_router.put("/admin/app/config", response_model=AppConfiguration)
async def update_app_configuration(
    config_update: AppConfigurationUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update app configuration (Admin only)"""
    # Only admins can update app configuration
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can update app configuration")
    
    # Get current config
    current_config = await db.app_config.find_one()
    if not current_config:
        # Create default if none exists
        current_config = AppConfiguration().dict()
        await db.app_config.insert_one(current_config)
    
    # Update only provided fields
    update_data = {k: v for k, v in config_update.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    
    # Update in database
    await db.app_config.update_one(
        {"id": current_config["id"]},
        {"$set": update_data}
    )
    
    # Get updated config
    updated_config = await db.app_config.find_one({"id": current_config["id"]})
    if "_id" in updated_config:
        del updated_config["_id"]
    
    return AppConfiguration(**updated_config)

# Root route
@api_router.get("/")
async def root():
    return {"message": "Stadtwache API", "version": "1.0.0"}

# Statische Dateien für Frontend
static_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../frontend/dist"))
expo_static_path = os.path.join(static_path, "_expo")
assets_path = os.path.join(static_path, "assets")
fonts_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../frontend/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts"))

if os.path.exists(expo_static_path):
    # Mount _expo directory to /_expo path
    app.mount("/_expo", StaticFiles(directory=expo_static_path), name="expo_static")
    print(f"✅ Expo static files mounted from: {expo_static_path}")

if os.path.exists(assets_path):
    # Mount assets directory to /assets path  
    app.mount("/assets", StaticFiles(directory=assets_path), name="assets")
    print(f"✅ Assets mounted from: {assets_path}")

if os.path.exists(fonts_path):
    # Mount fonts for icons
    app.mount("/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts", StaticFiles(directory=fonts_path), name="fonts")
    print(f"✅ Icon fonts mounted from: {fonts_path}")

# Root route - serviert Frontend oder JSON
@app.get("/")
async def root():
    static_index = os.path.join(static_path, "index.html")
    if os.path.exists(static_index):
        return FileResponse(static_index)
    else:
        return {"message": "Stadtwache Server", "version": "1.0.0", "status": "running"}

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Schichtverwaltung API Endpoints - Einfache Funktionen
@app.post("/api/checkin")
async def check_in(current_user: User = Depends(get_current_user)):
    """Benutzer Check-In"""
    try:
        checkin_data = {
            "id": str(uuid.uuid4()),
            "user_id": current_user.id,
            "user_name": current_user.username,
            "timestamp": datetime.utcnow(),
            "status": "ok"
        }
        
        await db.checkins.insert_one(checkin_data)
        
        # Update user's last check-in time and reset missed check-ins
        await db.users.update_one(
            {"id": current_user.id},
            {"$set": {"last_check_in": datetime.utcnow(), "missed_check_ins": 0}}
        )
        
        return checkin_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/checkins")
async def get_checkins(current_user: User = Depends(get_current_user)):
    """Lade Check-Ins"""
    try:
        if current_user.role == "admin":
            checkins = await db.checkins.find().sort("timestamp", -1).to_list(100)
        else:
            checkins = await db.checkins.find({"user_id": current_user.id}).sort("timestamp", -1).to_list(50)
        
        return checkins
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/vacations")
async def request_vacation(vacation_data: VacationCreate, current_user: User = Depends(get_current_user)):
    """Urlaubsantrag stellen"""
    try:
        vacation_dict = {
            "id": str(uuid.uuid4()),
            "user_id": current_user.id,
            "user_name": current_user.username,
            "start_date": vacation_data.start_date,
            "end_date": vacation_data.end_date,
            "reason": vacation_data.reason,
            "status": "pending",
            "created_at": datetime.utcnow()
        }
        
        await db.vacations.insert_one(vacation_dict)
        return vacation_dict
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/vacations")
async def get_vacations(current_user: User = Depends(get_current_user)):
    """Lade Urlaubsanträge"""
    try:
        if current_user.role == "admin":
            vacations = await db.vacations.find().sort("created_at", -1).to_list(100)
        else:
            vacations = await db.vacations.find({"user_id": current_user.id}).sort("created_at", -1).to_list(100)
        
        return vacations
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Admin Management Endpoints

# Urlaubsanträge Admin-Endpunkte
@app.put("/api/admin/vacations/{vacation_id}/approve")
async def approve_vacation(vacation_id: str, approval_data: VacationApproval, current_user: User = Depends(get_current_user)):
    """Urlaubsantrag genehmigen/ablehnen (nur Admin)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    try:
        # Vacation finden
        vacation = await db.vacations.find_one({"id": vacation_id})
        if not vacation:
            raise HTTPException(status_code=404, detail="Vacation request not found")
        
        # Status aktualisieren
        update_data = {
            "status": "approved" if approval_data.action == "approve" else "rejected",
            "approved_by": current_user.id,
            "approval_reason": approval_data.reason,
            "approved_at": datetime.utcnow()
        }
        
        result = await db.vacations.update_one(
            {"id": vacation_id},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Vacation request not found")
        
        # Aktualisierte Vacation zurückgeben
        updated_vacation = await db.vacations.find_one({"id": vacation_id})
        return updated_vacation
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/admin/vacations")
async def get_all_vacations(current_user: User = Depends(get_current_user)):
    """Alle Urlaubsanträge für Admin abrufen"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    try:
        vacations = await db.vacations.find().sort("created_at", -1).to_list(100)
        return vacations
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/admin/districts")
async def create_district(district_data: DistrictCreate, current_user: User = Depends(get_current_user)):
    """Bezirk erstellen (nur Admin)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    district_dict = district_data.dict()
    district_dict['id'] = str(uuid.uuid4())
    district_dict['created_at'] = datetime.utcnow()
    
    await db.districts.insert_one(district_dict)
    return district_dict

@app.get("/api/admin/districts")
async def get_districts(current_user: User = Depends(get_current_user)):
    """Alle Bezirke abrufen"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    districts = await db.districts.find().to_list(100)
    return districts

@app.post("/api/admin/teams")
async def create_team(team_data: TeamCreate, current_user: User = Depends(get_current_user)):
    """Team erstellen (nur Admin)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    team_dict = team_data.dict()
    team_dict['id'] = str(uuid.uuid4())
    team_dict['created_at'] = datetime.utcnow()
    team_dict['members'] = []
    team_dict['status'] = 'Einsatzbereit'
    
    await db.teams.insert_one(team_dict)
    return team_dict

@app.get("/api/admin/teams")
async def get_teams(current_user: User = Depends(get_current_user)):
    """Alle Teams abrufen"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    teams = await db.teams.find().to_list(100)
    return teams

@app.put("/api/admin/assign-user")
async def assign_user_to_team_district(assignment: TeamAssignment, current_user: User = Depends(get_current_user)):
    """Benutzer zu Team/Bezirk zuweisen (nur Admin)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = {}
    if assignment.team_id:
        update_data['patrol_team'] = assignment.team_id
        # User zu Team hinzufügen
        await db.teams.update_one(
            {"id": assignment.team_id},
            {"$addToSet": {"members": assignment.user_id}}
        )
    
    if assignment.district_id:
        update_data['assigned_district'] = assignment.district_id
    
    # Benutzer aktualisieren
    result = await db.users.update_one(
        {"id": assignment.user_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"status": "success", "message": "User assigned successfully"}

@app.get("/api/admin/attendance")
async def get_attendance_list(current_user: User = Depends(get_current_user)):
    """Anwesenheitsliste für Admin abrufen"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    try:
        # Alle Benutzer mit Status und Team-Info laden
        users = await db.users.find().to_list(100)
        attendance_list = []
        
        for user in users:
            # Team-Name abrufen falls zugewiesen
            team_name = "Nicht zugewiesen"
            if user.get("patrol_team"):
                team = await db.teams.find_one({"id": user["patrol_team"]})
                if team:
                    team_name = team["name"]
            
            # Bezirks-Name abrufen falls zugewiesen  
            district_name = "Nicht zugewiesen"
            if user.get("assigned_district"):
                district = await db.districts.find_one({"id": user["assigned_district"]})
                if district:
                    district_name = district["name"]
            
            attendance_list.append({
                "id": user["id"],
                "username": user["username"],
                "status": user.get("status", "Im Dienst"),
                "team": team_name,
                "district": district_name,
                "last_check_in": user.get("last_check_in"),
                "phone": user.get("phone"),
                "service_number": user.get("service_number"),
                "is_online": user.get("status") == "Im Dienst"
            })
        
        return attendance_list
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/admin/team-status")
async def get_team_status(current_user: User = Depends(get_current_user)):
    """Team-Status für Admin abrufen"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    try:
        teams = await db.teams.find().to_list(100)
        team_status_list = []
        
        for team in teams:
            # Team-Mitglieder laden
            members = []
            if team.get("members"):
                for member_id in team["members"]:
                    user = await db.users.find_one({"id": member_id})
                    if user:
                        members.append({
                            "id": user["id"],
                            "username": user["username"],
                            "status": user.get("status", "Im Dienst")
                        })
            
            # Bezirks-Name abrufen
            district_name = "Nicht zugewiesen"
            if team.get("district_id"):
                district = await db.districts.find_one({"id": team["district_id"]})
                if district:
                    district_name = district["name"]
            
            team_status_list.append({
                "id": team["id"],
                "name": team["name"],
                "status": team.get("status", "Einsatzbereit"),
                "district": district_name,
                "members": members,
                "member_count": len(members)
            })
        
        return team_status_list
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/admin/teams/{team_id}/status")
async def update_team_status(team_id: str, status_data: dict, current_user: User = Depends(get_current_user)):
    """Team-Status aktualisieren"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    try:
        new_status = status_data.get("status")
        if new_status not in ["Einsatzbereit", "Im Einsatz", "Pause", "Nicht verfügbar"]:
            raise HTTPException(status_code=400, detail="Invalid status")
        
        result = await db.teams.update_one(
            {"id": team_id},
            {"$set": {"status": new_status}}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Team not found")
        
        return {"status": "success", "message": f"Team status updated to {new_status}"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/admin/vacations/{vacation_id}")
async def handle_vacation_request(vacation_id: str, approval: VacationApproval, current_user: User = Depends(get_current_user)):
    """Urlaubsantrag genehmigen/ablehnen (nur Admin)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = {
        "status": "approved" if approval.action == "approve" else "rejected",
        "approved_by": current_user.id,
        "admin_reason": approval.reason or ""
    }
    
    result = await db.vacations.update_one(
        {"id": vacation_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Vacation request not found")
    
    return {"status": "success", "message": f"Vacation request {approval.action}d"}

@app.get("/api/admin/attendance")
async def get_attendance_list(current_user: User = Depends(get_current_user)):
    """Anwesenheitsliste abrufen (nur Admin)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    users = await db.users.find({"is_active": True}).to_list(100)
    
    attendance_list = []
    for user in users:
        # Team-Info abrufen
        team_info = None
        if user.get('patrol_team'):
            team = await db.teams.find_one({"id": user['patrol_team']})
            team_info = team['name'] if team else None
        
        # Bezirk-Info abrufen
        district_info = None
        if user.get('assigned_district'):
            district = await db.districts.find_one({"id": user['assigned_district']})
            district_info = district['name'] if district else None
        
        attendance_list.append({
            "id": user["id"],
            "username": user["username"],
            "status": user.get("status", "Nicht verfügbar"),
            "team": team_info,
            "district": district_info,
            "last_check_in": user.get("last_check_in"),
            "phone": user.get("phone"),
            "rank": user.get("rank")
        })
    
    return attendance_list

@app.get("/api/admin/team-status")
async def get_team_status(current_user: User = Depends(get_current_user)):
    """Team-Status abrufen (nur Admin)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    teams = await db.teams.find().to_list(100)
    
    team_status_list = []
    for team in teams:
        # Mitglieder-Status prüfen
        member_count = len(team.get('members', []))
        active_members = 0
        
        if team.get('members'):
            active_users = await db.users.find({
                "id": {"$in": team['members']},
                "status": {"$in": ["Im Dienst", "Einsatz", "Streife"]}
            }).to_list(100)
            active_members = len(active_users)
        
        # Team-Status basierend auf aktiven Mitgliedern
        if active_members == 0:
            status = "Nicht verfügbar"
        elif active_members == member_count:
            status = "Einsatzbereit"
        else:
            status = "Im Einsatz"
        
        team_status_list.append({
            "id": team["id"],
            "name": team["name"],
            "status": status,
            "total_members": member_count,
            "active_members": active_members,
            "district": team.get("district_id")
        })
    
    return team_status_list
@app.post("/api/admin/districts")
async def create_district(district_data: DistrictCreate, current_user: User = Depends(get_current_user)):
    """Bezirk erstellen (nur Admin)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    district_dict = district_data.dict()
    district_dict['id'] = str(uuid.uuid4())
    district_dict['created_at'] = datetime.utcnow()
    
    await db.districts.insert_one(district_dict)
    return district_dict

@app.get("/api/admin/districts")
async def get_districts(current_user: User = Depends(get_current_user)):
    """Alle Bezirke abrufen"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    districts = await db.districts.find().to_list(100)
    return districts

@app.post("/api/admin/teams")
async def create_team(team_data: TeamCreate, current_user: User = Depends(get_current_user)):
    """Team erstellen (nur Admin)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    team_dict = team_data.dict()
    team_dict['id'] = str(uuid.uuid4())
    team_dict['created_at'] = datetime.utcnow()
    team_dict['members'] = []
    team_dict['status'] = 'Einsatzbereit'
    
    await db.teams.insert_one(team_dict)
    return team_dict

@app.get("/api/admin/teams")
async def get_teams(current_user: User = Depends(get_current_user)):
    """Alle Teams abrufen"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    teams = await db.teams.find().to_list(100)
    return teams

@app.put("/api/admin/assign-user")
async def assign_user_to_team_district(assignment: TeamAssignment, current_user: User = Depends(get_current_user)):
    """Benutzer zu Team/Bezirk zuweisen (nur Admin)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = {}
    if assignment.team_id:
        update_data['patrol_team'] = assignment.team_id
        # User zu Team hinzufügen
        await db.teams.update_one(
            {"id": assignment.team_id},
            {"$addToSet": {"members": assignment.user_id}}
        )
    
    if assignment.district_id:
        update_data['assigned_district'] = assignment.district_id
    
    # Benutzer aktualisieren
    result = await db.users.update_one(
        {"id": assignment.user_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"status": "success", "message": "User assigned successfully"}

@app.get("/api/admin/attendance")
async def get_attendance_list(current_user: User = Depends(get_current_user)):
    """Anwesenheitsliste für Admin abrufen"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    try:
        # Alle Benutzer mit Status und Team-Info laden
        users = await db.users.find().to_list(100)
        attendance_list = []
        
        for user in users:
            # Team-Name abrufen falls zugewiesen
            team_name = "Nicht zugewiesen"
            if user.get("patrol_team"):
                team = await db.teams.find_one({"id": user["patrol_team"]})
                if team:
                    team_name = team["name"]
            
            # Bezirks-Name abrufen falls zugewiesen  
            district_name = "Nicht zugewiesen"
            if user.get("assigned_district"):
                district = await db.districts.find_one({"id": user["assigned_district"]})
                if district:
                    district_name = district["name"]
            
            attendance_list.append({
                "id": user["id"],
                "username": user["username"],
                "status": user.get("status", "Im Dienst"),
                "team": team_name,
                "district": district_name,
                "last_check_in": user.get("last_check_in"),
                "phone": user.get("phone"),
                "service_number": user.get("service_number"),
                "is_online": user.get("status") == "Im Dienst"
            })
        
        return attendance_list
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/admin/team-status")
async def get_team_status(current_user: User = Depends(get_current_user)):
    """Team-Status für Admin abrufen"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    try:
        teams = await db.teams.find().to_list(100)
        team_status_list = []
        
        for team in teams:
            # Team-Mitglieder laden
            members = []
            if team.get("members"):
                for member_id in team["members"]:
                    user = await db.users.find_one({"id": member_id})
                    if user:
                        members.append({
                            "id": user["id"],
                            "username": user["username"],
                            "status": user.get("status", "Im Dienst")
                        })
            
            # Bezirks-Name abrufen
            district_name = "Nicht zugewiesen"
            if team.get("district_id"):
                district = await db.districts.find_one({"id": team["district_id"]})
                if district:
                    district_name = district["name"]
            
            team_status_list.append({
                "id": team["id"],
                "name": team["name"],
                "status": team.get("status", "Einsatzbereit"),
                "district": district_name,
                "members": members,
                "member_count": len(members)
            })
        
        return team_status_list
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/admin/teams/{team_id}/status")
async def update_team_status(team_id: str, status_data: dict, current_user: User = Depends(get_current_user)):
    """Team-Status aktualisieren"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    try:
        new_status = status_data.get("status")
        if new_status not in ["Einsatzbereit", "Im Einsatz", "Pause", "Nicht verfügbar"]:
            raise HTTPException(status_code=400, detail="Invalid status")
        
        result = await db.teams.update_one(
            {"id": team_id},
            {"$set": {"status": new_status}}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Team not found")
        
        return {"status": "success", "message": f"Team status updated to {new_status}"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/admin/vacations/{vacation_id}")
async def handle_vacation_request(vacation_id: str, approval: VacationApproval, current_user: User = Depends(get_current_user)):
    """Urlaubsantrag genehmigen/ablehnen (nur Admin)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = {
        "status": "approved" if approval.action == "approve" else "rejected",
        "approved_by": current_user.id,
        "admin_reason": approval.reason or ""
    }
    
    result = await db.vacations.update_one(
        {"id": vacation_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Vacation request not found")
    
    return {"status": "success", "message": f"Vacation request {approval.action}d"}

@app.get("/api/admin/attendance")
async def get_attendance_list(current_user: User = Depends(get_current_user)):
    """Anwesenheitsliste abrufen (nur Admin)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    users = await db.users.find({"is_active": True}).to_list(100)
    
    attendance_list = []
    for user in users:
        # Team-Info abrufen
        team_info = None
        if user.get('patrol_team'):
            team = await db.teams.find_one({"id": user['patrol_team']})
            team_info = team['name'] if team else None
        
        # Bezirk-Info abrufen
        district_info = None
        if user.get('assigned_district'):
            district = await db.districts.find_one({"id": user['assigned_district']})
            district_info = district['name'] if district else None
        
        attendance_list.append({
            "id": user["id"],
            "username": user["username"],
            "status": user.get("status", "Nicht verfügbar"),
            "team": team_info,
            "district": district_info,
            "last_check_in": user.get("last_check_in"),
            "phone": user.get("phone"),
            "rank": user.get("rank")
        })
    
    return attendance_list

@app.get("/api/admin/team-status")
async def get_team_status(current_user: User = Depends(get_current_user)):
    """Team-Status abrufen (nur Admin)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    teams = await db.teams.find().to_list(100)
    
    team_status_list = []
    for team in teams:
        # Mitglieder-Status prüfen
        member_count = len(team.get('members', []))
        active_members = 0
        
        if team.get('members'):
            active_users = await db.users.find({
                "id": {"$in": team['members']},
                "status": {"$in": ["Im Dienst", "Einsatz", "Streife"]}
            }).to_list(100)
            active_members = len(active_users)
        
        # Team-Status basierend auf aktiven Mitgliedern
        if active_members == 0:
            status = "Nicht verfügbar"
        elif active_members == member_count:
            status = "Einsatzbereit"
        else:
            status = "Teilweise besetzt"
        
        team_status_list.append({
            "id": team["id"],
            "name": team["name"],
            "status": status,
            "total_members": member_count,
            "active_members": active_members,
            "district": team.get("district_id")
        })
    
    return team_status_list

# Include router - MUST be after all endpoint definitions
app.include_router(api_router)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

# Server starten
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="212.227.57.238", port=8001)
