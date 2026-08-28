import { Asset } from 'expo-asset';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useCollection } from '@/context/collection-context';
import { useTheme } from '@/hooks/use-theme';
import { catalogo, formatFecha, getMissingCards, getThumbnail } from '@/lib/catalogo';
import { COLLAGE_COLUMNS, paginateCollage } from '@/lib/collage';

const TILE_WIDTH = 140;
const TILE_ASPECT_RATIO = 1.6;
const TILE_PADDING = 4;
const LABEL_HEIGHT = 20;
const HEADER_HEIGHT = 80;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function ShareMissingCardsButton() {
  const theme = useTheme();
  const { has } = useCollection();
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const missingCards = getMissingCards(has);
  if (missingCards.length === 0) return null;

  const onShare = async () => {
    setError(null);
    setGenerating(true);
    setProgress(null);

    try {
      const pages = paginateCollage(missingCards);
      const tileImageHeight = TILE_WIDTH / TILE_ASPECT_RATIO;
      const tileHeight = tileImageHeight + LABEL_HEIGHT + TILE_PADDING * 2;

      for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
        const pageCards = pages[pageIndex];
        const rows = Math.ceil(pageCards.length / COLLAGE_COLUMNS);

        setProgress({ current: pageIndex + 1, total: pages.length });

        const canvas = document.createElement('canvas');
        canvas.width = COLLAGE_COLUMNS * TILE_WIDTH;
        canvas.height = HEADER_HEIGHT + rows * tileHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('canvas-unsupported');

        ctx.fillStyle = theme.background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = theme.accent;
        ctx.fillRect(0, 0, canvas.width, HEADER_HEIGHT);
        ctx.fillStyle = theme.onAccent;
        ctx.textAlign = 'center';
        ctx.font = 'bold 22px sans-serif';
        ctx.fillText(
          `Me faltan ${missingCards.length} de ${catalogo.length}`,
          canvas.width / 2,
          34,
          canvas.width - Spacing.four * 2
        );
        ctx.font = '14px sans-serif';
        ctx.fillText(
          pages.length > 1
            ? `Colección BIP · Parte ${pageIndex + 1} de ${pages.length}`
            : 'Colección BIP',
          canvas.width / 2,
          56
        );

        const images = await Promise.all(
          pageCards.map(async (card) => {
            const source = getThumbnail(card.id);
            const uri = source ? Asset.fromModule(source).uri : null;
            return uri ? loadImage(uri).catch(() => null) : null;
          })
        );

        pageCards.forEach((card, index) => {
          const col = index % COLLAGE_COLUMNS;
          const row = Math.floor(index / COLLAGE_COLUMNS);
          const x = col * TILE_WIDTH + TILE_PADDING;
          const y = HEADER_HEIGHT + row * tileHeight + TILE_PADDING;
          const imageWidth = TILE_WIDTH - TILE_PADDING * 2;

          ctx.fillStyle = theme.backgroundElement;
          ctx.fillRect(x, y, imageWidth, tileImageHeight);

          const img = images[index];
          if (img) {
            ctx.drawImage(img, x, y, imageWidth, tileImageHeight);
          }

          const label = formatFecha(card.fecha) ?? card.nota ?? '';
          ctx.fillStyle = theme.text;
          ctx.font = '12px sans-serif';
          ctx.fillText(label, x + imageWidth / 2, y + tileImageHeight + 14, imageWidth);
        });

        const blob: Blob | null = await new Promise((resolve) =>
          canvas.toBlob(resolve, 'image/png')
        );
        if (!blob) throw new Error('blob-failed');

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download =
          pages.length > 1
            ? `tarjetas-que-me-faltan-${pageIndex + 1}-de-${pages.length}.png`
            : 'tarjetas-que-me-faltan.png';
        link.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      setError('No se pudo generar la imagen. Intenta de nuevo.');
    } finally {
      setGenerating(false);
      setProgress(null);
    }
  };

  return (
    <>
      <Pressable
        onPress={onShare}
        disabled={generating}
        accessibilityRole="button"
        accessibilityLabel="Descargar imagen con las tarjetas que me faltan"
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: theme.backgroundElement },
          (pressed || generating) && styles.pressed,
        ]}>
        <SymbolView
          name={{ ios: 'square.and.arrow.up', android: 'share', web: 'share' }}
          size={18}
          tintColor={theme.text}
        />
        <ThemedText>
          {generating
            ? progress
              ? `Generando imagen ${progress.current}/${progress.total}…`
              : 'Generando imagen…'
            : 'Descargar tarjetas que me faltan'}
        </ThemedText>
      </Pressable>

      {error ? (
        <ThemedText themeColor="textSecondary" style={styles.error}>
          {error}
        </ThemedText>
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
});
