import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CardTile } from '@/components/card-tile';
import { EmptyState } from '@/components/empty-state';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useCollection } from '@/context/collection-context';
import { useTheme } from '@/hooks/use-theme';
import { catalogo, formatFecha, type CatalogCard } from '@/lib/catalogo';

function matchesQuery(card: CatalogCard, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const fecha = formatFecha(card.fecha)?.toLowerCase() ?? '';
  const nota = card.nota?.toLowerCase() ?? '';
  return fecha.includes(q) || nota.includes(q) || card.id.includes(q);
}

type Filtro = 'todas' | 'faltan';

export default function CatalogoScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { has } = useCollection();
  const [query, setQuery] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todas');

  const data = useMemo(
    () =>
      catalogo.filter(
        (card) => matchesQuery(card, query) && (filtro === 'todas' || !has(card.id))
      ),
    [query, filtro, has]
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top']}>
      <ThemedView style={styles.header}>
        <ThemedText type="title" style={styles.title}>
          Catálogo
        </ThemedText>
        <ThemedView type="backgroundElement" style={styles.searchBar}>
          <SymbolView
            name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
            size={16}
            tintColor={theme.textSecondary}
          />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar por fecha..."
            placeholderTextColor={theme.textSecondary}
            style={[styles.searchInput, { color: theme.text }]}
            accessibilityLabel="Buscar tarjetas por fecha"
          />
        </ThemedView>

        <ThemedView style={styles.filterRow}>
          {(
            [
              { key: 'todas', label: 'Todas' },
              { key: 'faltan', label: 'No tengo' },
            ] as const
          ).map((option) => {
            const selected = filtro === option.key;
            return (
              <Pressable
                key={option.key}
                onPress={() => setFiltro(option.key)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={({ pressed }) => [
                  styles.filterPill,
                  { backgroundColor: selected ? theme.accent : theme.backgroundElement },
                  pressed && styles.pressed,
                ]}>
                <ThemedText
                  type="smallBold"
                  style={{ color: selected ? theme.onAccent : theme.textSecondary }}>
                  {option.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </ThemedView>
      </ThemedView>

      <FlatList
        data={data}
        keyExtractor={(card) => card.id}
        numColumns={3}
        contentContainerStyle={styles.grid}
        renderItem={({ item }) => (
          <CardTile
            card={item}
            tengo={has(item.id)}
            onPress={() => router.push(`/catalogo/ficha/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          filtro === 'faltan' && !query.trim() ? (
            <EmptyState
              icon={{ ios: 'checkmark.circle', android: 'check_circle', web: 'check_circle' }}
              title="¡Ya las tienes todas!"
              hint="No te falta ninguna tarjeta del catálogo."
            />
          ) : (
            <EmptyState
              icon={{ ios: 'magnifyingglass', android: 'search_off', web: 'search_off' }}
              title="Sin resultados"
              hint="Ninguna tarjeta coincide con esa búsqueda."
            />
          )
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
    // The web tab bar (app-tabs.web.tsx) floats via position: absolute
    // over the top of the screen instead of taking up layout space.
    paddingTop: Platform.OS === 'web' ? Spacing.six : 0,
    gap: Spacing.two,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Spacing.five,
    paddingHorizontal: Spacing.three,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  filterRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  filterPill: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
    minHeight: 32,
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  grid: {
    flexGrow: 1,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.six,
  },
});
