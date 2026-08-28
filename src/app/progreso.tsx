import { SymbolView } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxDetailWidth, Spacing } from '@/constants/theme';
import { useCollection } from '@/context/collection-context';
import { useTheme } from '@/hooks/use-theme';

export default function ProgresoScreen() {
  const theme = useTheme();
  const { total, tengoCount, percentage, loading } = useCollection();
  const complete = !loading && total > 0 && tengoCount === total;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <ThemedView style={styles.container}>
        {complete ? (
          <>
            <SymbolView
              name={{ ios: 'trophy.fill', android: 'emoji_events', web: 'emoji_events' }}
              size={56}
              tintColor={theme.accent}
            />
            <ThemedText type="title" style={styles.celebrationTitle}>
              ¡Colección completa!
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.center}>
              Tienes las {total} tarjetas de la Colección BIP.
            </ThemedText>
          </>
        ) : (
          <>
            <ThemedText type="title" style={styles.percentage}>
              {percentage}%
            </ThemedText>
            <View
              style={[styles.track, { backgroundColor: theme.backgroundElement }]}
              accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: 100, now: percentage }}>
              <View
                style={[styles.fill, { backgroundColor: theme.accent, width: `${percentage}%` }]}
              />
            </View>
            <ThemedText themeColor="textSecondary">
              {tengoCount} de {total} tarjetas
            </ThemedText>
          </>
        )}
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.five,
    width: '100%',
    maxWidth: MaxDetailWidth,
    alignSelf: 'center',
  },
  percentage: {
    fontSize: 64,
    lineHeight: 68,
  },
  track: {
    width: '100%',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 6,
  },
  celebrationTitle: {
    fontSize: 32,
    lineHeight: 38,
    textAlign: 'center',
  },
  center: {
    textAlign: 'center',
  },
});
