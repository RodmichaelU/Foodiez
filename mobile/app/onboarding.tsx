import AsyncStorage from '@react-native-async-storage/async-storage';
import { SymbolView } from 'expo-symbols';
import type { SFSymbol } from 'expo-symbols';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/src/lib/supabase';
import { colors, fontSizes, fontWeights, radius, spacing } from '@/src/theme';

const SEEN_KEY = 'onboarding-seen';
const MIN_PASSWORD_LENGTH = 6;

const SLIDES: { icon: SFSymbol; title: string; body: string }[] = [
  {
    icon: 'camera.fill',
    title: 'Snap your food',
    body: 'Point your camera at your fridge or counter and we will spot the ingredients.',
  },
  {
    icon: 'checklist',
    title: 'Check the list',
    body: 'Add or remove anything, then see what you can cook right now.',
  },
  {
    icon: 'fork.knife',
    title: 'Cook and keep track',
    body: "Follow Chef's Picks, online recipes and AI ideas, then save the dishes you make.",
  },
];

function Slides({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  const isLast = index === SLIDES.length - 1;

  return (
    <View style={styles.slide}>
      <View style={styles.slideBody}>
        <SymbolView name={slide.icon} tintColor={colors.primary} size={72} />
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.body}>{slide.body}</Text>
      </View>
      <View style={styles.dots}>
        {SLIDES.map((item, dot) => (
          <View key={item.title} style={[styles.dot, dot === index && styles.activeDot]} />
        ))}
      </View>
      <Pressable
        style={styles.primaryButton}
        onPress={() => (isLast ? onDone() : setIndex(index + 1))}
        accessibilityRole="button">
        <Text style={styles.primaryLabel}>{isLast ? 'Get started' : 'Next'}</Text>
      </Pressable>
    </View>
  );
}

function AuthForm() {
  const [mode, setMode] = useState<'login' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isSignup = mode === 'signup';
  const canSubmit = email.trim().length > 0 && password.length >= MIN_PASSWORD_LENGTH && !isLoading;

  async function submit() {
    setIsLoading(true);
    setError(null);
    setNotice(null);
    try {
      const credentials = { email: email.trim(), password };
      if (isSignup) {
        const { data, error: authError } = await supabase.auth.signUp(credentials);
        if (authError) setError(authError.message);
        else if (!data.session) setNotice('Check your email to confirm your account, then log in.');
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword(credentials);
        if (authError) setError(authError.message);
      }
    } catch {
      setError('Could not reach the server. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior="padding">
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{isSignup ? 'Create your account' : 'Welcome back'}</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
        />
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder={`Password (at least ${MIN_PASSWORD_LENGTH} characters)`}
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          autoCapitalize="none"
          textContentType={isSignup ? 'newPassword' : 'password'}
        />
        {error && <Text style={styles.error}>{error}</Text>}
        {notice && <Text style={styles.notice}>{notice}</Text>}
        <Pressable
          style={[styles.primaryButton, !canSubmit && styles.disabled]}
          disabled={!canSubmit}
          onPress={submit}
          accessibilityRole="button">
          {isLoading ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={styles.primaryLabel}>{isSignup ? 'Sign up' : 'Log in'}</Text>
          )}
        </Pressable>
        <Pressable
          style={styles.switchMode}
          onPress={() => {
            setMode(isSignup ? 'login' : 'signup');
            setError(null);
            setNotice(null);
          }}
          accessibilityRole="button">
          <Text style={styles.switchLabel}>
            {isSignup ? 'Already have an account? Log in' : 'New here? Sign up'}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export default function OnboardingScreen() {
  const [showForm, setShowForm] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(SEEN_KEY)
      .then((seen) => setShowForm(seen !== null))
      .catch(() => setShowForm(false));
  }, []);

  function finishSlides() {
    setShowForm(true);
    AsyncStorage.setItem(SEEN_KEY, 'true').catch(() => {});
  }

  return (
    <SafeAreaView style={styles.flex}>
      {showForm === false && <Slides onDone={finishSlides} />}
      {showForm === true && <AuthForm />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  slide: {
    flex: 1,
    padding: spacing.lg,
  },
  slideBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  activeDot: {
    backgroundColor: colors.primary,
  },
  title: {
    fontSize: fontSizes.display,
    fontWeight: fontWeights.bold,
    textAlign: 'center',
    color: colors.text,
  },
  body: {
    fontSize: fontSizes.body,
    textAlign: 'center',
    color: colors.textMuted,
  },
  form: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  input: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: fontSizes.body,
    color: colors.text,
  },
  error: {
    color: colors.danger,
  },
  notice: {
    color: colors.success,
  },
  primaryButton: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  primaryLabel: {
    fontWeight: fontWeights.medium,
    color: colors.background,
  },
  disabled: {
    opacity: 0.4,
  },
  switchMode: {
    alignItems: 'center',
    padding: spacing.sm,
  },
  switchLabel: {
    color: colors.primary,
    fontWeight: fontWeights.medium,
  },
});
