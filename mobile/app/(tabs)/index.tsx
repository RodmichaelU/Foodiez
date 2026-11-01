import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { errorMessage, getHealth } from '@/src/api/client';
import { ErrorState } from '@/src/components/ErrorState';
import { colors, spacing } from '@/src/theme';

type Connection =
  | { state: 'checking' }
  | { state: 'connected' }
  | { state: 'failed'; message: string };

export default function HomeScreen() {
  const [connection, setConnection] = useState<Connection>({ state: 'checking' });

  const checkBackend = useCallback(async () => {
    setConnection({ state: 'checking' });
    try {
      await getHealth();
      setConnection({ state: 'connected' });
    } catch (error) {
      setConnection({ state: 'failed', message: errorMessage(error) });
    }
  }, []);

  useEffect(() => {
    checkBackend();
  }, [checkBackend]);

  return (
    <View style={styles.container}>
      {connection.state === 'checking' && <ActivityIndicator color={colors.primary} />}
      {connection.state === 'connected' && <Text style={styles.connected}>Backend connected</Text>}
      {connection.state === 'failed' && (
        <ErrorState message={connection.message} onRetry={checkBackend} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  connected: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.success,
  },
});
