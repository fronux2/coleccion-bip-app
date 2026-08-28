import { Stack } from 'expo-router';

export default function MiColeccionLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="ficha/[id]" options={{ title: '' }} />
    </Stack>
  );
}
