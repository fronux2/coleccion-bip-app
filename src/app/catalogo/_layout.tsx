import { Stack } from 'expo-router';

// NativeTabs necesita un Stack nativo anidado dentro del tab para poder
// empujar una pantalla de detalle (ver https://docs.expo.dev/router/advanced/native-tabs/).
export default function CatalogoLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="ficha/[id]" options={{ title: '' }} />
    </Stack>
  );
}
