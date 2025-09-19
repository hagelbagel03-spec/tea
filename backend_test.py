#!/usr/bin/env python3
"""
Comprehensive Backend Testing for Stadtwache App
Tests all critical backend APIs and functionalities
"""

import requests
import json
import sys
import os
from datetime import datetime
import uuid

# Get backend URL from environment
BACKEND_URL = os.getenv('EXPO_PUBLIC_BACKEND_URL', 'https://login-repair-40.preview.emergentagent.com')
API_BASE = f"{BACKEND_URL}/api"

# Test credentials
ADMIN_EMAIL = "admin@stadtwache.de"
ADMIN_PASSWORD = "admin123"

class BackendTester:
    def __init__(self):
        self.session = requests.Session()
        self.auth_token = None
        self.current_user = None
        self.test_results = []
        
    def log_result(self, test_name, success, message, details=None):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        result = {
            'test': test_name,
            'success': success,
            'message': message,
            'details': details,
            'timestamp': datetime.now().isoformat()
        }
        self.test_results.append(result)
        print(f"{status}: {test_name} - {message}")
        if details and not success:
            print(f"   Details: {details}")
    
    def make_request(self, method, endpoint, data=None, headers=None):
        """Make HTTP request with error handling"""
        url = f"{API_BASE}{endpoint}"
        
        # Add auth header if token available
        if self.auth_token and headers is None:
            headers = {"Authorization": f"Bearer {self.auth_token}"}
        elif self.auth_token and headers:
            headers["Authorization"] = f"Bearer {self.auth_token}"
            
        try:
            if method.upper() == 'GET':
                response = self.session.get(url, headers=headers)
            elif method.upper() == 'POST':
                response = self.session.post(url, json=data, headers=headers)
            elif method.upper() == 'PUT':
                response = self.session.put(url, json=data, headers=headers)
            elif method.upper() == 'DELETE':
                response = self.session.delete(url, headers=headers)
            else:
                raise ValueError(f"Unsupported method: {method}")
                
            return response
        except Exception as e:
            return None, str(e)
    
    def test_app_config(self):
        """Test app configuration endpoint"""
        print("\n=== Testing App Configuration ===")
        
        response = self.make_request('GET', '/app/config')
        if response and response.status_code == 200:
            try:
                config = response.json()
                self.log_result("App Config", True, "App configuration loaded successfully", config.get('app_name'))
            except:
                self.log_result("App Config", False, "Invalid JSON response")
        else:
            self.log_result("App Config", False, f"Failed to load config: {response.status_code if response else 'No response'}")
    
    def test_authentication(self):
        """Test authentication endpoints"""
        print("\n=== Testing Authentication ===")
        
        # Test login
        login_data = {
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        }
        
        response = self.make_request('POST', '/auth/login', login_data)
        if response and response.status_code == 200:
            try:
                auth_response = response.json()
                self.auth_token = auth_response.get('access_token')
                self.current_user = auth_response.get('user')
                self.log_result("Login", True, f"Login successful for {ADMIN_EMAIL}")
            except:
                self.log_result("Login", False, "Invalid login response format")
        else:
            self.log_result("Login", False, f"Login failed: {response.status_code if response else 'No response'}")
            return False
        
        # Test /auth/me
        response = self.make_request('GET', '/auth/me')
        if response and response.status_code == 200:
            try:
                user_data = response.json()
                self.log_result("Auth Me", True, f"Token validation successful for user: {user_data.get('username')}")
            except:
                self.log_result("Auth Me", False, "Invalid user data response")
        else:
            self.log_result("Auth Me", False, f"Token validation failed: {response.status_code if response else 'No response'}")
        
        # Test registration (create test user)
        test_user_data = {
            "email": f"test_{uuid.uuid4().hex[:8]}@stadtwache.de",
            "username": f"TestUser_{uuid.uuid4().hex[:6]}",
            "password": "testpass123",
            "role": "police"
        }
        
        response = self.make_request('POST', '/auth/register', test_user_data)
        if response and response.status_code == 200:
            self.log_result("Registration", True, f"User registration successful: {test_user_data['username']}")
        else:
            self.log_result("Registration", False, f"Registration failed: {response.status_code if response else 'No response'}")
        
        return True
    
    def test_incidents_management(self):
        """Test incident management endpoints"""
        print("\n=== Testing Incident Management ===")
        
        # Create test incident
        incident_data = {
            "title": "Test Incident - Verkehrsunfall",
            "description": "Testvorfall für Backend-Tests - Verkehrsunfall auf der Hauptstraße",
            "priority": "high",
            "location": {"lat": 51.2879, "lng": 7.2954},
            "address": "Hauptstraße 123, Schwelm",
            "images": []
        }
        
        response = self.make_request('POST', '/incidents', incident_data)
        test_incident_id = None
        
        if response and response.status_code == 200:
            try:
                incident = response.json()
                test_incident_id = incident.get('id')
                self.log_result("Create Incident", True, f"Incident created: {incident.get('title')}")
            except:
                self.log_result("Create Incident", False, "Invalid incident creation response")
        else:
            self.log_result("Create Incident", False, f"Failed to create incident: {response.status_code if response else 'No response'}")
        
        # Get incidents
        response = self.make_request('GET', '/incidents')
        if response and response.status_code == 200:
            try:
                incidents = response.json()
                self.log_result("Get Incidents", True, f"Retrieved {len(incidents)} incidents")
            except:
                self.log_result("Get Incidents", False, "Invalid incidents response")
        else:
            self.log_result("Get Incidents", False, f"Failed to get incidents: {response.status_code if response else 'No response'}")
        
        # Test status actions if we have a test incident
        if test_incident_id:
            # Test assign incident
            response = self.make_request('PUT', f'/incidents/{test_incident_id}/assign')
            if response and response.status_code == 200:
                self.log_result("Assign Incident", True, "Incident assigned successfully")
            else:
                self.log_result("Assign Incident", False, f"Failed to assign incident: {response.status_code if response else 'No response'}")
            
            # Test update incident status
            update_data = {"status": "in_progress"}
            response = self.make_request('PUT', f'/incidents/{test_incident_id}', update_data)
            if response and response.status_code == 200:
                self.log_result("Update Incident Status", True, "Incident status updated to in_progress")
            else:
                self.log_result("Update Incident Status", False, f"Failed to update incident: {response.status_code if response else 'No response'}")
            
            # Test complete incident
            response = self.make_request('PUT', f'/incidents/{test_incident_id}/complete')
            if response and response.status_code == 200:
                self.log_result("Complete Incident", True, "Incident completed and archived")
            else:
                self.log_result("Complete Incident", False, f"Failed to complete incident: {response.status_code if response else 'No response'}")
    
    def test_admin_functions(self):
        """Test admin functionality"""
        print("\n=== Testing Admin Functions ===")
        
        # Test admin stats
        response = self.make_request('GET', '/admin/stats')
        if response and response.status_code == 200:
            try:
                stats = response.json()
                self.log_result("Admin Stats", True, f"Stats retrieved: {stats.get('total_users', 0)} users, {stats.get('total_incidents', 0)} incidents")
            except:
                self.log_result("Admin Stats", False, "Invalid stats response")
        else:
            self.log_result("Admin Stats", False, f"Failed to get admin stats: {response.status_code if response else 'No response'}")
        
        # Test vacation requests (GET)
        response = self.make_request('GET', '/admin/vacations')
        if response and response.status_code == 200:
            try:
                vacations = response.json()
                self.log_result("Get Vacations", True, f"Retrieved {len(vacations)} vacation requests")
            except:
                self.log_result("Get Vacations", False, "Invalid vacations response")
        else:
            # This might not exist yet, so we'll mark as info
            self.log_result("Get Vacations", False, f"Vacation endpoint not found: {response.status_code if response else 'No response'}")
        
        # Test attendance
        response = self.make_request('GET', '/admin/attendance')
        if response and response.status_code == 200:
            try:
                attendance = response.json()
                self.log_result("Get Attendance", True, f"Retrieved attendance data")
            except:
                self.log_result("Get Attendance", False, "Invalid attendance response")
        else:
            self.log_result("Get Attendance", False, f"Attendance endpoint not found: {response.status_code if response else 'No response'}")
        
        # Test team status
        response = self.make_request('GET', '/admin/team-status')
        if response and response.status_code == 200:
            try:
                team_status = response.json()
                self.log_result("Get Team Status", True, f"Retrieved team status data")
            except:
                self.log_result("Get Team Status", False, "Invalid team status response")
        else:
            self.log_result("Get Team Status", False, f"Team status endpoint not found: {response.status_code if response else 'No response'}")
    
    def test_user_management(self):
        """Test user management endpoints"""
        print("\n=== Testing User Management ===")
        
        # Test get users by status
        response = self.make_request('GET', '/users/by-status')
        if response and response.status_code == 200:
            try:
                users_by_status = response.json()
                total_users = sum(len(users) for users in users_by_status.values())
                self.log_result("Users by Status", True, f"Retrieved {total_users} users grouped by status")
            except:
                self.log_result("Users by Status", False, "Invalid users by status response")
        else:
            self.log_result("Users by Status", False, f"Failed to get users by status: {response.status_code if response else 'No response'}")
        
        # Test get all users (admin only)
        response = self.make_request('GET', '/users')
        if response and response.status_code == 200:
            try:
                users = response.json()
                self.log_result("Get All Users", True, f"Retrieved {len(users)} users")
            except:
                self.log_result("Get All Users", False, "Invalid users response")
        else:
            self.log_result("Get All Users", False, f"Failed to get all users: {response.status_code if response else 'No response'}")
    
    def test_messaging(self):
        """Test messaging functionality"""
        print("\n=== Testing Messaging ===")
        
        # Test get messages
        response = self.make_request('GET', '/messages?channel=general')
        if response and response.status_code == 200:
            try:
                messages = response.json()
                self.log_result("Get Messages", True, f"Retrieved {len(messages)} messages from general channel")
            except:
                self.log_result("Get Messages", False, "Invalid messages response")
        else:
            self.log_result("Get Messages", False, f"Failed to get messages: {response.status_code if response else 'No response'}")
        
        # Test send message
        message_data = {
            "content": f"Test message from backend test - {datetime.now().strftime('%H:%M:%S')}",
            "channel": "general",
            "message_type": "text"
        }
        
        response = self.make_request('POST', '/messages', message_data)
        if response and response.status_code == 200:
            self.log_result("Send Message", True, "Message sent successfully")
        else:
            self.log_result("Send Message", False, f"Failed to send message: {response.status_code if response else 'No response'}")
    
    def test_additional_endpoints(self):
        """Test additional endpoints"""
        print("\n=== Testing Additional Endpoints ===")
        
        # Test districts
        response = self.make_request('GET', '/districts')
        if response and response.status_code == 200:
            try:
                districts = response.json()
                self.log_result("Get Districts", True, f"Retrieved {len(districts)} districts")
            except:
                self.log_result("Get Districts", False, "Invalid districts response")
        else:
            self.log_result("Get Districts", False, f"Failed to get districts: {response.status_code if response else 'No response'}")
        
        # Test teams
        response = self.make_request('GET', '/teams')
        if response and response.status_code == 200:
            try:
                teams = response.json()
                self.log_result("Get Teams", True, f"Retrieved {len(teams)} teams")
            except:
                self.log_result("Get Teams", False, "Invalid teams response")
        else:
            self.log_result("Get Teams", False, f"Failed to get teams: {response.status_code if response else 'No response'}")
        
        # Test online users
        response = self.make_request('GET', '/users/online')
        if response and response.status_code == 200:
            try:
                online_users = response.json()
                self.log_result("Get Online Users", True, f"Retrieved {len(online_users)} online users")
            except:
                self.log_result("Get Online Users", False, "Invalid online users response")
        else:
            self.log_result("Get Online Users", False, f"Failed to get online users: {response.status_code if response else 'No response'}")
    
    def run_all_tests(self):
        """Run all backend tests"""
        print(f"🚀 Starting Backend Tests for Stadtwache App")
        print(f"Backend URL: {BACKEND_URL}")
        print(f"API Base: {API_BASE}")
        print("=" * 60)
        
        # Test basic connectivity
        try:
            response = self.make_request('GET', '/')
            if response and response.status_code == 200:
                print("✅ Backend connectivity confirmed")
            else:
                print("❌ Backend connectivity failed")
                return
        except:
            print("❌ Cannot connect to backend")
            return
        
        # Run test suites
        self.test_app_config()
        
        if self.test_authentication():
            self.test_incidents_management()
            self.test_admin_functions()
            self.test_user_management()
            self.test_messaging()
            self.test_additional_endpoints()
        
        # Summary
        print("\n" + "=" * 60)
        print("🏁 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for r in self.test_results if r['success'])
        failed = sum(1 for r in self.test_results if not r['success'])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        print(f"Success Rate: {(passed/total*100):.1f}%")
        
        # Show failed tests
        if failed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result['success']:
                    print(f"  - {result['test']}: {result['message']}")
        
        print("\n🎯 CRITICAL STATUS ACTIONS TESTS:")
        critical_tests = ['Assign Incident', 'Update Incident Status', 'Complete Incident']
        for test_name in critical_tests:
            result = next((r for r in self.test_results if r['test'] == test_name), None)
            if result:
                status = "✅" if result['success'] else "❌"
                print(f"  {status} {test_name}: {result['message']}")
            else:
                print(f"  ⚠️  {test_name}: Not tested")

if __name__ == "__main__":
    tester = BackendTester()
    tester.run_all_tests()