import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { type CatalogCard, formatFecha, getThumbnail } from '@/lib/catalogo';

type CardTileProps = {
  card: CatalogCard;
  tengo: boolean;
  onPress: () => void;
  columns: number;
};

// Aspect ratio 1.6 = proporción real de una tarjeta física BIP (ver
// docs/designs/coleccion-bip.md, Sistema Visual). Columnas responsivas --
// ver src/hooks/use-grid-columns.ts.
const ASPECT_RATIO = 1.6;

export function CardTile({ card, tengo, onPress, columns }: CardTileProps) {
  const theme = useTheme();
  const [imageFailed, setImageFailed] = useState(false);
  const source = getThumbnail(card.id);
  const label = formatFecha(card.fecha) ?? card.nota ?? '';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Tarjeta ${label || card.id}, ${tengo ? 'la tengo' : 'pendiente'}`}
      style={({ pressed }) => [
        styles.cell,
        { width: `${100 / columns}%` },
        pressed && styles.pressed,
      ]}>
      <View style={[styles.imageWrapper, { backgroundColor: theme.backgroundElement }]}>
        {!imageFailed && source ? (
          <Image
            source={source}
            style={styles.image}
            contentFit="cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <View style={[styles.image, styles.imageFallback]}>
            <SymbolView
              name={{ ios: 'photo', android: 'image', web: 'image' }}
              size={22}
              tintColor={theme.textSecondary}
            />
          </View>
        )}

        {/* Color + ícono, nunca solo color -- accesible para daltonismo. */}
        <View
          style={[
            styles.badge,
            { backgroundColor: tengo ? theme.accent : theme.backgroundElement },
          ]}>
          <SymbolView
            name={{
              ios: tengo ? 'checkmark' : 'circle',
              android: tengo ? 'check' : 'radio_button_unchecked',
              web: tengo ? 'check' : 'radio_button_unchecked',
            }}
            size={11}
            weight="bold"
            tintColor={tengo ? theme.onAccent : theme.textSecondary}
          />
        </View>
      </View>

      <ThemedText type="small" numberOfLines={1} style={styles.label}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cell: {
    padding: Spacing.one,
  },
  pressed: {
    opacity: 0.7,
  },
  imageWrapper: {
    aspectRatio: ASPECT_RATIO,
    borderRadius: Spacing.two,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: Spacing.half,
    right: Spacing.half,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginTop: Spacing.half,
    textAlign: 'center',
  },
});
