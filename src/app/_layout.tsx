import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { DatabaseProvider } from "@/storage/DatabaseProvider";
import { AppKeyboardProvider } from "@/ui/AppKeyboardProvider";
import { colors } from "@/ui/theme";

export default function RootLayout() {
  return (
    <AppKeyboardProvider>
      <DatabaseProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.green800 },
            headerTintColor: "#FFFFFF",
            headerTitleStyle: { fontWeight: "700" },
            headerBackButtonDisplayMode: "minimal",
            contentStyle: { backgroundColor: colors.background },
          }}
        >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="surveys/index" options={{ title: "Inventeringar" }} />
            <Stack.Screen name="surveys/new" options={{ title: "Ny inventering", presentation: "modal" }} />
            <Stack.Screen name="surveys/[surveyId]/index" options={{ title: "Inventering" }} />
            <Stack.Screen
              name="surveys/[surveyId]/edit"
              options={{ title: "Redigera inventering", presentation: "modal" }}
            />
            <Stack.Screen name="surveys/[surveyId]/map" options={{ title: "Karta" }} />
            <Stack.Screen name="species-lists/index" options={{ title: "Artlistor" }} />
            <Stack.Screen name="species-lists/new" options={{ title: "Ny artlista", presentation: "modal" }} />
            <Stack.Screen name="species-lists/[listId]/index" options={{ title: "Artlista" }} />
            <Stack.Screen name="species-lists/[listId]/add" options={{ title: "Lägg till arter", presentation: "modal" }} />
            <Stack.Screen name="settings" options={{ title: "Inställningar" }} />
            <Stack.Screen
              name="surveys/[surveyId]/locales/new"
              options={{ title: "Ny lokal", presentation: "modal" }}
            />
            <Stack.Screen
              name="surveys/[surveyId]/locales/[localeId]/index"
              options={{ title: "Lokal" }}
            />
            <Stack.Screen
              name="surveys/[surveyId]/locales/[localeId]/edit"
              options={{ title: "Redigera lokal", presentation: "modal" }}
            />
            <Stack.Screen
              name="surveys/[surveyId]/locales/[localeId]/observations/new"
              options={{ title: "Ny observation", presentation: "modal" }}
            />
            <Stack.Screen
              name="surveys/[surveyId]/observations/new"
              options={{ title: "Ny observation", presentation: "modal" }}
            />
            <Stack.Screen
              name="surveys/[surveyId]/observations/[observationId]"
              options={{ title: "Redigera observation", presentation: "modal" }}
            />
        </Stack>
      </DatabaseProvider>
    </AppKeyboardProvider>
  );
}
