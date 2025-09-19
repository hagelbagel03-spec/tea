import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';

interface DiscordMessagesProps {
  user: any;
  token: string; 
  selectedChannel: string;
  theme?: any;
  usersByStatus?: any; // Add usersByStatus prop
}

const DiscordMessages: React.FC<DiscordMessagesProps> = ({ user, token, selectedChannel, theme, usersByStatus }) => {
  const colors = theme?.colors || {
    primary: '#1E3A8A',
    background: '#F3F4F6',
    surface: '#FFFFFF',
    text: '#111827',
    textSecondary: '#374151',
    textMuted: '#6B7280',
    border: '#E5E7EB',
    success: '#10B981',
  };

  // Simple states
  const [currentView, setCurrentView] = useState<'channels' | 'userList' | 'chat'>('channels');
  const [selectedChannelId, setSelectedChannelId] = useState('allgemein');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const [unreadMessages, setUnreadMessages] = useState<{[key: string]: number}>({});
  const [socket, setSocket] = useState<Socket | null>(null);

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

  // Initialize Socket.IO connection
  useEffect(() => {
    if (!token) return;

    const socketInstance = io(API_URL, {
      auth: {
        token: token
      },
      transports: ['websocket', 'polling']
    });

    socketInstance.on('connect', () => {
      console.log('🔗 Socket connected:', socketInstance.id);
      if (user?.id) {
        socketInstance.emit('join_user_room', user.id);
      }
    });

    socketInstance.on('disconnect', () => {
      console.log('🔌 Socket disconnected');
    });

    // Listen for new messages
    socketInstance.on('new_message', (messageData) => {
      console.log('📩 New message received:', messageData);
      
      // If we're in the same channel/chat, add message immediately
      if (currentView === 'chat' && selectedUser?.id === messageData.sender_id) {
        setMessages(prev => [...prev, { ...messageData, isOwn: false }]);
      } else if (currentView === 'channels' && selectedChannelId === messageData.channel) {
        setMessages(prev => [...prev, { ...messageData, isOwn: false }]);
      } else {
        // Update unread count
        const senderId = messageData.sender_id;
        setUnreadMessages(prev => ({
          ...prev,
          [senderId]: (prev[senderId] || 0) + 1
        }));
      }
    });

    // Listen for user status updates
    socketInstance.on('user_status_update', (userData) => {
      console.log('👤 User status updated:', userData);
      // Could update user status in real-time here
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [token, user?.id]);

  // Join channel room when switching channels
  useEffect(() => {
    if (socket && currentView === 'channels') {
      socket.emit('join_channel', selectedChannelId);
      console.log('🏠 Joined channel:', selectedChannelId);
    }
  }, [socket, currentView, selectedChannelId]);

  // Join private room when starting private chat
  useEffect(() => {
    if (socket && currentView === 'chat' && selectedUser) {
      socket.emit('join_private_room', {
        user1: user?.id,
        user2: selectedUser.id
      });
      console.log('💬 Joined private room with:', selectedUser.username);
    }
  }, [socket, currentView, selectedUser, user?.id]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollViewRef.current && messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  // Load messages when component mounts or view changes
  React.useEffect(() => {
    loadMessages();
  }, [currentView, selectedChannelId, selectedUser]);

  const loadMessages = async () => {
    if (!token) return;
    
    setLoading(true);
    try {
      const config = {
        headers: { Authorization: `Bearer ${token}` }
      };

      let response;
      if (currentView === 'chat' && selectedUser) {
        // Load private messages
        response = await axios.get(`${API_URL}/api/messages/private`, config);
        // Filter for this specific conversation
        const filteredMessages = response.data.filter(msg => 
          (msg.sender_id === selectedUser.id && msg.recipient_id === user?.id) ||
          (msg.sender_id === user?.id && msg.recipient_id === selectedUser.id)
        ).map(msg => ({
          ...msg,
          isOwn: msg.sender_id === user?.id
        }));
        setMessages(filteredMessages);
      } else {
        // Load channel messages
        response = await axios.get(`${API_URL}/api/messages?channel=${selectedChannelId}`, config);
        const channelMessages = response.data.map(msg => ({
          ...msg,
          isOwn: msg.sender_id === user?.id
        }));
        setMessages(channelMessages);
      }
      
      console.log('✅ Messages loaded:', response.data.length);
    } catch (error) {
      console.error('❌ Error loading messages:', error);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  // Simple channels
  const channels = [
    { id: 'allgemein', name: 'allgemein', icon: 'chatbubbles', color: '#5865F2' },
    { id: 'streife', name: 'streife', icon: 'car-sport', color: '#57F287' },
    { id: 'dienst', name: 'dienst', icon: 'shield-checkmark', color: '#FEE75C' },
  ];

  // Get real users from usersByStatus prop - with safety checks
  const users = React.useMemo(() => {
    if (!usersByStatus || typeof usersByStatus !== 'object') {
      console.log('⚠️ usersByStatus is not available or not an object');
      return [];
    }
    
    try {
      const allUsers = [];
      Object.entries(usersByStatus).forEach(([status, statusUsers]) => {
        if (Array.isArray(statusUsers)) {
          statusUsers.forEach((statusUser) => {
            if (statusUser && statusUser.id && statusUser.username) {
              allUsers.push({
                id: statusUser.id,
                username: statusUser.username,
                role: statusUser.rank || statusUser.role || 'Beamter',
                status: statusUser.is_online ? 'online' : 'offline',
                avatar: statusUser.username.charAt(0).toUpperCase() + (statusUser.username.split(' ')[1]?.[0] || '').toUpperCase(),
                department: statusUser.department || '',
                service_number: statusUser.service_number || ''
              });
            }
          });
        }
      });
      
      // Remove current user from list
      const filteredUsers = allUsers.filter(u => u.id !== user?.id);
      console.log('👥 Processed users for chat:', filteredUsers.length);
      return filteredUsers;
    } catch (error) {
      console.error('❌ Error processing users:', error);
      return [];
    }
  }, [usersByStatus, user]);

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    
    const messageToSend = newMessage.trim();
    setNewMessage('');
    setSending(true);

    try {
      const config = token ? {
        headers: { Authorization: `Bearer ${token}` }
      } : {};

      let messageData;
      
      if (currentView === 'chat' && selectedUser) {
        // Private message
        messageData = {
          content: messageToSend,
          recipient_id: selectedUser.id,
          channel: "private",
          message_type: "text"
        };
      } else {
        // Channel message
        messageData = {
          content: messageToSend,
          channel: selectedChannelId,
          message_type: "text"
        };
      }

      // Send to real backend
      const response = await axios.post(`${API_URL}/api/messages`, messageData, config);
      
      // Also emit via socket for real-time delivery
      if (socket) {
        socket.emit('send_message', {
          ...messageData,
          id: response.data.id || Date.now().toString(),
          sender_name: user?.username || 'Du',
          sender_id: user?.id || 'test-user',
          created_at: new Date().toISOString()
        });
      }
      
      // Add message locally for immediate feedback
      const newMsg = {
        id: response.data.id || Date.now().toString(),
        content: messageToSend,
        sender_name: user?.username || 'Du',
        sender_id: user?.id || 'test-user',
        created_at: new Date().toISOString(),
        isOwn: true
      };
      
      setMessages(prev => [...prev, newMsg]);
      
      console.log('✅ Message sent successfully');

    } catch (error) {
      console.error('❌ Error sending message:', error);
      setNewMessage(messageToSend); // Restore message on error
    } finally {
      setSending(false);
    }
  };

  // Channel List View
  if (currentView === 'channels') {
    return (
      <View style={styles.container}>
        <View style={styles.discordHeader}>
          <Text style={styles.serverName}>🏢 Stadtwache Schwelm</Text>
        </View>
        
        <View style={styles.channelSection}>
          <Text style={styles.sectionTitle}>TEXT CHANNELS</Text>
          
          {channels.map((channel) => (
            <TouchableOpacity
              key={channel.id}
              style={[
                styles.channelItem,
                selectedChannelId === channel.id && styles.channelItemActive
              ]}
              onPress={() => {
                setSelectedChannelId(channel.id);
                setMessages([]); // Clear messages
              }}
            >
              <Ionicons 
                name={channel.icon as any}
                size={20} 
                color={selectedChannelId === channel.id ? '#FFFFFF' : '#8E9297'}
                style={{ marginRight: 8 }}
              />
              <Text style={[
                styles.channelName,
                selectedChannelId === channel.id && styles.channelNameActive
              ]}>
                # {channel.name}
              </Text>
            </TouchableOpacity>
          ))}
          
          <TouchableOpacity
            style={styles.userButton}
            onPress={() => setCurrentView('userList')}
          >
            <Ionicons name="person-add" size={20} color="#FFFFFF" />
            <Text style={styles.userButtonText}>Benutzer schreiben</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.chatArea}>
          <View style={styles.chatHeader}>
            <Text style={styles.chatHeaderText}>
              # {channels.find(ch => ch.id === selectedChannelId)?.name}
            </Text>
          </View>
          
          <ScrollView style={styles.messagesArea} ref={scrollViewRef}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#5865F2" />
                <Text style={styles.loadingText}>Laden...</Text>
              </View>
            ) : messages.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  Noch keine Nachrichten in #{channels.find(ch => ch.id === selectedChannelId)?.name}
                </Text>
              </View>
            ) : (
              messages.map((message) => (
                <View key={message.id} style={[
                  styles.messageContainer,
                  message.isOwn ? styles.ownMessage : styles.otherMessage
                ]}>
                  {!message.isOwn && (
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {message.sender_name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  
                  <View style={[
                    styles.messageBubble,
                    message.isOwn ? styles.ownBubble : styles.otherBubble
                  ]}>
                    {!message.isOwn && (
                      <Text style={styles.senderName}>{message.sender_name}</Text>
                    )}
                    <Text style={[
                      styles.messageText,
                      message.isOwn ? styles.ownText : styles.otherText
                    ]}>
                      {message.content}
                    </Text>
                  </View>
                  
                  {message.isOwn && (
                    <View style={styles.ownAvatar}>
                      <Text style={styles.avatarText}>ME</Text>
                    </View>
                  )}
                </View>
              ))
            )}
          </ScrollView>
          
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.messageInput}
              value={newMessage}
              onChangeText={setNewMessage}
              placeholder={`Nachricht in #${channels.find(ch => ch.id === selectedChannelId)?.name}...`}
              placeholderTextColor="#72767D"
              multiline
              editable={!sending}
            />
            <TouchableOpacity
              style={[styles.sendButton, { opacity: !newMessage.trim() ? 0.5 : 1 }]}
              onPress={sendMessage}
              disabled={!newMessage.trim() || sending}
            >
              <Ionicons name="send" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // User List View
  if (currentView === 'userList') {
    return (
      <View style={styles.container}>
        <View style={styles.userHeader}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => setCurrentView('channels')}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.userHeaderText}>Benutzer auswählen</Text>
        </View>
        
        <ScrollView style={{ flex: 1 }}>
          {users.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                Keine registrierten Benutzer gefunden
              </Text>
              <Text style={[styles.emptyText, { fontSize: 14, marginTop: 8 }]}>
                Benutzer werden geladen...
              </Text>
            </View>
          ) : (
            users.map((user) => (
              <TouchableOpacity
                key={user.id}
                style={styles.userItem}
                onPress={() => {
                  setSelectedUser(user);
                  setCurrentView('chat');
                  setMessages([]); // Clear messages
                  // Clear unread count for this user
                  setUnreadMessages(prev => ({ ...prev, [user.id]: 0 }));
                }}
              >
                <View style={styles.userAvatar}>
                  <Text style={styles.avatarText}>{user.avatar}</Text>
                  {(unreadMessages[user.id] || 0) > 0 && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadBadgeText}>
                        {unreadMessages[user.id] > 99 ? '99+' : unreadMessages[user.id]}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{user.username}</Text>
                  <Text style={styles.userRole}>{user.role}</Text>
                </View>
                <View style={styles.userStatus}>
                  <View style={[styles.statusDot, { 
                    backgroundColor: user.status === 'online' ? '#23A55A' : 
                                    user.status === 'away' ? '#F0B232' :
                                    user.status === 'busy' ? '#F23F43' : '#80848E'
                  }]} />
                  <Text style={styles.statusText}>
                    {user.status === 'online' ? 'Online' : 
                     user.status === 'away' ? 'Abwesend' :
                     user.status === 'busy' ? 'Beschäftigt' : 'Offline'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </View>
    );
  }

  // Direct Message View
  return (
    <View style={styles.container}>
      <View style={styles.dmHeader}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => setCurrentView('userList')}
        >
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.dmHeaderText}>@ {selectedUser?.username}</Text>
      </View>
      
      <ScrollView style={styles.messagesArea} ref={scrollViewRef}>
        {messages.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              Noch keine Nachrichten mit {selectedUser?.username}
            </Text>
          </View>
        ) : (
          messages.map((message) => (
            <View key={message.id} style={[
              styles.messageContainer,
              message.isOwn ? styles.ownMessage : styles.otherMessage
            ]}>
              {!message.isOwn && (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{selectedUser?.avatar}</Text>
                </View>
              )}
              
              <View style={[
                styles.messageBubble,
                message.isOwn ? styles.ownBubble : styles.otherBubble
              ]}>
                <Text style={[
                  styles.messageText,
                  message.isOwn ? styles.ownText : styles.otherText
                ]}>
                  {message.content}
                </Text>
              </View>
              
              {message.isOwn && (
                <View style={styles.ownAvatar}>
                  <Text style={styles.avatarText}>ME</Text>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>
      
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.messageInput}
          value={newMessage}
          onChangeText={setNewMessage}
          placeholder={`Nachricht an ${selectedUser?.username}...`}
          placeholderTextColor="#72767D"
          multiline
          editable={!sending}
        />
        <TouchableOpacity
          style={[styles.sendButton, { opacity: !newMessage.trim() ? 0.5 : 1 }]}
          onPress={sendMessage}
          disabled={!newMessage.trim() || sending}
        >
          <Ionicons name="send" size={16} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#36393F',
  },
  discordHeader: {
    backgroundColor: '#202225',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#40444B',
  },
  serverName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  channelSection: {
    paddingHorizontal: 8,
    paddingVertical: 16,
    backgroundColor: '#2F3136',
    flex: 1,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E9297',
    marginBottom: 8,
    marginLeft: 8,
  },
  channelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 4,
    marginBottom: 2,
  },
  channelItemActive: {
    backgroundColor: '#393C43',
  },
  channelName: {
    fontSize: 16,
    color: '#8E9297',
    flex: 1,
  },
  channelNameActive: {
    color: '#FFFFFF',
  },
  userButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#5865F2',
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  userButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  chatArea: {
    flex: 2,
    backgroundColor: '#36393F',
  },
  chatHeader: {
    backgroundColor: '#36393F',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#40444B',
  },
  chatHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  userHeader: {
    backgroundColor: '#202225',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#40444B',
    flexDirection: 'row',
    alignItems: 'center',
  },
  dmHeader: {
    backgroundColor: '#202225',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#40444B',
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 16,
    padding: 4,
  },
  userHeaderText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  dmHeaderText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#40444B',
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#5865F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    position: 'relative',
  },
  unreadBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#F23F43',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#36393F',
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  userRole: {
    fontSize: 12,
    color: '#B9BBBE',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  userStatus: {
    alignItems: 'flex-end',
  },
  statusText: {
    fontSize: 12,
    color: '#B9BBBE',
    marginTop: 4,
  },
  messagesArea: {
    flex: 1,
    paddingHorizontal: 16,
  },
  messageContainer: {
    marginVertical: 4,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  ownMessage: {
    justifyContent: 'flex-end',
    alignSelf: 'flex-end',
  },
  otherMessage: {
    justifyContent: 'flex-start',
    alignSelf: 'flex-start',
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#5865F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  ownAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#00B4D8',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  messageBubble: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    maxWidth: '70%',
  },
  ownBubble: {
    backgroundColor: '#0078FF',
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: '#404449',
    borderBottomLeftRadius: 4,
  },
  senderName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 18,
  },
  ownText: {
    color: '#FFFFFF',
  },
  otherText: {
    color: '#DCDDDE',
  },
  inputContainer: {
    backgroundColor: '#40444B',
    margin: 16,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  messageInput: {
    flex: 1,
    fontSize: 14,
    color: '#DCDDDE',
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#5865F2',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    color: '#B9BBBE',
    marginTop: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 32,
  },
  emptyText: {
    color: '#8E9297',
    fontSize: 16,
    textAlign: 'center',
  },
});

export default DiscordMessages;