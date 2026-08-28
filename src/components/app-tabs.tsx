import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.text } }}>
      <NativeTabs.Trigger name="catalogo">
        <NativeTabs.Trigger.Label>Catálogo</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="square.grid.3x3.fill" md="grid_view" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="mi-coleccion">
        <NativeTabs.Trigger.Label>Mi colección</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="star.fill" md="star" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="progreso">
        <NativeTabs.Trigger.Label>Progreso</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="chart.pie.fill" md="pie_chart" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
