import React, { useState, useEffect, useRef, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';

const { width } = Dimensions.get('window');

// Theme context from index.tsx
const ThemeContext = React.createContext();

// Theme context from main app
const useTheme = () => {
  // Try to get context from parent
  const context = useContext(ThemeContext);
  if (context) {
    return context;
  }
  
  // Fallback theme if context is not available
  return {
    colors: {
      primary: '#1E3A8A',
      background: '#F3F4F6',
      surface: '#FFFFFF',
      card: '#FFFFFF',
      text: '#111827',
      textSecondary: '#374151',
      textMuted: '#6B7280',
      border: '#E5E7EB',
      error: '#EF4444',
      success: '#10B981',
      shadow: 'rgba(0, 0, 0, 0.1)',
    },
    isDarkMode: false,
  };
};

interface Message {
  id: string;
  content: string;
  sender_name: string;
  sender_role?: string;
  sender_id: string;
  created_at: string;
  channel: string;
}

interface User {
  id: string;
  username: string;
  role?: string;
}

interface RealTimeMessagesProps {
  user: User;
  token: string;
  selectedChannel: string;
}

const RealTimeMessages: React.FC<RealTimeMessagesProps> = ({ user, token, selectedChannel }) => {
  const { colors, isDarkMode } = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [currentChannel, setCurrentChannel] = useState(selectedChannel);
  const scrollViewRef = useRef<ScrollView>(null);
  
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
  // Channel options with modern icons
  const channels = [
    { key: 'general', label: 'Allgemein', icon: 'chatbubbles', color: '#3B82F6' },
    { key: 'emergency', label: 'Notfall', icon: 'warning', color: '#EF4444' },
    { key: 'patrol', label: 'Streife', icon: 'car-sport', color: '#8B5CF6' },
    { key: 'admin', label: 'Admin', icon: 'shield-checkmark', color: '#059669' }
  ];

  useEffect(() => {
    loadMessages();
    const interval = setInterval(() => loadMessages(true), 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, [currentChannel]);

  useEffect(() => {
    setCurrentChannel(selectedChannel);
  }, [selectedChannel]);

  const loadMessages = async (isPolling = false) => {
    try {
      if (!isPolling) setLoading(true);
      
      const config = token ? {
        headers: { Authorization: `Bearer ${token}` },
        params: { channel: currentChannel }
      } : { params: { channel: currentChannel } };

      console.log(`📥 Loading messages for channel: ${currentChannel}`);
      const response = await axios.get(`${API_URL}/api/messages`, config);
      
      console.log(`✅ Loaded ${response.data.length} messages for ${currentChannel}`);
      
      const serverMessages = response.data.map((msg: any) => ({
        id: msg.id,
        content: msg.content,
        sender_name: msg.sender_name || 'Unbekannt',
        sender_role: 'police',
        sender_id: msg.sender_id,
        created_at: msg.created_at,
        channel: msg.channel
      }));
      
      setMessages(serverMessages);
      
      // Nur scrollen wenn am Ende der Liste (keine störende Auto-Scroll)
      if (isPolling && serverMessages.length > messages.length) {
        // Nur scrollen wenn User nicht scrollt
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: false });
        }, 50);
      }
    } catch (error) {
      console.error('❌ Error loading messages:', error);
      if (!isPolling) {
        setMessages([]);
        if (error.message?.includes('Network Error')) {
          Alert.alert('🔌 Verbindungsfehler', 'Keine Verbindung zum Server möglich');
        }
      }
    } finally {
      if (!isPolling) setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    
    const messageToSend = newMessage.trim();
    setNewMessage('');
    setSending(true);

    try {
      const config = token ? {
        headers: { Authorization: `Bearer ${token}` }
      } : {};

      const messageData = {
        content: messageToSend,
        channel: currentChannel
      };

      console.log('📤 Sending message:', messageData);

      const response = await axios.post(`${API_URL}/api/messages`, messageData, config);
      
      console.log('✅ Message sent successfully:', response.data);
      
      // Reload messages to show the new one
      await loadMessages();
      
      // Scroll to bottom after sending
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);

    } catch (error) {
      console.error('❌ Error sending message:', error);
      
      // Restore message on error
      setNewMessage(messageToSend);
      
      let errorMessage = 'Nachricht konnte nicht gesendet werden';
      if (error.message?.includes('Network Error')) {
        errorMessage = 'Keine Verbindung zum Server';
      } else if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      }
      
      Alert.alert('📤 Sendefehler', errorMessage);
    } finally {
      setSending(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMessages();
    setRefreshing(false);
  };

  const formatTime = (dateString: string | undefined | null) => {
    if (!dateString) {
      // Fallback auf aktuelles Datum
      return 'Jetzt';
    }
    
    let date: Date;
    
    // Verschiedene Datums-Formate probieren
    if (typeof dateString === 'string') {
      // ISO String probieren
      date = new Date(dateString);
      
      // Falls ungültig, andere Formate probieren
      if (isNaN(date.getTime())) {
        // Unix Timestamp probieren (falls es ein String mit Zahlen ist)
        const timestamp = parseInt(dateString);
        if (!isNaN(timestamp)) {
          date = new Date(timestamp);
        } else {
          // Fallback
          console.warn('Invalid date string:', dateString);
          return 'Jetzt';
        }
      }
    } else {
      return 'Jetzt';
    }
    
    // Final check
    if (isNaN(date.getTime())) {
      return 'Jetzt';
    }
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Gerade eben';
    if (diffMins < 60) return `vor ${diffMins}m`;
    if (diffHours < 24) return `vor ${diffHours}h`;
    if (diffDays < 7) return `vor ${diffDays}d`;
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  };

  const isMyMessage = (senderId: string) => senderId === user?.id;

  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    
    // Modern Channel Tabs
    channelTabs: {
      flexDirection: 'row',
      backgroundColor: colors.background,
      paddingHorizontal: 16,
      paddingVertical: 16,
      borderBottomWidth: 2,
      borderBottomColor: colors.border,
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 6,
    },
    channelTab: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 18,
      marginRight: 8,
      backgroundColor: '#F8F9FA',
      borderWidth: 1.5,
      borderColor: '#E9ECEF',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 2,
      minWidth: 70,
      justifyContent: 'center',
    },
    channelTabActive: {
      backgroundColor: '#007AFF',
      borderColor: '#007AFF',
      shadowColor: '#007AFF',
      shadowOpacity: 0.25,
      elevation: 4,
      transform: [{ scale: 1.02 }],
    },
    channelIcon: {
      marginRight: 4,
    },
    channelTabText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#495057',
      textAlign: 'center',
      letterSpacing: 0.3,
    },
    channelTabTextActive: {
      color: '#FFFFFF',
      fontWeight: '700',
    },

    // Messages Area
    messagesContainer: {
      flex: 1,
    },
    messagesList: {
      flex: 1,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    
    // Message Bubbles
    messageContainer: {
      marginBottom: 16,
      maxWidth: '85%',
    },
    myMessageContainer: {
      alignSelf: 'flex-end',
    },
    otherMessageContainer: {
      alignSelf: 'flex-start',
    },
    messageBubble: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 20,
      position: 'relative',
    },
    myMessageBubble: {
      backgroundColor: colors.primary,
      borderBottomRightRadius: 6,
    },
    otherMessageBubble: {
      backgroundColor: colors.surface,
      borderBottomLeftRadius: 6,
      borderWidth: 1,
      borderColor: colors.border,
    },
    messageContent: {
      fontSize: 16,
      lineHeight: 22,
    },
    myMessageContent: {
      color: '#FFFFFF',
    },
    otherMessageContent: {
      color: colors.text,
    },
    messageHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },
    senderName: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primary,
      marginBottom: 2,
    },
    messageTime: {
      fontSize: 12,
      opacity: 0.7,
      marginTop: 4,
    },
    myMessageTime: {
      color: 'rgba(255, 255, 255, 0.8)',
      textAlign: 'right',
    },
    otherMessageTime: {
      color: colors.textMuted,
    },

    // Empty State
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 40,
    },
    emptyIcon: {
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 8,
    },
    emptyText: {
      fontSize: 16,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 24,
    },

    // Input Area
    inputContainer: {
      backgroundColor: colors.surface,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      elevation: 8,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 12,
    },
    inputWrapper: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 24,
      borderWidth: 2,
      borderColor: colors.border,
      paddingHorizontal: 16,
      paddingVertical: 8,
      maxHeight: 120,
    },
    inputWrapperFocused: {
      borderColor: colors.primary,
    },
    textInput: {
      fontSize: 16,
      color: colors.text,
      maxHeight: 100,
      minHeight: 20,
    },
    sendButton: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 4,
    },
    sendButtonDisabled: {
      backgroundColor: colors.textMuted,
    },
    
    // Loading State
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
    },
    loadingText: {
      marginTop: 16,
      fontSize: 16,
      color: colors.textMuted,
      fontWeight: '600',
    },

    // Channel Header Info
    channelInfo: {
      backgroundColor: colors.primary + '15',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    channelInfoText: {
      fontSize: 13,
      color: colors.text,
      textAlign: 'center',
      fontWeight: '500',
    },
  });

  const getCurrentChannelInfo = () => {
    const channel = channels.find(ch => ch.key === currentChannel);
    switch (currentChannel) {
      case 'general':
        return '💬 Allgemeine Teams-Kommunikation';
      case 'emergency':
        return '🚨 Nur für Notfälle und dringende Meldungen';
      case 'patrol':
        return '🚔 Koordination für Streifendienst';
      case 'admin':
        return '🛡️ Administrative Nachrichten';
      default:
        return '💬 Team-Kommunikation';
    }
  };

  if (loading) {
    return (
      <View style={dynamicStyles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={dynamicStyles.loadingText}>Nachrichten werden geladen...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={dynamicStyles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Modern Channel Tabs */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={dynamicStyles.channelTabs}
      >
        {channels.map(channel => (
          <TouchableOpacity
            key={channel.key}
            style={[
              dynamicStyles.channelTab,
              currentChannel === channel.key && dynamicStyles.channelTabActive
            ]}
            onPress={() => setCurrentChannel(channel.key)}
          >
            <Ionicons 
              name={channel.icon as any}
              size={12} 
              color={currentChannel === channel.key ? '#FFFFFF' : channel.color}
              style={dynamicStyles.channelIcon}
            />
            <Text style={[
              dynamicStyles.channelTabText,
              currentChannel === channel.key && dynamicStyles.channelTabTextActive
            ]}>
              {channel.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Channel Info */}
      <View style={dynamicStyles.channelInfo}>
        <Text style={dynamicStyles.channelInfoText}>
          {getCurrentChannelInfo()}
        </Text>
      </View>

      {/* Messages Container */}
      <View style={dynamicStyles.messagesContainer}>
        {messages.length === 0 ? (
          <View style={dynamicStyles.emptyContainer}>
            <Ionicons 
              name="chatbubbles-outline" 
              size={64} 
              color={colors.textMuted} 
              style={dynamicStyles.emptyIcon}
            />
            <Text style={dynamicStyles.emptyTitle}>
              Noch keine Nachrichten
            </Text>
            <Text style={dynamicStyles.emptyText}>
              Starten Sie eine Unterhaltung mit Ihrem Team. 
              Nachrichten in diesem Kanal sind für alle Teammitglieder sichtbar.
            </Text>
          </View>
        ) : (
          <ScrollView
            ref={scrollViewRef}
            style={dynamicStyles.messagesList}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            maintainVisibleContentPosition={{
              minIndexForVisible: 0,
              autoscrollToTopThreshold: 10,
            }}
          >
            {messages.map((message) => {
              const isMine = isMyMessage(message.sender_id);
              console.log('🔍 RealTimeMessages Debug:', {
                messageContent: message.content,
                messageSenderId: message.sender_id,
                currentUserId: user?.id,
                isMine: isMine,
                senderName: message.sender_name
              });
              
              return (
                <View
                  key={message.id}
                  style={[
                    dynamicStyles.messageContainer,
                    isMine ? dynamicStyles.myMessageContainer : dynamicStyles.otherMessageContainer
                  ]}
                >
                  {!isMine && (
                    <Text style={dynamicStyles.senderName}>
                      👤 {message.sender_name}
                    </Text>
                  )}
                  
                  <View style={[
                    dynamicStyles.messageBubble,
                    isMine ? dynamicStyles.myMessageBubble : dynamicStyles.otherMessageBubble
                  ]}>
                    <Text style={[
                      dynamicStyles.messageContent,
                      isMine ? dynamicStyles.myMessageContent : dynamicStyles.otherMessageContent
                    ]}>
                      {message.content}
                    </Text>
                    
                    <Text style={[
                      dynamicStyles.messageTime,
                      isMine ? dynamicStyles.myMessageTime : dynamicStyles.otherMessageTime
                    ]}>
                      {formatTime(message.timestamp || message.created_at)}
                    </Text>
                  </View>
                </View>
              );
            })}
            
            <View style={{ height: 20 }} />
          </ScrollView>
        )}
      </View>

      {/* Modern Input Area */}
      <View style={dynamicStyles.inputContainer}>
        <View style={dynamicStyles.inputRow}>
          <View style={[
            dynamicStyles.inputWrapper,
            newMessage.length > 0 && dynamicStyles.inputWrapperFocused
          ]}>
            <TextInput
              style={dynamicStyles.textInput}
              value={newMessage}
              onChangeText={setNewMessage}
              placeholder={`Nachricht an ${channels.find(ch => ch.key === currentChannel)?.label}...`}
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={500}
              editable={!sending}
            />
          </View>
          
          <TouchableOpacity
            style={[
              dynamicStyles.sendButton,
              (!newMessage.trim() || sending) && dynamicStyles.sendButtonDisabled
            ]}
            onPress={sendMessage}
            disabled={!newMessage.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Ionicons name="send" size={20} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

export default RealTimeMessages;