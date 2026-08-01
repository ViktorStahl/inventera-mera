import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { DatabaseProvider } from "@/storage/DatabaseProvider";
import { colors } from "@/ui/theme";

export default function RootLayout() {
  return (
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
        <Stack.Screen name="surveys/[surveyId]/map" options={{ title: "Karta" }} />
        <Stack.Screen
          name="surveys/[surveyId]/observations/new"
          options={{ title: "Ny observation", presentation: "modal" }}
        />
      </Stack>
    </DatabaseProvider>
  );
}
