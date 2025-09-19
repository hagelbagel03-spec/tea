// SYNTAX FIX SCRIPT für Windows System
// Führen Sie aus: node fix_syntax.js

const fs = require('fs');
const path = require('path');

console.log('🔧 Starte Syntax-Fix für index.tsx...');

const filePath = './frontend/app/index.tsx';

try {
  // Lese die Datei
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Finde und ersetze das problematische Team-Mapping
  const problematicPattern = /{availableTeams\.length > 0 \? availableTeams\.map\(\(team\) => \([\s\S]*?\)\)\s*:\s*\([\s\S]*?\)\)}/;
  
  const simpleReplacement = `{/* ✅ SYNTAX FIX: Einfache Team-Liste ohne ternary */}
                {availableTeams.map((team) => (
                  <TouchableOpacity
                    key={team.id}
                    onPress={() => setSelectedTeam(team)}
                    style={{
                      backgroundColor: selectedTeam?.id === team.id ? colors.primary + '20' : colors.card,
                      padding: 16,
                      marginVertical: 4,
                      borderRadius: 12,
                      borderWidth: 2,
                      borderColor: selectedTeam?.id === team.id ? colors.primary : colors.border,
                      flexDirection: 'row',
                      alignItems: 'center'
                    }}
                  >
                    <Ionicons 
                      name={selectedTeam?.id === team.id ? "radio-button-on" : "radio-button-off"} 
                      size={20} 
                      color={selectedTeam?.id === team.id ? colors.primary : colors.textMuted} 
                    />
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <Text style={{
                        color: colors.text,
                        fontWeight: '600',
                        fontSize: 16
                      }}>
                        {team.name || 'Team'}
                      </Text>
                      <Text style={{
                        color: colors.textMuted,
                        fontSize: 14,
                        marginTop: 2
                      }}>
                        {team.description || 'Beschreibung'}
                      </Text>
                    </View>
                    <View style={{
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 8,
                      backgroundColor: colors.success + '20'
                    }}>
                      <Text style={{
                        fontSize: 12,
                        fontWeight: '600',
                        color: colors.success
                      }}>
                        {team.status || 'Aktiv'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}`;
  
  // Ersetze den problematischen Code
  if (content.match(problematicPattern)) {
    content = content.replace(problematicPattern, simpleReplacement);
    console.log('✅ Problematisches Pattern gefunden und ersetzt');
  } else {
    console.log('⚠️ Pattern nicht gefunden, suche nach alternativen...');
    
    // Alternative: Suche nach dem spezifischen ))} Problem
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('))}') && lines[i-1] && lines[i-1].includes('</TouchableOpacity>')) {
        console.log(`🎯 Gefunden bei Zeile ${i+1}: ${lines[i]}`);
        
        // Ersetze die problematische Zeile
        lines[i] = '                ))}';
        content = lines.join('\n');
        console.log('✅ Syntax-Problem bei ))} behoben');
        break;
      }
    }
  }
  
  // Schreibe die reparierte Datei
  fs.writeFileSync(filePath, content);
  console.log('✅ Datei erfolgreich repariert und gespeichert!');
  
} catch (error) {
  console.error('❌ Fehler:', error.message);
}

console.log('🎉 Syntax-Fix abgeschlossen!');