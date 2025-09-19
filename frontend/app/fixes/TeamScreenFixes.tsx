// Team Screen Fixes - Enhanced with Chat Popup and Add User Button
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';

interface TeamScreenFixesProps {
  user: any;
  token: string;
}

const TeamScreenFixes: React.FC<TeamScreenFixesProps> = ({ user, token }) => {
  const [usersByStatus, setUsersByStatus] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [selectedOfficer, setSelectedOfficer] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  
  const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

  useEffect(() => {
    loadUsersByStatus();
  }, []);

  const loadUsersByStatus = async () => {
    try {
      const config = token ? {
        headers: { Authorization: `Bearer ${token}` }
      } : {};
      
      const response = await axios.get(`${API_URL}/api/users/by-status`, config);
      setUsersByStatus(response.data);
    } catch (error) {
      console.error('Error loading users by status:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadUsersByStatus();
  };

  const openChatWith = async (officer) => {
    setSelectedOfficer(officer);
    setShowChatModal(true);
    
    // Load existing private messages between current user and selected officer
    try {
      const config = token ? {
        headers: { Authorization: `Bearer ${token}` },
        params: { 
          channel: `private_${Math.min(user.id, officer.id)}_${Math.max(user.id, officer.id)}`,
          private: true 
        }
      } : {};
      
      const response = await axios.get(`${API_URL}/api/messages`, config);
      const formattedMessages = response.data.map(msg => ({
        id: msg.id,
        text: msg.content,
        sender: msg.sender_name,
        sender_id: msg.sender_id,
        time: new Date(msg.created_at).toLocaleTimeString('de-DE'),
        isOwn: msg.sender_id === user?.id
      }));
      
      setChatMessages(formattedMessages);
    } catch (error) {
      console.error('Error loading chat messages:', error);
      setChatMessages([
        {
          id: '1',
          text: `Chat geöffnet mit ${officer.username}`,
          sender: 'System',
          time: new Date().toLocaleTimeString('de-DE')
        }
      ]);
    }
  };

  const sendChatMessage = async () => {
    if (!newMessage.trim()) return;
    
    try {
      const config = token ? {
        headers: { Authorization: `Bearer ${token}` }
      } : {};
      
      // Send private message using a private channel
      const privateChannel = `private_${Math.min(user.id, selectedOfficer.id)}_${Math.max(user.id, selectedOfficer.id)}`;
      
      await axios.post(`${API_URL}/api/messages`, {
        content: newMessage.trim(),
        channel: privateChannel,
        recipient_id: selectedOfficer.id,
        private: true
      }, config);
      
      // Add message to local state immediately
      const message = {
        id: Date.now().toString(),
        text: newMessage.trim(),
        sender: user?.username || 'Sie',
        sender_id: user?.id,
        time: new Date().toLocaleTimeString('de-DE'),
        isOwn: true
      };
      
      setChatMessages(prev => [...prev, message]);
      setNewMessage('');
      
      // Show confirmation
      Alert.alert('Erfolg', `Nachricht an ${selectedOfficer.username} gesendet!`);
      
    } catch (error) {
      console.error('Error sending chat message:', error);
      Alert.alert('Fehler', 'Nachricht konnte nicht gesendet werden');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Im Dienst': return '#10B981';
      case 'Beschäftigt': return '#F59E0B';
      case 'Pause': return '#6B7280';
      case 'Nicht im Dienst': return '#EF4444';
      default: return '#9CA3AF';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Im Dienst': return 'checkmark-circle';
      case 'Beschäftigt': return 'time';
      case 'Pause': return 'pause-circle';
      case 'Nicht im Dienst': return 'close-circle';
      default: return 'help-circle';
    }
  };

  return (
    <View style={styles.container}>
      {/* Header mit Add User Button */}
      <View style={styles.teamHeader}>
        <Text style={styles.screenTitle}>👥 Team & Streifendienst</Text>
        <View style={styles.teamHeaderActions}>
          {user?.role === 'admin' && (
            <TouchableOpacity 
              style={styles.addUserButton}
              onPress={() => setShowAddUser(true)}
            >
              <Ionicons name="person-add" size={20} color="#1E3A8A" />
              <Text style={styles.addUserButtonText}>Benutzer hinzufügen</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onRefresh}>
            <Ionicons name="refresh" size={24} color="#1E3A8A" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Team Status Liste */}
      <ScrollView 
        style={styles.teamList} 
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {Object.entries(usersByStatus).map(([status, users]) => (
          <View key={status} style={styles.statusGroup}>
            <View style={styles.statusHeader}>
              <Ionicons 
                name={getStatusIcon(status)} 
                size={20} 
                color={getStatusColor(status)} 
              />
              <Text style={styles.statusTitle}>{status}</Text>
              <View style={styles.statusCount}>
                <Text style={styles.statusCountText}>{users.length}</Text>
              </View>
            </View>
            
            {users.map((officer) => (
              <View key={officer.id} style={styles.officerCard}>
                <View style={styles.officerInfo}>
                  <Text style={styles.officerName}>{officer.username}</Text>
                  <Text style={styles.officerDetails}>
                    {officer.department} • {officer.rank || 'Beamter'}
                  </Text>
                  <Text style={styles.officerBadge}>
                    Dienstnummer: {officer.badge_number || 'N/A'}
                  </Text>
                </View>
                
                <View style={styles.officerActions}>
                  <TouchableOpacity 
                    style={styles.chatButton}
                    onPress={() => openChatWith(officer)}
                  >
                    <Ionicons name="chatbubbles" size={20} color="#1E3A8A" />
                    <Text style={styles.chatButtonText}>Chat</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        ))}
        
        {Object.keys(usersByStatus).length === 0 && !loading && (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color="#9CA3AF" />
            <Text style={styles.emptyText}>Keine Teammitglieder gefunden</Text>
          </View>
        )}
      </ScrollView>

      {/* Chat Modal */}
      <Modal
        visible={showChatModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowChatModal(false)}
      >
        <View style={styles.chatModal}>
          <View style={styles.chatHeader}>
            <TouchableOpacity onPress={() => setShowChatModal(false)}>
              <Ionicons name="close" size={24} color="#1E3A8A" />
            </TouchableOpacity>
            <Text style={styles.chatTitle}>
              💬 Chat mit {selectedOfficer?.username}
            </Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.chatMessages}>
            {chatMessages.map((msg) => (
              <View key={msg.id} style={[
                styles.chatMessage,
                msg.sender === 'System' ? styles.systemMessage : 
                msg.isOwn ? styles.ownMessage : styles.otherMessage
              ]}>
                <Text style={styles.chatSender}>{msg.sender}</Text>
                <Text style={styles.chatText}>{msg.text}</Text>
                <Text style={styles.chatTime}>{msg.time}</Text>
              </View>
            ))}
          </ScrollView>

          <View style={styles.chatInput}>
            <TextInput
              style={styles.messageInput}
              value={newMessage}
              onChangeText={setNewMessage}
              placeholder="Nachricht eingeben..."
              multiline
            />
            <TouchableOpacity 
              style={styles.sendButton} 
              onPress={sendChatMessage}
              disabled={!newMessage.trim()}
            >
              <Ionicons 
                name="send" 
                size={20} 
                color={newMessage.trim() ? '#1E3A8A' : '#9CA3AF'} 
              />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  teamHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  teamHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  addUserButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF4FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addUserButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E3A8A',
    marginLeft: 4,
  },
  teamList: {
    flex: 1,
    padding: 16,
  },
  statusGroup: {
    marginBottom: 20,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 8,
    flex: 1,
  },
  statusCount: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusCountText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  officerCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  officerInfo: {
    flex: 1,
  },
  officerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  officerDetails: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 2,
  },
  officerBadge: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  officerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF4FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  chatButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E3A8A',
    marginLeft: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
    marginTop: 16,
  },
  // Chat Modal Styles
  chatModal: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  chatTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  chatMessages: {
    flex: 1,
    padding: 16,
  },
  chatMessage: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  systemMessage: {
    backgroundColor: '#F3F4F6',
  },
  ownMessage: {
    backgroundColor: '#EBF4FF',
    alignSelf: 'flex-end',
    marginLeft: 20,
  },
  otherMessage: {
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
    marginRight: 20,
  },
  chatSender: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E3A8A',
    marginBottom: 4,
  },
  chatText: {
    fontSize: 14,
    color: '#111827',
    marginBottom: 4,
  },
  chatTime: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  chatInput: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  messageInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 16,
    maxHeight: 100,
    backgroundColor: '#F9FAFB',
  },
  sendButton: {
    marginLeft: 8,
    padding: 8,
  },
});

export default TeamScreenFixes;