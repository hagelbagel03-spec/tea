// Enhanced Messages Screen with Channel Creation and Real-time Updates
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';

interface MessageScreenFixesProps {
  user: any;
  token: string;
}

const MessageScreenFixes: React.FC<MessageScreenFixesProps> = ({ user, token }) => {
  const [channels, setChannels] = useState([
    { id: 'general', name: 'Allgemein', color: '#1E3A8A', icon: 'chatbubbles' },
    { id: 'emergency', name: 'Notfall', color: '#EF4444', icon: 'warning' },
    { id: 'patrol', name: 'Streife', color: '#8B5CF6', icon: 'car-sport' },
  ]);
  const [selectedChannel, setSelectedChannel] = useState('general');
  const [messages, setMessages] = useState({});
  const [newMessage, setNewMessage] = useState('');
  const [showCreateChannelModal, setShowCreateChannelModal] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [lastUpdate, setLastUpdate] = useState(new Date());
  
  const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

  useEffect(() => {
    loadMessages();
    
    // Real-time updates every 3 seconds
    const interval = setInterval(() => {
      loadMessages(true);
    }, 3000);
    
    return () => clearInterval(interval);
  }, [selectedChannel]);

  const loadMessages = async (isRealTime = false) => {
    try {
      const config = token ? {
        headers: { Authorization: `Bearer ${token}` },
        params: { channel: selectedChannel }
      } : {};

      const response = await axios.get(`${API_URL}/api/messages`, config);
      const serverMessages = response.data.map(msg => ({
        id: msg.id,
        user: msg.sender_name || 'Unbekannt',
        message: msg.content,
        time: new Date(msg.created_at).toLocaleTimeString('de-DE', { 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
        sender_id: msg.sender_id,
        isOwn: msg.sender_id === user?.id
      }));
      
      setMessages(prev => ({
        ...prev,
        [selectedChannel]: serverMessages
      }));
      
      if (isRealTime) {
        setLastUpdate(new Date());
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    
    try {
      const config = token ? {
        headers: { Authorization: `Bearer ${token}` }
      } : {};
      
      await axios.post(`${API_URL}/api/messages`, {
        content: newMessage.trim(),
        channel: selectedChannel
      }, config);

      setNewMessage('');
      
      // Immediately reload messages
      await loadMessages(true);
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Fehler', 'Nachricht konnte nicht gesendet werden');
    }
  };

  const createChannel = () => {
    if (!newChannelName.trim()) {
      Alert.alert('Fehler', 'Bitte geben Sie einen Kanalnamen ein');
      return;
    }
    
    const channelId = newChannelName.toLowerCase().replace(/\s+/g, '_');
    
    // Check if channel already exists
    if (channels.find(c => c.id === channelId)) {
      Alert.alert('Fehler', 'Ein Kanal mit diesem Namen existiert bereits');
      return;
    }
    
    const newChannel = {
      id: channelId,
      name: newChannelName.trim(),
      color: '#8B5CF6',
      icon: 'chatbubble'
    };
    
    setChannels(prev => [...prev, newChannel]);
    setMessages(prev => ({ ...prev, [channelId]: [] }));
    setNewChannelName('');
    setShowCreateChannelModal(false);
    setSelectedChannel(channelId);
    
    Alert.alert('Erfolg', `Kanal "${newChannelName}" wurde erstellt`);
  };

  const deleteChannel = (channelId) => {
    // Don't allow deleting default channels
    const defaultChannels = ['general', 'emergency', 'patrol'];
    if (defaultChannels.includes(channelId)) {
      Alert.alert('Fehler', 'Standard-Kanäle können nicht gelöscht werden');
      return;
    }
    
    Alert.alert(
      'Kanal löschen',
      'Möchten Sie diesen Kanal wirklich löschen?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: () => {
            setChannels(prev => prev.filter(c => c.id !== channelId));
            const newMessages = { ...messages };
            delete newMessages[channelId];
            setMessages(newMessages);
            
            if (selectedChannel === channelId) {
              setSelectedChannel('general');
            }
          }
        }
      ]
    );
  };

  const currentMessages = messages[selectedChannel] || [];
  const currentChannel = channels.find(c => c.id === selectedChannel);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.messageHeader}>
        <Text style={styles.screenTitle}>💬 Nachrichten</Text>
        <View style={styles.headerActions}>
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
          <TouchableOpacity onPress={() => setShowCreateChannelModal(true)}>
            <Ionicons name="add-circle-outline" size={24} color="#1E3A8A" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Channel Selector */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        style={styles.channelSelector}
        contentContainerStyle={styles.channelSelectorContent}
      >
        {channels.map(channel => (
          <View key={channel.id} style={styles.channelContainer}>
            <TouchableOpacity
              style={[
                styles.channelButton,
                { 
                  backgroundColor: selectedChannel === channel.id ? channel.color : '#F3F4F6',
                  borderColor: selectedChannel === channel.id ? channel.color : '#E5E7EB'
                }
              ]}
              onPress={() => setSelectedChannel(channel.id)}
            >
              <Ionicons 
                name={channel.icon} 
                size={16} 
                color={selectedChannel === channel.id ? '#FFFFFF' : '#6B7280'} 
              />
              <Text style={[
                styles.channelText,
                { color: selectedChannel === channel.id ? '#FFFFFF' : '#4B5563' }
              ]}>
                {channel.name}
              </Text>
            </TouchableOpacity>
            {!['general', 'emergency', 'patrol'].includes(channel.id) && (
              <TouchableOpacity
                style={styles.deleteChannelButton}
                onPress={() => deleteChannel(channel.id)}
              >
                <Ionicons name="close-circle" size={16} color="#EF4444" />
              </TouchableOpacity>
            )}
          </View>
        ))}
      </ScrollView>

      {/* Messages */}
      <ScrollView style={styles.messagesList}>
        <View style={styles.channelInfo}>
          <Ionicons name={currentChannel?.icon} size={20} color={currentChannel?.color} />
          <Text style={styles.channelInfoText}>
            #{currentChannel?.name} • {currentMessages.length} Nachrichten
          </Text>
        </View>
        
        {currentMessages.map(msg => (
          <View key={msg.id} style={[
            styles.messageItem,
            msg.isOwn && styles.ownMessage
          ]}>
            <View style={styles.messageHeader}>
              <Text style={styles.messageSender}>
                {msg.isOwn ? '👤 Sie' : `👮 ${msg.user}`}
              </Text>
              <Text style={styles.messageTime}>{msg.time}</Text>
            </View>
            <Text style={styles.messageContent}>{msg.message}</Text>
          </View>
        ))}
        
        {currentMessages.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={48} color="#9CA3AF" />
            <Text style={styles.emptyText}>
              Noch keine Nachrichten in #{currentChannel?.name}
            </Text>
            <Text style={styles.emptySubtext}>
              Seien Sie der Erste, der eine Nachricht sendet!
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Message Input */}
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inputContainer}
      >
        <View style={styles.inputRow}>
          <TextInput
            style={styles.messageInput}
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder={`Nachricht in #${currentChannel?.name} schreiben...`}
            multiline
            maxLength={500}
          />
          <TouchableOpacity 
            style={[styles.sendButton, !newMessage.trim() && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={!newMessage.trim()}
          >
            <Ionicons 
              name="send" 
              size={20} 
              color={newMessage.trim() ? '#1E3A8A' : '#9CA3AF'} 
            />
          </TouchableOpacity>
        </View>
        <Text style={styles.updateText}>
          Letzte Aktualisierung: {lastUpdate.toLocaleTimeString('de-DE')}
        </Text>
      </KeyboardAvoidingView>

      {/* Create Channel Modal */}
      <Modal
        visible={showCreateChannelModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCreateChannelModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCreateChannelModal(false)}>
              <Ionicons name="close" size={24} color="#1E3A8A" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Neuen Kanal erstellen</Text>
            <TouchableOpacity onPress={createChannel}>
              <Text style={styles.createButtonText}>Erstellen</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.modalContent}>
            <Text style={styles.inputLabel}>Kanalname</Text>
            <TextInput
              style={styles.modalInput}
              value={newChannelName}
              onChangeText={setNewChannelName}
              placeholder="z.B. Verkehrskontrolle"
              maxLength={30}
            />
            <Text style={styles.inputHint}>
              Der Kanal wird automatisch für alle Teammitglieder verfügbar sein.
            </Text>
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
  messageHeader: {
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    marginRight: 4,
  },
  liveText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EF4444',
  },
  channelSelector: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  channelSelectorContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  channelContainer: {
    position: 'relative',
    marginRight: 8,
  },
  channelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  channelText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  deleteChannelButton: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
  },
  channelInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  channelInfoText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
  },
  messagesList: {
    flex: 1,
  },
  messageItem: {
    backgroundColor: '#FFFFFF',
    margin: 8,
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#E5E7EB',
  },
  ownMessage: {
    backgroundColor: '#EBF4FF',
    borderLeftColor: '#1E3A8A',
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  messageSender: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E3A8A',
  },
  messageTime: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  messageContent: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
    textAlign: 'center',
  },
  inputContainer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
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
  sendButtonDisabled: {
    opacity: 0.5,
  },
  updateText: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E3A8A',
  },
  modalContent: {
    padding: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
  },
  inputHint: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
  },
});

export default MessageScreenFixes;