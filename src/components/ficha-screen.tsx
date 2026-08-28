import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useCollection } from '@/context/collection-context';
import { useTheme } from '@/hooks/use-theme';
import { formatFecha, getCard, getDetailImage } from '@/lib/catalogo';

// Rutas compartidas por src/app/catalogo/ficha/[id].tsx y
// src/app/mi-coleccion/ficha/[id].tsx -- NativeTabs necesita un Stack
// propio dentro de cada tab para poder empujar una pantalla de detalle,
// así que la Ficha vive dentro de ambos, apuntando a este mismo componente.
export function FichaScreen({ id }: { id: string | undefined }) {
  const theme = useTheme();
  const { has, toggle } = useCollection();
  const [imageFailed, setImageFailed] = useState(false);
  const card = getCard(id);

  if (!card) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText>Tarjeta no encontrada.</ThemedText>
      </ThemedView>
    );
  }

  const tengo = has(card.id);
  const source = getDetailImage(card.id);
  const fecha = formatFecha(card.fecha);

  const onToggle = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    await toggle(card.id);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <ThemedView style={styles.container}>
        <View style={[styles.imageWrapper, { backgroundColor: theme.backgroundElement }]}>
          {!imageFailed && source ? (
            <Image
              source={source}
              style={styles.image}
              contentFit="contain"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <View style={[styles.image, styles.imageFallback]}>
              <SymbolView
                name={{ ios: 'photo', android: 'image', web: 'image' }}
                size={48}
                tintColor={theme.textSecondary}
              />
            </View>
          )}
        </View>

        <ThemedText type="subtitle">{fecha ?? card.nota ?? 'Sin fecha registrada'}</ThemedText>
        {fecha && card.nota ? (
          <ThemedText themeColor="textSecondary">{card.nota}</ThemedText>
        ) : null}

        <Pressable
          onPress={onToggle}
          accessibilityRole="button"
          accessibilityLabel={tengo ? 'Marcar como pendiente' : 'Marcar como que la tengo'}
          style={({ pressed }) => [
            styles.toggle,
            { backgroundColor: tengo ? theme.accent : theme.backgroundElement },
            pressed && styles.pressed,
          ]}>
          <SymbolView
            name={{
              ios: tengo ? 'checkmark.circle.fill' : 'circle',
              android: tengo ? 'check_circle' : 'radio_button_unchecked',
              web: tengo ? 'check_circle' : 'radio_button_unchecked',
            }}
            size={20}
            tintColor={tengo ? theme.onAccent : theme.text}
          />
          <ThemedText style={tengo ? { color: theme.onAccent } : undefined}>
            {tengo ? 'La tengo' : 'Marcar como que la tengo'}
          </ThemedText>
        </Pressable>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  imageWrapper: {
    aspectRatio: 1.6,
    borderRadius: Spacing.three,
    overflow: 'hidden',
    marginBottom: Spacing.two,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggle: {
    marginTop: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    minHeight: 44,
    borderRadius: Spacing.five,
    paddingHorizontal: Spacing.four,
  },
  pressed: {
    opacity: 0.7,
  },
});
