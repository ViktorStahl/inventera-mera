import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, View } from "react-native";

import { AVAILABLE_TAXONOMIES } from "@/data/taxonomies";
import {
  clearLantmaterietCredentials,
  getLantmaterietCredentials,
  saveLantmaterietCredentials,
} from "@/features/map/credentials";
import {
  validateLantmaterietCredentials,
  verifyLantmaterietCredentials,
} from "@/features/map/lantmateriet";
import { getAppSettings, updateDefaultTaxonomy } from "@/storage/database";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Field } from "@/ui/Field";
import { messageOf } from "@/ui/errors";
import { Screen } from "@/ui/Screen";
import { colors, spacing } from "@/ui/theme";

export default function SettingsScreen() {
  const [defaultTaxonomyPackageId, setDefaultTaxonomyPackageId] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [mapCredentialsLoaded, setMapCredentialsLoaded] = useState(false);
  const [mapCredentialsConfigured, setMapCredentialsConfigured] = useState(false);
  const [mapUsername, setMapUsername] = useState("");
  const [mapPassword, setMapPassword] = useState("");
  const [savingMapCredentials, setSavingMapCredentials] = useState(false);

  useEffect(() => {
    getAppSettings()
      .then((settings) => setDefaultTaxonomyPackageId(settings.defaultTaxonomyPackageId))
      .catch((error) => Alert.alert("Inställningarna kunde inte läsas", messageOf(error)));
    getLantmaterietCredentials()
      .then((credentials) => {
        if (credentials) {
          setMapUsername(credentials.username);
          setMapPassword(credentials.password);
          setMapCredentialsConfigured(true);
        }
      })
      .catch((error) => Alert.alert("Kartinställningen kunde inte läsas", messageOf(error)))
      .finally(() => setMapCredentialsLoaded(true));
  }, []);

  async function selectTaxonomy(packageId: string) {
    if (saving || packageId === defaultTaxonomyPackageId) return;
    const previous = defaultTaxonomyPackageId;
    setDefaultTaxonomyPackageId(packageId);
    setSaving(true);
    try {
      await updateDefaultTaxonomy(packageId);
    } catch (error) {
      setDefaultTaxonomyPackageId(previous);
      Alert.alert("Inställningen kunde inte sparas", messageOf(error));
    } finally {
      setSaving(false);
    }
  }

  async function connectMap() {
    if (savingMapCredentials) return;
    setSavingMapCredentials(true);
    try {
      const credentials = validateLantmaterietCredentials({
        username: mapUsername,
        password: mapPassword,
      });
      await verifyLantmaterietCredentials(credentials);
      await saveLantmaterietCredentials(credentials);
      setMapUsername(credentials.username);
      setMapCredentialsConfigured(true);
      Alert.alert(
        "Kartan är ansluten",
        Platform.OS === "web"
          ? "Uppgifterna används bara tills webbsidan laddas om."
          : "Uppgifterna sparades krypterat på den här enheten.",
      );
    } catch (error) {
      Alert.alert("Kartan kunde inte anslutas", messageOf(error));
    } finally {
      setSavingMapCredentials(false);
    }
  }

  async function disconnectMap() {
    if (savingMapCredentials) return;
    setSavingMapCredentials(true);
    try {
      await clearLantmaterietCredentials();
      setMapUsername("");
      setMapPassword("");
      setMapCredentialsConfigured(false);
    } catch (error) {
      Alert.alert("Kartinställningen kunde inte tas bort", messageOf(error));
    } finally {
      setSavingMapCredentials(false);
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: "Inställningar" }} />
      <Text style={styles.heading}>Standardtaxonomi</Text>
      <Text style={styles.hint}>
        Väljs automatiskt när du skapar en ny inventering eller artlista. Befintliga data ändras inte.
      </Text>
      {defaultTaxonomyPackageId == null ? (
        <ActivityIndicator color={colors.green700} />
      ) : (
        AVAILABLE_TAXONOMIES.map((taxonomy) => {
          const selected = taxonomy.packageId === defaultTaxonomyPackageId;
          return (
            <Card
              key={taxonomy.packageId}
              onPress={() => void selectTaxonomy(taxonomy.packageId)}
              style={selected ? styles.selected : undefined}
              accessibilityLabel={`Använd ${taxonomy.name} som standardtaxonomi`}
            >
              <Text style={styles.title}>{selected ? "✓ " : ""}{taxonomy.name}</Text>
              <Text style={styles.meta}>{taxonomy.description}</Text>
              <Text style={styles.offline}>{taxonomy.downloaded ? "Tillgänglig offline" : "Inte hämtad"}</Text>
            </Card>
          );
        })
      )}
      {saving ? <Text style={styles.saving}>Sparar …</Text> : null}

      <View style={styles.section}>
        <Text style={styles.heading}>Lantmäteriets karta</Text>
        <Text style={styles.hint}>
          Ansluter den färgade Topografiska webbkartan med ditt eget användarnamn och lösenord.
          Kartan kräver internetanslutning och koordinatnätet används när tjänsten inte kan nås.
        </Text>
        {!mapCredentialsLoaded ? (
          <ActivityIndicator color={colors.green700} />
        ) : (
          <Card>
            <Field
              label="Användarnamn"
              value={mapUsername}
              onChangeText={setMapUsername}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete={Platform.OS === "web" ? "off" : "username"}
              editable={!savingMapCredentials}
            />
            <Field
              label="Lösenord"
              value={mapPassword}
              onChangeText={setMapPassword}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete={Platform.OS === "web" ? "off" : "current-password"}
              secureTextEntry
              editable={!savingMapCredentials}
            />
            <Text style={mapCredentialsConfigured ? styles.connected : styles.meta}>
              {mapCredentialsConfigured
                ? Platform.OS === "web"
                  ? "Ansluten för den här webbsessionen"
                  : "Sparad krypterat på den här enheten"
                : "Inte ansluten"}
            </Text>
            <View style={styles.actions}>
              <Button
                label={Platform.OS === "web" ? "Anslut för sessionen" : "Testa och spara"}
                onPress={() => void connectMap()}
                loading={savingMapCredentials}
                style={styles.action}
              />
              {mapCredentialsConfigured ? (
                <Button
                  label="Ta bort uppgifter"
                  variant="danger"
                  onPress={() => void disconnectMap()}
                  disabled={savingMapCredentials}
                  style={styles.action}
                />
              ) : null}
            </View>
            {Platform.OS === "web" ? (
              <Text style={styles.sessionHint}>
                Uppgifterna skrivs inte till webbläsarens lagring och försvinner när sidan laddas om.
              </Text>
            ) : null}
          </Card>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { color: colors.text, fontSize: 20, fontWeight: "700" },
  hint: { color: colors.textMuted, lineHeight: 20, marginBottom: spacing.sm },
  section: { gap: spacing.sm, marginTop: spacing.xl },
  selected: { borderColor: colors.green700, borderWidth: 2, backgroundColor: colors.green100 },
  title: { color: colors.text, fontSize: 16, fontWeight: "700" },
  meta: { color: colors.textMuted, marginTop: spacing.xs },
  offline: { color: colors.green800, fontSize: 13, marginTop: spacing.sm },
  saving: { color: colors.textMuted, textAlign: "center" },
  connected: { color: colors.green800, fontWeight: "700", marginTop: spacing.xs },
  actions: { gap: spacing.sm, marginTop: spacing.md },
  action: { flex: 1 },
  sessionHint: { color: colors.textMuted, fontSize: 13, lineHeight: 18, marginTop: spacing.sm },
});
