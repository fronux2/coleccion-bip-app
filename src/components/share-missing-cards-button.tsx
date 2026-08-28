import { requestPermissionsAsync, saveToLibraryAsync } from 'expo-media-library/legacy';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useCollection } from '@/context/collection-context';
import { useTheme } from '@/hooks/use-theme';
import { catalogo, formatFecha, getMissingCards, getThumbnail } from '@/lib/catalogo';
import { COLLAGE_COLUMNS, paginateCollage } from '@/lib/collage';

const TILE_WIDTH = 140;
const TILE_ASPECT_RATIO = 1.6;

export function ShareMissingCardsButton() {
  const theme = useTheme();
  const { has } = useCollection();
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const collageRefs = useRef<(View | null)[]>([]);

  const missingCards = getMissingCards(has);
  const pages = useMemo(() => paginateCollage(missingCards), [missingCards]);
  if (missingCards.length === 0) return null;

  const onSave = async () => {
    setError(null);
    setSavedCount(null);
    setGenerating(true);
    setProgress(null);

    try {
      // expo-sharing solo admite un archivo por llamada, así que con varias
      // páginas obligaba a repetir la hoja de compartir una por una. En vez
      // de eso generamos todas las imágenes y las guardamos de una sola vez
      // en la galería (solo permiso de escritura), para compartirlas juntas
      // desde ahí.
      const { status } = await requestPermissionsAsync(true);
      if (status !== 'granted') {
        setError('Necesitamos permiso para guardar imágenes en tu galería.');
        return;
      }

      // Las miniaturas son assets bundleados (no remotos), así que dos
      // frames alcanzan para que la vista oculta termine de pintarlas
      // antes de capturarla -- no hace falta trackear onLoad por tile.
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      for (let i = 0; i < pages.length; i++) {
        const ref = collageRefs.current[i];
        if (!ref) continue;

        setProgress({ current: i + 1, total: pages.length });
        const uri = await captureRef(ref, { format: 'png', quality: 1, result: 'tmpfile' });
        // La API nueva (Asset.create) requiere el módulo nativo
        // ExpoMediaLibraryNext, que Expo Go todavía no incluye.
        await saveToLibraryAsync(uri);
      }

      setSavedCount(pages.length);
    } catch {
      setError('No se pudo generar o guardar la imagen. Intenta de nuevo.');
    } finally {
      setGenerating(false);
      setProgress(null);
    }
  };

  return (
    <>
      <Pressable
        onPress={onSave}
        disabled={generating}
        accessibilityRole="button"
        accessibilityLabel="Guardar tarjetas que me faltan en la galería"
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: theme.backgroundElement },
          (pressed || generating) && styles.pressed,
        ]}>
        <SymbolView
          name={{ ios: 'square.and.arrow.down', android: 'download', web: 'download' }}
          size={18}
          tintColor={theme.text}
        />
        <ThemedText>
          {generating
            ? progress
              ? `Generando imagen ${progress.current}/${progress.total}…`
              : 'Generando imagen…'
            : 'Guardar tarjetas que me faltan'}
        </ThemedText>
      </Pressable>

      {error ? (
        <ThemedText themeColor="textSecondary" style={styles.error}>
          {error}
        </ThemedText>
      ) : null}

      {savedCount ? (
        <ThemedText themeColor="textSecondary" style={styles.error}>
          {savedCount > 1
            ? `${savedCount} imágenes guardadas en tu galería. Ábrela para compartirlas juntas.`
            : 'Imagen guardada en tu galería.'}
        </ThemedText>
      ) : null}

      {generating ? (
        <View style={styles.offscreen} collapsable={false} pointerEvents="none">
          {pages.map((pageCards, pageIndex) => (
            <View
              key={pageIndex}
              ref={(node) => {
                collageRefs.current[pageIndex] = node;
              }}
              collapsable={false}
              style={[styles.collage, { backgroundColor: theme.background }]}>
              <View style={[styles.header, { backgroundColor: theme.accent }]}>
                <ThemedText type="subtitle" style={{ color: theme.onAccent }}>
                  Me faltan {missingCards.length} de {catalogo.length}
                </ThemedText>
                <ThemedText style={{ color: theme.onAccent }}>
                  {pages.length > 1
                    ? `Colección BIP · Parte ${pageIndex + 1} de ${pages.length}`
                    : 'Colección BIP'}
                </ThemedText>
              </View>
              <View style={styles.grid}>
                {pageCards.map((card) => {
                  const source = getThumbnail(card.id);
                  const label = formatFecha(card.fecha) ?? card.nota ?? '';
                  return (
                    <View key={card.id} style={styles.tile}>
                      <View
                        style={[
                          styles.imageWrapper,
                          { backgroundColor: theme.backgroundElement },
                        ]}>
                        {source ? (
                          <Image source={source} style={styles.image} contentFit="cover" />
                        ) : null}
                      </View>
                      <ThemedText type="small" numberOfLines={1} style={styles.label}>
                        {label}
                      </ThemedText>
                    </View>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  button: {
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
  error: {
    textAlign: 'center',
  },
  offscreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    opacity: 0,
  },
  collage: {
    width: COLLAGE_COLUMNS * TILE_WIDTH,
    paddingBottom: Spacing.four,
  },
  header: {
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.one,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tile: {
    width: TILE_WIDTH,
    padding: Spacing.one,
  },
  imageWrapper: {
    aspectRatio: TILE_ASPECT_RATIO,
    borderRadius: Spacing.two,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  label: {
    marginTop: Spacing.half,
    textAlign: 'center',
  },
});
