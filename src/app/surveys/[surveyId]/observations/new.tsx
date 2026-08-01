import { Redirect, useLocalSearchParams } from "expo-router";

export default function SelectLocaleBeforeObservationScreen() {
  const { surveyId } = useLocalSearchParams<{ surveyId: string }>();
  return <Redirect href={{ pathname: "/surveys/[surveyId]", params: { surveyId } }} />;
}
