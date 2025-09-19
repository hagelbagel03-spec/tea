import React, { useState, useContext, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';

// Theme context import - we'll receive it as props
const ThemeContext = React.createContext(null);

const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
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
  }
  return context;
};

interface AddUserModalProps {
  visible: boolean;
  onClose: () => void;
  onUserAdded: () => void;
  token: string;
  theme: any; // Theme object passed from parent
}

const AddUserModal: React.FC<AddUserModalProps> = ({ visible, onClose, onUserAdded, token, theme }) => {
  const colors = theme?.colors || {
    primary: '#1E3A8A',
    background: '#F3F4F6',
    surface: '#FFFFFF',
    text: '#111827',
    textSecondary: '#374151',
    textMuted: '#6B7280',
    border: '#E5E7EB',
    error: '#EF4444',
    success: '#10B981',
  };
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    role: 'officer',
    department: '',
    team: '', // Team-Zuordnung hinzugefügt
    badge_number: '',
    rank: '',
    phone: '',
    photo: '' // base64 encoded profile photo
  });
  const [loading, setLoading] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  
  // Team Management States
  const [availableTeams, setAvailableTeams] = useState([]);
  const [showAddTeamModal, setShowAddTeamModal] = useState(false);
  const [newTeamData, setNewTeamData] = useState({
    name: '',
    description: '',
    district: '',
    max_members: 6
  });

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

  // Load teams when modal becomes visible
  useEffect(() => {
    if (visible) {
      loadAvailableTeams();
    }
  }, [visible, token]);

  // Team Management Functions
  const loadAvailableTeams = async () => {
    try {
      const config = token ? {
        headers: { Authorization: `Bearer ${token}` }
      } : {};
      
      const response = await axios.get(`${API_URL}/api/admin/teams`, config);
      setAvailableTeams(response.data || []);
    } catch (error) {
      console.error('Error loading teams:', error);
      setAvailableTeams([]);
    }
  };

  const createNewTeam = async () => {
    if (!newTeamData.name.trim()) {
      Alert.alert('❌ Fehler', 'Team-Name ist erforderlich');
      return;
    }

    try {
      const config = token ? {
        headers: { Authorization: `Bearer ${token}` }
      } : {};

      const teamData = {
        name: newTeamData.name.trim(),
        description: newTeamData.description.trim(),
        district: newTeamData.district.trim(),
        max_members: newTeamData.max_members || 6,
        status: 'Einsatzbereit',
        members: []
      };

      await axios.post(`${API_URL}/api/admin/teams`, teamData, config);
      
      Alert.alert('✅ Erfolg', `Team "${newTeamData.name}" wurde erstellt!`);
      
      // Reset form and reload teams
      setNewTeamData({ name: '', description: '', district: '', max_members: 6 });
      setShowAddTeamModal(false);
      await loadAvailableTeams();
      
      // Auto-select the new team
      updateField('team', newTeamData.name);
      
    } catch (error) {
      console.error('Error creating team:', error);
      let errorMessage = 'Team konnte nicht erstellt werden';
      
      if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      }
      
      Alert.alert('❌ Fehler', errorMessage);
    }
  };

  const pickImageForUser = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('📸 Berechtigung erforderlich', 'Berechtigung für Galerie-Zugriff erforderlich');
        return null;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
        return base64Image;
      }
    } catch (error) {
      console.error('❌ Image picker error:', error);
      Alert.alert('❌ Fehler', 'Fehler beim Auswählen des Bildes');
    }
    return null;
  };

  const takePhotoForUser = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('📷 Berechtigung erforderlich', 'Berechtigung für Kamera-Zugriff erforderlich');
        return null;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
        return base64Image;
      }
    } catch (error) {
      console.error('❌ Camera error:', error);
      Alert.alert('❌ Fehler', 'Fehler beim Aufnehmen des Fotos');
    }
    return null;
  };

  const resetForm = () => {
    setFormData({
      email: '',
      username: '',
      password: '',
      confirmPassword: '',
      role: 'officer',
      department: '',
      team: '',
      badge_number: '',
      rank: '',
      phone: '',
      photo: ''
    });
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const validateForm = () => {
    if (!formData.email || !formData.username || !formData.password) {
      Alert.alert('⚠️ Fehler', 'Bitte füllen Sie alle Pflichtfelder aus');
      return false;
    }

    if (formData.password.length < 6) {
      Alert.alert('⚠️ Fehler', 'Passwort muss mindestens 6 Zeichen lang sein');
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      Alert.alert('⚠️ Fehler', 'Passwörter stimmen nicht überein');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      Alert.alert('⚠️ Fehler', 'Bitte geben Sie eine gültige E-Mail-Adresse ein');
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);

    try {
      const config = token ? {
        headers: { Authorization: `Bearer ${token}` }
      } : {};

      const userData = {
        email: formData.email,
        username: formData.username,
        password: formData.password,
        role: formData.role,
        department: formData.department || null,
        team: formData.team || null,
        badge_number: formData.badge_number || null,
        rank: formData.rank || null,
        phone: formData.phone || null
      };

      console.log('👤 Creating user:', userData);

      const response = await axios.post(`${API_URL}/api/auth/register`, userData, config);
      
      console.log('✅ User created successfully:', response.data);

      Alert.alert(
        '✅ Erfolg!',
        `Benutzer "${formData.username}" wurde erfolgreich erstellt!`,
        [
          {
            text: 'OK',
            onPress: () => {
              resetForm();
              onUserAdded();
            }
          }
        ]
      );

    } catch (error) {
      console.error('❌ Error creating user:', error);
      
      let errorMessage = 'Benutzer konnte nicht erstellt werden';
      
      if (error.response?.data?.detail) {
        if (error.response.data.detail.includes('email')) {
          errorMessage = 'E-Mail-Adresse wird bereits verwendet';
        } else if (error.response.data.detail.includes('badge_number')) {
          errorMessage = 'Dienstnummer wird bereits verwendet';
        } else {
          errorMessage = error.response.data.detail;
        }
      } else if (error.message.includes('Network Error')) {
        errorMessage = 'Keine Verbindung zum Server. Bitte prüfen Sie Ihre Internetverbindung.';
      }

      Alert.alert('❌ Fehler', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 4,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
    },
    closeButton: {
      padding: 8,
      backgroundColor: colors.card,
      borderRadius: 12,
    },
    saveButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 12,
    },
    saveButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    content: {
      flex: 1,
      padding: 20,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 16,
      marginTop: 8,
    },
    formGroup: {
      marginBottom: 20,
    },
    formLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    required: {
      color: colors.error,
    },
    formInput: {
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      backgroundColor: colors.surface,
      color: colors.text,
    },
    formInputFocused: {
      borderColor: colors.primary,
    },
    passwordContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    passwordInput: {
      flex: 1,
    },
    passwordToggle: {
      position: 'absolute',
      right: 16,
      padding: 4,
    },
    roleSelector: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 8,
    },
    roleOption: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 12,
      alignItems: 'center',
      backgroundColor: colors.surface,
    },
    roleOptionActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '20',
    },
    roleOptionText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    roleOptionTextActive: {
      color: colors.primary,
    },
    submitButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      paddingVertical: 18,
      borderRadius: 16,
      marginTop: 24,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    submitButtonDisabled: {
      backgroundColor: colors.textMuted,
    },
    submitButtonText: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: '700',
      marginLeft: 12,
    },
    
    // Team Management Styles
    teamSelectionContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    addTeamButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#10B981',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
    },
    addTeamButtonText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '600',
      marginLeft: 4,
    },
    teamSuggestions: {
      marginTop: 8,
    },
    teamSuggestionsLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 8,
    },
    teamChips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    teamChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    teamChipSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    teamChipText: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    teamChipTextSelected: {
      color: '#FFFFFF',
    },
    infoCard: {
      backgroundColor: colors.primary + '15',
      padding: 16,
      borderRadius: 12,
      marginBottom: 20,
      borderLeftWidth: 4,
      borderLeftColor: colors.primary,
    },
    infoText: {
      fontSize: 14,
      color: colors.text,
      lineHeight: 20,
    },
    passwordStrength: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 8,
    },
    strengthIndicator: {
      height: 4,
      flex: 1,
      backgroundColor: colors.border,
      borderRadius: 2,
      marginRight: 8,
    },
    strengthWeak: {
      backgroundColor: colors.error,
    },
    strengthMedium: {
      backgroundColor: '#F59E0B',
    },
    strengthStrong: {
      backgroundColor: colors.success,
    },
    strengthText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
    },
    // Photo Upload Styles
    photoUploadContainer: {
      alignItems: 'center',
      padding: 20,
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border,
      borderStyle: 'dashed',
    },
    photoUploadButtons: {
      flexDirection: 'row',
      gap: 16,
    },
    photoButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 8,
      gap: 8,
    },
    photoButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
    },
    photoPreview: {
      position: 'relative',
      width: 120,
      height: 120,
      borderRadius: 60,
      overflow: 'hidden',
    },
    profilePhotoPreview: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    photoOverlay: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      backgroundColor: 'rgba(0,0,0,0.7)',
      borderRadius: 15,
      padding: 6,
    },
    
    // Modal Styles
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContainer: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      width: '100%',
      maxWidth: 400,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    modalContent: {
      padding: 20,
    },
  });

  const getPasswordStrength = (password: string) => {
    if (password.length === 0) return { strength: 0, text: '' };
    if (password.length < 6) return { strength: 1, text: 'Schwach' };
    if (password.length >= 6 && password.length < 10) return { strength: 2, text: 'Mittel' };
    return { strength: 3, text: 'Stark' };
  };

  const passwordStrength = getPasswordStrength(formData.password);

  return (
    <>
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <SafeAreaView style={dynamicStyles.container}>
        <View style={dynamicStyles.header}>
          <TouchableOpacity style={dynamicStyles.closeButton} onPress={handleClose}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={dynamicStyles.headerTitle}>👤 Benutzer hinzufügen</Text>
          <TouchableOpacity 
            style={[dynamicStyles.saveButton, loading && dynamicStyles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={dynamicStyles.saveButtonText}>Erstellen</Text>
            )}
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView 
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView style={dynamicStyles.content} showsVerticalScrollIndicator={false}>
            
            <View style={dynamicStyles.infoCard}>
              <Text style={dynamicStyles.infoText}>
                🔐 Ein neuer Benutzer wird dem Stadtwache-System hinzugefügt. 
                Alle mit * markierten Felder sind Pflichtfelder.
              </Text>
            </View>

            <Text style={dynamicStyles.sectionTitle}>📋 Grunddaten</Text>

            <View style={dynamicStyles.formGroup}>
              <Text style={dynamicStyles.formLabel}>
                📧 E-Mail Adresse <Text style={dynamicStyles.required}>*</Text>
              </Text>
              <TextInput
                style={dynamicStyles.formInput}
                value={formData.email}
                onChangeText={(value) => updateField('email', value)}
                placeholder="benutzer@stadtwache.de"
                placeholderTextColor={colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </View>

            <View style={dynamicStyles.formGroup}>
              <Text style={dynamicStyles.formLabel}>
                👤 Vollständiger Name <Text style={dynamicStyles.required}>*</Text>
              </Text>
              <TextInput
                style={dynamicStyles.formInput}
                value={formData.username}
                onChangeText={(value) => updateField('username', value)}
                placeholder="Max Mustermann"
                placeholderTextColor={colors.textMuted}
                autoComplete="name"
              />
            </View>

            {/* Profile Photo Upload */}
            <View style={dynamicStyles.formGroup}>
              <Text style={dynamicStyles.formLabel}>📸 Profilbild (optional)</Text>
              <View style={dynamicStyles.photoUploadContainer}>
                {formData.photo ? (
                  <TouchableOpacity 
                    style={dynamicStyles.photoPreview}
                    onPress={() => {
                      Alert.alert(
                        '📸 Profilbild ändern',
                        'Möchten Sie das Profilbild ändern oder entfernen?',
                        [
                          { text: 'Abbrechen', style: 'cancel' },
                          { 
                            text: 'Entfernen', 
                            style: 'destructive',
                            onPress: () => setFormData(prev => ({...prev, photo: ''}))
                          },
                          { text: 'Neues Foto', onPress: async () => {
                            const photo = await pickImageForUser();
                            if (photo) setFormData(prev => ({...prev, photo}));
                          }}
                        ]
                      );
                    }}
                  >
                    <Image 
                      source={{ uri: formData.photo }} 
                      style={dynamicStyles.profilePhotoPreview}
                    />
                    <View style={dynamicStyles.photoOverlay}>
                      <Ionicons name="camera" size={20} color="#FFFFFF" />
                    </View>
                  </TouchableOpacity>
                ) : (
                  <View style={dynamicStyles.photoUploadButtons}>
                    <TouchableOpacity 
                      style={[dynamicStyles.photoButton, { backgroundColor: colors.primary }]}
                      onPress={async () => {
                        const photo = await pickImageForUser();
                        if (photo) setFormData(prev => ({...prev, photo}));
                      }}
                    >
                      <Ionicons name="images" size={20} color="#FFFFFF" />
                      <Text style={dynamicStyles.photoButtonText}>Galerie</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={[dynamicStyles.photoButton, { backgroundColor: colors.secondary || colors.primary }]}
                      onPress={async () => {
                        const photo = await takePhotoForUser();
                        if (photo) setFormData(prev => ({...prev, photo}));
                      }}
                    >
                      <Ionicons name="camera" size={20} color="#FFFFFF" />
                      <Text style={dynamicStyles.photoButtonText}>Kamera</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>

            <View style={dynamicStyles.formGroup}>
              <Text style={dynamicStyles.formLabel}>
                🔐 Passwort <Text style={dynamicStyles.required}>*</Text>
              </Text>
              <View style={dynamicStyles.passwordContainer}>
                <TextInput
                  style={[dynamicStyles.formInput, dynamicStyles.passwordInput]}
                  value={formData.password}
                  onChangeText={(value) => updateField('password', value)}
                  placeholder="Mindestens 6 Zeichen"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry={!showPasswords}
                />
                <TouchableOpacity 
                  style={dynamicStyles.passwordToggle}
                  onPress={() => setShowPasswords(!showPasswords)}
                >
                  <Ionicons 
                    name={showPasswords ? "eye-off" : "eye"} 
                    size={20} 
                    color={colors.textMuted} 
                  />
                </TouchableOpacity>
              </View>
              {formData.password.length > 0 && (
                <View style={dynamicStyles.passwordStrength}>
                  <View style={[
                    dynamicStyles.strengthIndicator,
                    passwordStrength.strength === 1 && dynamicStyles.strengthWeak,
                    passwordStrength.strength === 2 && dynamicStyles.strengthMedium,
                    passwordStrength.strength === 3 && dynamicStyles.strengthStrong,
                  ]} />
                  <Text style={dynamicStyles.strengthText}>{passwordStrength.text}</Text>
                </View>
              )}
            </View>

            <View style={dynamicStyles.formGroup}>
              <Text style={dynamicStyles.formLabel}>
                🔐 Passwort bestätigen <Text style={dynamicStyles.required}>*</Text>
              </Text>
              <TextInput
                style={dynamicStyles.formInput}
                value={formData.confirmPassword}
                onChangeText={(value) => updateField('confirmPassword', value)}
                placeholder="Passwort wiederholen"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showPasswords}
              />
            </View>

            <Text style={dynamicStyles.sectionTitle}>🎖️ Dienstinformationen</Text>

            <View style={dynamicStyles.formGroup}>
              <Text style={dynamicStyles.formLabel}>🛡️ Rolle</Text>
              <View style={dynamicStyles.roleSelector}>
                <TouchableOpacity
                  style={[
                    dynamicStyles.roleOption,
                    formData.role === 'officer' && dynamicStyles.roleOptionActive
                  ]}
                  onPress={() => updateField('role', 'officer')}
                >
                  <Text style={[
                    dynamicStyles.roleOptionText,
                    formData.role === 'officer' && dynamicStyles.roleOptionTextActive
                  ]}>
                    👮 Beamter
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    dynamicStyles.roleOption,
                    formData.role === 'admin' && dynamicStyles.roleOptionActive
                  ]}
                  onPress={() => updateField('role', 'admin')}
                >
                  <Text style={[
                    dynamicStyles.roleOptionText,
                    formData.role === 'admin' && dynamicStyles.roleOptionTextActive
                  ]}>
                    🛡️ Admin
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={dynamicStyles.formGroup}>
              <Text style={dynamicStyles.formLabel}>🏢 Abteilung</Text>
              <TextInput
                style={dynamicStyles.formInput}
                value={formData.department}
                onChangeText={(value) => updateField('department', value)}
                placeholder="z.B. Streifendienst, Kriminalpolizei"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <View style={dynamicStyles.formGroup}>
              <Text style={dynamicStyles.formLabel}>👥 Team</Text>
              <View style={dynamicStyles.teamSelectionContainer}>
                <TextInput
                  style={[dynamicStyles.formInput, { flex: 1, marginRight: 8 }]}
                  value={formData.team}
                  onChangeText={(value) => updateField('team', value)}
                  placeholder="z.B. Team Alpha, Team Bravo"
                  placeholderTextColor={colors.textMuted}
                />
                <TouchableOpacity 
                  style={dynamicStyles.addTeamButton}
                  onPress={() => setShowAddTeamModal(true)}
                >
                  <Ionicons name="add" size={20} color="#FFFFFF" />
                  <Text style={dynamicStyles.addTeamButtonText}>Neues Team</Text>
                </TouchableOpacity>
              </View>
              
              {/* Team Suggestions */}
              {availableTeams.length > 0 && (
                <View style={dynamicStyles.teamSuggestions}>
                  <Text style={dynamicStyles.teamSuggestionsLabel}>Verfügbare Teams:</Text>
                  <View style={dynamicStyles.teamChips}>
                    {availableTeams.map((team, index) => (
                      <TouchableOpacity 
                        key={index}
                        style={[dynamicStyles.teamChip, formData.team === team.name && dynamicStyles.teamChipSelected]}
                        onPress={() => updateField('team', team.name)}
                      >
                        <Text style={[dynamicStyles.teamChipText, formData.team === team.name && dynamicStyles.teamChipTextSelected]}>
                          {team.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </View>

            <View style={dynamicStyles.formGroup}>
              <Text style={dynamicStyles.formLabel}>🆔 Dienstnummer</Text>
              <TextInput
                style={dynamicStyles.formInput}
                value={formData.badge_number}
                onChangeText={(value) => updateField('badge_number', value)}
                placeholder="z.B. PB-2024-001"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="characters"
              />
            </View>

            <View style={dynamicStyles.formGroup}>
              <Text style={dynamicStyles.formLabel}>🎖️ Dienstgrad</Text>
              <TextInput
                style={dynamicStyles.formInput}
                value={formData.rank}
                onChangeText={(value) => updateField('rank', value)}
                placeholder="z.B. Polizeihauptmeister, Kommissar"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <View style={dynamicStyles.formGroup}>
              <Text style={dynamicStyles.formLabel}>📞 Telefonnummer</Text>
              <TextInput
                style={dynamicStyles.formInput}
                value={formData.phone}
                onChangeText={(value) => updateField('phone', value)}
                placeholder="+49 123 456789"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
                autoComplete="tel"
              />
            </View>

            <TouchableOpacity 
              style={[dynamicStyles.submitButton, loading && dynamicStyles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Ionicons name="person-add" size={20} color="#FFFFFF" />
                  <Text style={dynamicStyles.submitButtonText}>👤 Benutzer hinzufügen</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>

    {/* Add Team Modal */}
    <Modal
      visible={showAddTeamModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowAddTeamModal(false)}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={dynamicStyles.modalOverlay}>
          <View style={[dynamicStyles.modalContainer, { maxHeight: '80%' }]}>
            <View style={dynamicStyles.modalHeader}>
              <TouchableOpacity 
                style={dynamicStyles.closeButton}
                onPress={() => setShowAddTeamModal(false)}
              >
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
              <Text style={dynamicStyles.modalTitle}>👥 Neues Team erstellen</Text>
              <View style={{ width: 40 }} />
            </View>

            <ScrollView style={dynamicStyles.modalContent} showsVerticalScrollIndicator={false}>
              <View style={dynamicStyles.formGroup}>
                <Text style={dynamicStyles.formLabel}>📛 Team-Name *</Text>
                <TextInput
                  style={dynamicStyles.formInput}
                  value={newTeamData.name}
                  onChangeText={(value) => setNewTeamData({...newTeamData, name: value})}
                  placeholder="z.B. Team Alpha, Streife 1"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={dynamicStyles.formGroup}>
                <Text style={dynamicStyles.formLabel}>📝 Beschreibung</Text>
                <TextInput
                  style={[dynamicStyles.formInput, { height: 80, textAlignVertical: 'top' }]}
                  value={newTeamData.description}
                  onChangeText={(value) => setNewTeamData({...newTeamData, description: value})}
                  placeholder="Aufgaben und Verantwortlichkeiten..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={dynamicStyles.formGroup}>
                <Text style={dynamicStyles.formLabel}>🗺️ Zugewiesener Bezirk</Text>
                <TextInput
                  style={dynamicStyles.formInput}
                  value={newTeamData.district}
                  onChangeText={(value) => setNewTeamData({...newTeamData, district: value})}
                  placeholder="z.B. Innenstadt, Nord, Süd"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={dynamicStyles.formGroup}>
                <Text style={dynamicStyles.formLabel}>👥 Max. Mitglieder</Text>
                <TextInput
                  style={dynamicStyles.formInput}
                  value={newTeamData.max_members.toString()}
                  onChangeText={(value) => {
                    const num = parseInt(value) || 1;
                    setNewTeamData({...newTeamData, max_members: Math.max(1, Math.min(20, num))});
                  }}
                  placeholder="6"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                />
              </View>

              <TouchableOpacity
                style={[dynamicStyles.submitButton, { backgroundColor: colors.success }]}
                onPress={createNewTeam}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                <Text style={dynamicStyles.submitButtonText}>👥 Team erstellen</Text>
              </TouchableOpacity>

              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
    </>
  );
};

export default AddUserModal;