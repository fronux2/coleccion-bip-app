import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type EmptyStateProps = {
  icon: SymbolViewProps['name'];
  title: string;
  hint?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ icon, title, hint, actionLabel, onAction }: EmptyStateProps) {
  const theme = useTheme();

  return (
    <ThemedView style={styles.container}>
      <SymbolView name={icon} size={40} tintColor={theme.textSecondary} />
      <ThemedText type="subtitle" style={styles.title}>
        {title}
      </ThemedText>
      {hint ? (
        <ThemedText themeColor="textSecondary" style={styles.hint}>
          {hint}
        </ThemedText>
      ) : null}
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.action,
            { backgroundColor: theme.accent },
            pressed && styles.pressed,
          ]}>
          <ThemedText style={{ color: theme.onAccent }}>{actionLabel}</ThemedText>
        </Pressable>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    padding: Spacing.five,
  },
  title: {
    textAlign: 'center',
  },
  hint: {
    textAlign: 'center',
  },
  action: {
    marginTop: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
    minHeight: 44,
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
