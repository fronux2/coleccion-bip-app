import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CardTile } from '@/components/card-tile';
import { EmptyState } from '@/components/empty-state';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useCollection } from '@/context/collection-context';
import { useTheme } from '@/hooks/use-theme';
import { catalogo } from '@/lib/catalogo';

export default function MiColeccionScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { has } = useCollection();

  const data = useMemo(() => catalogo.filter((card) => has(card.id)), [has]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top']}>
      <ThemedView style={styles.header}>
        <ThemedText type="title" style={styles.title}>
          Mi colección
        </ThemedText>
      </ThemedView>

      <FlatList
        data={data}
        keyExtractor={(card) => card.id}
        numColumns={3}
        contentContainerStyle={data.length === 0 ? styles.gridEmpty : styles.grid}
        renderItem={({ item }) => (
          <CardTile
            card={item}
            tengo
            onPress={() => router.push(`/mi-coleccion/ficha/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon={{ ios: 'star', android: 'star_outline', web: 'star_outline' }}
            title="Todavía no tienes tarjetas"
            hint="Marca 'La tengo' en una tarjeta del Catálogo para verla acá."
            actionLabel="Ir al Catálogo"
            onAction={() => router.push('/catalogo')}
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
    paddingTop: Platform.OS === 'web' ? Spacing.six : 0,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
  },
  grid: {
    flexGrow: 1,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.six,
  },
  gridEmpty: {
    flexGrow: 1,
  },
});
