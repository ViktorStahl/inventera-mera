import { Alert } from "react-native";

export function confirmDestructive(title: string, message: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: "Avbryt", style: "cancel", onPress: () => resolve(false) },
      { text: "Radera", style: "destructive", onPress: () => resolve(true) },
    ]);
  });
}
