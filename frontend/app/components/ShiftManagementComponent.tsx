import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert, StyleSheet, Modal, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';

const ShiftManagementComponent = ({ user, token, API_URL, colors, isDarkMode, isSmallScreen, isMediumScreen }) => {
  const [checkins, setCheckins] = useState([]);
  const [vacations, setVacations] = useState([]);
  const [showVacationModal, setShowVacationModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [vacationFormData, setVacationFormData] = useState({
    start_date: '',
    end_date: '',
    reason: ''
  });

  // Bezirke und Teams State
  const [districts] = useState([
    'Innenstadt', 'Nord', 'Süd', 'Ost', 'West', 
    'Industriegebiet', 'Wohngebiet', 'Zentrum'
  ]);

  const loadUserData = async () => {
    try {
      const config = token ? {
        headers: { Authorization: `Bearer ${token}` }
      } : {};

      const response = await axios.get(`${API_URL}/api/user/profile`, config);
      if (response.data) {
        console.log('🔄 User-Daten aktualisiert:', response.data);
        // Update user in parent component if callback provided
        if (typeof user.updateUserData === 'function') {
          user.updateUserData(response.data);
        }
      }
    } catch (error) {
      console.error('❌ Fehler beim User-Daten laden:', error);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const config = token ? {
        headers: { Authorization: `Bearer ${token}` }
      } : {};

      // Load user data first for real-time updates
      await loadUserData();

      // Load checkins
      try {
        const checkinsResponse = await axios.get(`${API_URL}/api/checkins`, config);
        if (checkinsResponse.data) {
          setCheckins(checkinsResponse.data);
        }
      } catch (error) {
        console.log('Check-ins laden fehlgeschlagen:', error.message);
        setCheckins([]);
      }

      // Load vacations
      try {
        const vacationsResponse = await axios.get(`${API_URL}/api/vacations`, config);
        if (vacationsResponse.data) {
          setVacations(vacationsResponse.data);
        }
      } catch (error) {
        console.log('Urlaubsanträge laden fehlgeschlagen:', error.message);
        setVacations([]);
      }
    } catch (error) {
      console.error('Error loading shift data:', error);
      setCheckins([]);
      setVacations([]);
    } finally {
      setLoading(false);
    }
  };

  const performCheckIn = async (status = 'ok') => {
    try {
      const config = token ? {
        headers: { Authorization: `Bearer ${token}` }
      } : {};

      const checkInData = {
        status: status,
        message: getStatusText(status),
        timestamp: new Date().toISOString()
      };

      await axios.post(`${API_URL}/api/checkin`, checkInData, config);
      
      Alert.alert('✅ Check-In erfolgreich!', `Status: ${getStatusText(status)}`);
      await loadData();
    } catch (error) {
      console.error('Check-in error:', error);
      Alert.alert('❌ Fehler', 'Check-In konnte nicht übertragen werden.');
    }
  };

  const requestVacation = async () => {
    if (!vacationFormData.start_date || !vacationFormData.end_date || !vacationFormData.reason) {
      Alert.alert('❌ Fehler', 'Bitte alle Felder ausfüllen.');
      return;
    }

    try {
      const config = token ? {
        headers: { Authorization: `Bearer ${token}` }
      } : {};

      const vacationData = {
        start_date: vacationFormData.start_date,
        end_date: vacationFormData.end_date,
        reason: vacationFormData.reason
      };

      const response = await axios.post(`${API_URL}/api/vacations`, vacationData, config);
      
      if (response.data) {
        Alert.alert('✅ Erfolg', 'Urlaubsantrag wurde eingereicht!');
        
        setVacationFormData({ start_date: '', end_date: '', reason: '' });
        setShowVacationModal(false);
        
        console.log('🔄 Lade Urlaubsanträge neu...');
        await loadData();
      }
    } catch (error) {
      console.error('❌ Vacation request error:', error);
      Alert.alert('❌ Fehler', 'Urlaubsantrag konnte nicht eingereicht werden.');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return colors.success;
      case 'rejected': return colors.error;
      case 'pending': return colors.warning;
      case 'ok': return colors.success;
      case 'help_needed': return colors.warning;
      case 'emergency': return colors.error;
      default: return colors.textMuted;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'approved': return 'Genehmigt';
      case 'rejected': return 'Abgelehnt';
      case 'pending': return 'Ausstehend';
      case 'ok': return 'Alles OK';
      case 'help_needed': return 'Hilfe benötigt';
      case 'emergency': return 'Notfall';
      default: return status;
    }
  };

  useEffect(() => {
    loadData();
    
    // Auto-refresh every 30 seconds for real-time updates
    const interval = setInterval(() => {
      console.log('🔄 Auto-refresh Schichtdaten');
      loadData();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [token, user]);

  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    section: {
      margin: 16,
    },
    
    // User Info Card
    userInfoCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      marginHorizontal: 16,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
      borderWidth: 1,
      borderColor: colors.border + '30',
    },
    userInfoHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },
    userInfoIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary + '20',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    userInfoContent: {
      flex: 1,
    },
    userInfoTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    userInfoSubtitle: {
      fontSize: 14,
      color: colors.textMuted,
      marginTop: 2,
    },
    userInfoDetails: {
      marginTop: 8,
    },
    userInfoRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    userInfoLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginLeft: 8,
      marginRight: 8,
    },
    userInfoValue: {
      fontSize: 14,
      color: colors.textMuted,
      fontWeight: '500',
    },

    // Modern Section Headers
    modernSectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      paddingVertical: 16,
      paddingHorizontal: 20,
      borderRadius: 16,
      marginBottom: 16,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },
    sectionIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 16,
    },
    sectionTextContainer: {
      flex: 1,
    },
    modernSectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 2,
    },
    modernSectionSubtitle: {
      fontSize: 14,
      color: colors.textMuted,
      fontWeight: '500',
    },
    modernQuickButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary + '15',
      justifyContent: 'center',
      alignItems: 'center',
    },

    // District Overview Card
    districtOverviewCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },
    districtHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },
    districtIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.warning + '20',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    districtInfo: {
      flex: 1,
    },
    districtTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    districtTeam: {
      fontSize: 14,
      color: colors.textMuted,
      marginTop: 2,
    },

    // Status Info Cards
    statusInfoGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      marginBottom: 20,
    },
    statusInfoCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      width: '48%',
      marginBottom: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    statusInfoIcon: {
      marginBottom: 8,
    },
    statusInfoTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
    },
    statusInfoValue: {
      fontSize: 12,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: 4,
    },

    // Status Buttons - Kompakt nebeneinander
    statusButtonsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 24,
      paddingHorizontal: 4,
    },
    statusButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      paddingHorizontal: 8,
      borderRadius: 8,
      minHeight: 44,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 3,
    },
    statusButtonText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '700',
      marginLeft: 6,
      textAlign: 'center',
    },

    // Action Buttons
    actionButton: {
      backgroundColor: colors.primary,
      paddingVertical: 16,
      paddingHorizontal: 24,
      borderRadius: 12,
      marginBottom: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 4,
    },
    actionButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
      marginLeft: 8,
    },

    // Modern Check-in Cards
    modernCheckinCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      paddingVertical: 16,
      paddingHorizontal: 20,
      marginBottom: 12,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 3,
      borderWidth: 1,
      borderColor: colors.border + '30',
    },
    modernCheckinHeader: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    checkinIconContainer: {
      marginRight: 16,
    },
    checkinStatusDot: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
    },
    checkinMainContent: {
      flex: 1,
    },
    checkinTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    modernCheckinStatus: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    modernCheckinTime: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
    },
    modernCheckinDate: {
      fontSize: 12,
      color: colors.textMuted,
      marginBottom: 6,
    },
    modernCheckinMessage: {
      fontSize: 14,
      color: colors.text,
      fontStyle: 'italic',
      marginTop: 4,
    },
    checkinActionButton: {
      marginLeft: 12,
    },
    checkinViewButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
    },

    // Modern Vacation Cards
    modernVacationCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      paddingVertical: 16,
      paddingHorizontal: 20,
      marginBottom: 12,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 3,
      borderWidth: 1,
      borderColor: colors.border + '30',
    },
    modernVacationHeader: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    vacationIconContainer: {
      marginRight: 16,
    },
    vacationStatusDot: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
    },
    vacationMainContent: {
      flex: 1,
    },
    vacationTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    modernVacationTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    modernStatusChip: {
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
      borderWidth: 1,
    },
    modernStatusChipText: {
      fontSize: 12,
      fontWeight: '600',
    },
    vacationDateRow: {
      marginBottom: 6,
    },
    vacationDateContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    modernVacationDates: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginLeft: 6,
    },
    vacationReasonContainer: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginTop: 4,
    },
    modernVacationReason: {
      fontSize: 14,
      color: colors.textMuted,
      marginLeft: 6,
      flex: 1,
      lineHeight: 18,
    },

    // Rejection Reason Styles
    rejectionReasonContainer: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginTop: 8,
      backgroundColor: colors.error + '10',
      borderRadius: 8,
      padding: 12,
      borderLeftWidth: 3,
      borderLeftColor: colors.error,
    },
    rejectionReasonText: {
      fontSize: 13,
      color: colors.error,
      marginLeft: 8,
      flex: 1,
      lineHeight: 18,
      fontWeight: '500',
    },
    vacationActionButton: {
      marginLeft: 12,
    },
    vacationViewButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
    },

    // Lists
    listContainer: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      paddingVertical: 8,
      marginBottom: 16,
    },
    listItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border + '30',
    },
    listItemIcon: {
      marginRight: 16,
    },
    listItemContent: {
      flex: 1,
    },
    listItemTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    listItemSubtitle: {
      fontSize: 14,
      color: colors.textMuted,
    },
    listItemBadge: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: colors.primary + '20',
    },
    listItemBadgeText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primary,
    },

    // Modal Styles
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContainer: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 24,
      width: '90%',
      maxWidth: 400,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 24,
    },
    modalIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.primary + '20',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 16,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      flex: 1,
    },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.textMuted + '20',
      justifyContent: 'center',
      alignItems: 'center',
    },
    
    // Form Styles
    formGroup: {
      marginBottom: 20,
    },
    formLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    formInput: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 16,
      color: colors.text,
    },
    formTextArea: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 16,
      color: colors.text,
      height: 100,
      textAlignVertical: 'top',
    },
    
    // Button Row
    buttonRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 24,
    },
    cancelButton: {
      backgroundColor: colors.textMuted + '20',
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 12,
      flex: 1,
      marginRight: 12,
      alignItems: 'center',
    },
    cancelButtonText: {
      color: colors.textMuted,
      fontSize: 16,
      fontWeight: '600',
    },
    submitButton: {
      backgroundColor: colors.primary,
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 12,
      flex: 1,
      marginLeft: 12,
      alignItems: 'center',
    },
    submitButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },

    // Empty State
    emptyContainer: {
      alignItems: 'center',
      paddingVertical: 32,
    },
    emptyText: {
      fontSize: 16,
      color: colors.textMuted,
      marginTop: 16,
      textAlign: 'center',
    },

    // Loading
    loadingContainer: {
      alignItems: 'center',
      paddingVertical: 32,
    },
    loadingText: {
      fontSize: 16,
      color: colors.textMuted,
      marginTop: 16,
    },

    // Modern Modal Styles
    modernModalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingBottom: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border + '30',
      marginBottom: 20,
    },
    modernModalIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.primary + '20',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 16,
    },
    modernModalTitleContainer: {
      flex: 1,
    },
    modernModalTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 2,
    },
    modernModalSubtitle: {
      fontSize: 14,
      color: colors.textMuted,
      fontWeight: '500',
    },
    modernModalCloseButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.textMuted + '15',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modernModalContent: {
      flex: 1,
      paddingBottom: 20,
    },
    modernFormSection: {
      marginBottom: 24,
    },
    modernSectionLabel: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 16,
    },
    dateInputsContainer: {
      marginBottom: 16,
    },
    dateInputWrapper: {
      flex: 1,
    },
    modernInputLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
    },
    modernInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
    },
    modernInput: {
      flex: 1,
      fontSize: 16,
      color: colors.text,
      padding: 0,
    },
    inputHint: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 8,
      fontStyle: 'italic',
    },
    modernModalActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingTop: 20,
      borderTopWidth: 1,
      borderTopColor: colors.border + '30',
    },
    modernActionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      paddingHorizontal: 20,
      borderRadius: 12,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    modernActionButtonText: {
      fontSize: 16,
      fontWeight: '700',
    },
  });

  return (
    <ScrollView style={dynamicStyles.container}>
      {/* User Info Card */}
      <View style={dynamicStyles.userInfoCard}>
        <View style={dynamicStyles.userInfoHeader}>
          <View style={dynamicStyles.userInfoIcon}>
            <Ionicons name="person" size={20} color={colors.primary} />
          </View>
          <View style={dynamicStyles.userInfoContent}>
            <Text style={dynamicStyles.userInfoTitle}>Meine Dienstinfos</Text>
            <Text style={dynamicStyles.userInfoSubtitle}>Aktuelle Zuordnung</Text>
          </View>
        </View>
        
        <View style={dynamicStyles.userInfoDetails}>
          <View style={dynamicStyles.userInfoRow}>
            <Ionicons name="people" size={16} color={colors.secondary} />
            <Text style={dynamicStyles.userInfoLabel}>Team:</Text>
            <Text style={dynamicStyles.userInfoValue}>
              {user?.patrol_team || 'Nicht zugewiesen'}
            </Text>
          </View>
          
          <View style={dynamicStyles.userInfoRow}>
            <Ionicons name="map" size={16} color={colors.warning} />
            <Text style={dynamicStyles.userInfoLabel}>Bezirk:</Text>
            <Text style={dynamicStyles.userInfoValue}>
              {user?.assigned_district || 'Nicht zugewiesen'}
            </Text>
          </View>
        </View>
      </View>

      {/* Status Check-In Buttons */}
      <View style={dynamicStyles.section}>
        <View style={dynamicStyles.modernSectionHeader}>
          <View style={dynamicStyles.sectionIconContainer}>
            <Ionicons name="shield-checkmark" size={24} color="#FFFFFF" />
          </View>
          <View style={dynamicStyles.sectionTextContainer}>
            <Text style={dynamicStyles.modernSectionTitle}>Status Check-In</Text>
            <Text style={dynamicStyles.modernSectionSubtitle}>Aktueller Dienststatus</Text>
          </View>
        </View>
        
        <View style={dynamicStyles.statusButtonsContainer}>
          <TouchableOpacity
            style={[dynamicStyles.statusButton, { backgroundColor: colors.success, flex: 1, marginRight: 4 }]}
            onPress={() => performCheckIn('ok')}
          >
            <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
            <Text style={dynamicStyles.statusButtonText}>✅ OK</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[dynamicStyles.statusButton, { backgroundColor: colors.warning, flex: 1, marginHorizontal: 4 }]}
            onPress={() => performCheckIn('help_needed')}
          >
            <Ionicons name="help-circle" size={20} color="#FFFFFF" />
            <Text style={dynamicStyles.statusButtonText}>🆘 Hilfe</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[dynamicStyles.statusButton, { backgroundColor: colors.error, flex: 1, marginLeft: 4 }]}
            onPress={() => performCheckIn('emergency')}
          >
            <Ionicons name="warning" size={20} color="#FFFFFF" />
            <Text style={dynamicStyles.statusButtonText}>🚨 Notfall</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Recent Check-Ins */}
      <View style={dynamicStyles.section}>
        <View style={dynamicStyles.modernSectionHeader}>
          <View style={dynamicStyles.sectionIconContainer}>
            <Ionicons name="time" size={24} color="#FFFFFF" />
          </View>
          <View style={dynamicStyles.sectionTextContainer}>
            <Text style={dynamicStyles.modernSectionTitle}>Letzte Check-Ins</Text>
            <Text style={[dynamicStyles.modernSectionSubtitle, { color: colors.text, opacity: 0.8 }]}>Aktivitäten und Status</Text>
          </View>
          <TouchableOpacity 
            style={dynamicStyles.modernQuickButton}
            onPress={() => performCheckIn('ok')}
          >
            <Ionicons name="add-circle" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
        
        {checkins.length > 0 ? (
          checkins.slice(0, 3).map((checkin, index) => (
            <View key={checkin.id || index} style={dynamicStyles.modernCheckinCard}>
              <View style={dynamicStyles.modernCheckinHeader}>
                <View style={dynamicStyles.checkinIconContainer}>
                  <View style={[dynamicStyles.checkinStatusDot, { backgroundColor: getStatusColor(checkin.status) }]}>
                    <Ionicons 
                      name={checkin.status === 'ok' ? 'checkmark' : 
                            checkin.status === 'emergency' ? 'warning' : 
                            checkin.status === 'help_needed' ? 'help-circle' : 'information'}
                      size={14} 
                      color="#FFFFFF" 
                    />
                  </View>
                </View>
                
                <View style={dynamicStyles.checkinMainContent}>
                  <View style={dynamicStyles.checkinTopRow}>
                    <Text style={dynamicStyles.modernCheckinStatus}>
                      {getStatusText(checkin.status)}
                    </Text>
                    <Text style={dynamicStyles.modernCheckinTime}>
                      {new Date(checkin.timestamp).toLocaleTimeString('de-DE', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </Text>
                  </View>
                  
                  <Text style={dynamicStyles.modernCheckinDate}>
                    {new Date(checkin.timestamp).toLocaleDateString('de-DE', {
                      day: '2-digit',
                      month: '2-digit', 
                      year: 'numeric'
                    })}
                  </Text>
                  
                  {checkin.message && (
                    <Text style={dynamicStyles.modernCheckinMessage}>
                      💬 {checkin.message}
                    </Text>
                  )}
                </View>

                <View style={dynamicStyles.checkinActionButton}>
                  <TouchableOpacity 
                    style={dynamicStyles.checkinViewButton}
                    onPress={() => {
                      Alert.alert(
                        '📋 Check-In Details',
                        `Status: ${getStatusText(checkin.status)}\nZeit: ${new Date(checkin.timestamp).toLocaleString('de-DE')}\n${checkin.message ? `Nachricht: ${checkin.message}` : 'Keine Nachricht'}`,
                        [{ text: 'OK' }]
                      );
                    }}
                  >
                    <Ionicons name="ellipsis-horizontal" size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))
        ) : (
          <View style={dynamicStyles.emptyCheckins}>
            <Ionicons name="time-outline" size={48} color={colors.textMuted} />
            <Text style={dynamicStyles.emptyText}>Noch keine Check-Ins vorhanden</Text>
           
          </View>
        )}
      </View>

      {/* Vacation Requests */}
      <View style={dynamicStyles.section}>
        <View style={dynamicStyles.modernSectionHeader}>
          <View style={dynamicStyles.sectionIconContainer}>
            <Ionicons name="calendar" size={24} color="#ffffffff" />
          </View>
          <View style={dynamicStyles.sectionTextContainer}>
            <Text style={dynamicStyles.modernSectionTitle}>Meine Urlaubsanträge</Text>
            <Text style={[dynamicStyles.modernSectionSubtitle, { color: colors.text, opacity: 0.8 }]}>Status und Verwaltung</Text>
          </View>
          <TouchableOpacity 
            style={dynamicStyles.modernQuickButton}
            onPress={() => setShowVacationModal(true)}
          >
            <Ionicons name="add-circle" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
        
        {vacations.length === 0 ? (
          <View style={dynamicStyles.emptyCheckins}>
            <Ionicons name="calendar-outline" size={48} color={colors.textMuted} />
            <Text style={dynamicStyles.emptyText}>Keine Urlaubsanträge vorhanden</Text>
          
          </View>
        ) : (
          vacations.map((vacation, index) => (
            <View key={vacation.id || index} style={dynamicStyles.modernVacationCard}>
              <View style={dynamicStyles.modernVacationHeader}>
                <View style={dynamicStyles.vacationIconContainer}>
                  <View style={[dynamicStyles.vacationStatusDot, { backgroundColor: getStatusColor(vacation.status) }]}>
                    <Ionicons 
                      name={vacation.status === 'approved' ? 'checkmark' : 
                            vacation.status === 'rejected' ? 'close' : 
                            'time'}
                      size={16} 
                      color="#FFFFFF" 
                    />
                  </View>
                </View>
                
                <View style={dynamicStyles.vacationMainContent}>
                  <View style={dynamicStyles.vacationTopRow}>
                    <Text style={dynamicStyles.modernVacationTitle}>
                      📅 Urlaubsantrag
                    </Text>
                    <View style={[dynamicStyles.modernStatusChip, { backgroundColor: getStatusColor(vacation.status) + '20', borderColor: getStatusColor(vacation.status) }]}>
                      <Text style={[dynamicStyles.modernStatusChipText, { color: getStatusColor(vacation.status) }]}>
                        {getStatusText(vacation.status)}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={dynamicStyles.vacationDateRow}>
                    <View style={dynamicStyles.vacationDateContainer}>
                      <Ionicons name="calendar-outline" size={14} color={colors.primary} />
                      <Text style={dynamicStyles.modernVacationDates}>
                        {vacation.start_date} bis {vacation.end_date}
                      </Text>
                    </View>
                  </View>
                  
                  {vacation.reason && (
                    <View style={dynamicStyles.vacationReasonContainer}>
                      <Ionicons name="document-text-outline" size={14} color={colors.textMuted} />
                      <Text style={dynamicStyles.modernVacationReason} numberOfLines={2}>
                        {vacation.reason}
                      </Text>
                    </View>
                  )}

                  {/* Rejection Reason - Show if vacation is rejected */}
                  {vacation.status === 'rejected' && vacation.rejection_reason && (
                    <View style={dynamicStyles.rejectionReasonContainer}>
                      <Ionicons name="warning-outline" size={14} color={colors.error} />
                      <Text style={dynamicStyles.rejectionReasonText} numberOfLines={3}>
                        Ablehnungsgrund: {vacation.rejection_reason}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={dynamicStyles.vacationActionButton}>
                  <TouchableOpacity 
                    style={dynamicStyles.vacationViewButton}
                    onPress={() => {
                      Alert.alert(
                        '🗑️ Urlaubsantrag löschen',
                        `Möchten Sie diesen Urlaubsantrag wirklich löschen?\n\nZeitraum: ${vacation.start_date} bis ${vacation.end_date}\nStatus: ${getStatusText(vacation.status)}`,
                        [
                          { text: 'Abbrechen', style: 'cancel' },
                          { 
                            text: 'Löschen', 
                            style: 'destructive',
                            onPress: async () => {
                              try {
                                const config = token ? {
                                  headers: { 
                                    Authorization: `Bearer ${token}`,
                                    'Content-Type': 'application/json'
                                  }
                                } : {};
                                
                                await axios.delete(`${API_URL}/api/vacations/${vacation.id}`, config);
                                
                                Alert.alert('✅ Erfolg', 'Urlaubsantrag wurde gelöscht');
                                
                                // Sofortige UI-Aktualisierung
                                setVacations(prev => prev.filter(v => v.id !== vacation.id));
                                
                                // Liste neu laden für Sicherheit
                                await loadVacations();
                                
                              } catch (error) {
                                console.error('❌ Error deleting vacation:', error);
                                Alert.alert('❌ Fehler', 'Urlaubsantrag konnte nicht gelöscht werden');
                              }
                            }
                          }
                        ]
                      );
                    }}
                  >
                    <Ionicons name="trash" size={16} color={colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Modern Vacation Request Modal */}
      <Modal
        visible={showVacationModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowVacationModal(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View style={dynamicStyles.modalOverlay}>
            <View style={[dynamicStyles.modalContainer, { maxHeight: '80%' }]}>
              {/* Modern Header */}
              <View style={dynamicStyles.modernModalHeader}>
                <View style={dynamicStyles.modernModalIconContainer}>
                  <Ionicons name="calendar" size={28} color={colors.primary} />
                </View>
                <View style={dynamicStyles.modernModalTitleContainer}>
                  <Text style={dynamicStyles.modernModalTitle}>📅 Urlaubsantrag</Text>
                  <Text style={dynamicStyles.modernModalSubtitle}>Neuen Urlaub beantragen</Text>
                </View>
                <TouchableOpacity
                  style={dynamicStyles.modernModalCloseButton}
                  onPress={() => setShowVacationModal(false)}
                >
                  <Ionicons name="close" size={24} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <ScrollView 
                style={dynamicStyles.modernModalContent}
                showsVerticalScrollIndicator={false}
              >
                {/* Date Selection */}
                <View style={dynamicStyles.modernFormSection}>
                  <Text style={dynamicStyles.modernSectionLabel}>📅 Urlaubszeitraum</Text>
                  
                  <View style={dynamicStyles.dateInputsContainer}>
                    <View style={dynamicStyles.dateInputWrapper}>
                      <Text style={dynamicStyles.modernInputLabel}>Von *</Text>
                      <View style={dynamicStyles.modernInputContainer}>
                        <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                        <TextInput
                          style={dynamicStyles.modernInput}
                          value={vacationFormData.start_date}
                          onChangeText={(value) => setVacationFormData({...vacationFormData, start_date: value})}
                          placeholder="YYYY-MM-DD"
                          placeholderTextColor={colors.textMuted}
                        />
                      </View>
                    </View>
                    
                    <View style={dynamicStyles.dateInputWrapper}>
                      <Text style={dynamicStyles.modernInputLabel}>Bis *</Text>
                      <View style={dynamicStyles.modernInputContainer}>
                        <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                        <TextInput
                          style={dynamicStyles.modernInput}
                          value={vacationFormData.end_date}
                          onChangeText={(value) => setVacationFormData({...vacationFormData, end_date: value})}
                          placeholder="YYYY-MM-DD"
                          placeholderTextColor={colors.textMuted}
                        />
                      </View>
                    </View>
                  </View>
                </View>

                {/* Reason Section */}
                <View style={dynamicStyles.modernFormSection}>
                  <Text style={dynamicStyles.modernSectionLabel}>📝 Begründung</Text>
                  <View style={dynamicStyles.modernInputContainer}>
                    <Ionicons name="document-text-outline" size={20} color={colors.primary} />
                    <TextInput
                      style={[dynamicStyles.modernInput, { 
                        height: 100, 
                        textAlignVertical: 'top',
                        paddingTop: 16
                      }]}
                      value={vacationFormData.reason}
                      onChangeText={(value) => setVacationFormData({...vacationFormData, reason: value})}
                      placeholder="z.B. Familienurlaub, Erholung, persönliche Angelegenheiten..."
                      placeholderTextColor={colors.textMuted}
                      multiline
                      numberOfLines={4}
                    />
                  </View>
                  <Text style={dynamicStyles.inputHint}>
                    💡 Eine Begründung hilft bei der schnelleren Bearbeitung
                  </Text>
                </View>
              </ScrollView>

              {/* Modern Action Buttons */}
              <View style={dynamicStyles.modernModalActions}>
                <TouchableOpacity
                  style={[dynamicStyles.modernActionButton, { backgroundColor: colors.textMuted + '20' }]}
                  onPress={() => setShowVacationModal(false)}
                >
                  <Text style={[dynamicStyles.modernActionButtonText, { color: colors.textMuted }]}>
                    Abbrechen
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[dynamicStyles.modernActionButton, { backgroundColor: colors.primary }]}
                  onPress={requestVacation}
                >
                  <Ionicons name="send" size={18} color="#FFFFFF" />
                  <Text style={[dynamicStyles.modernActionButtonText, { color: '#FFFFFF', marginLeft: 8 }]}>
                    Antrag einreichen
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
};

export default ShiftManagementComponent;
