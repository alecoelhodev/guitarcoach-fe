import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, type Href } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Controller, useForm, type FieldErrors } from 'react-hook-form';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { z } from 'zod';

import { requestPasswordReset, signIn, signUp } from '@/api/auth';
import { ApiError, OFFLINE_STATUS } from '@/api/client';
import { describeError } from '@/api/errors';
import { ThemedText } from '@/components/themed-text';
import { Banner, type BannerProps } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { FieldLabel } from '@/components/ui/field-label';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Segmented } from '@/components/ui/segmented';
import { ValidationMessage } from '@/components/ui/validation-message';
import { safeNextPath } from '@/lib/next-path';
import { useSessionStore } from '@/stores/session-store';
import { useToastStore } from '@/stores/toast-store';
import { Colors, Spacing } from '@/theme/tokens';

type Mode = 'signin' | 'create';

type FormValues = { name: string; email: string; password: string };

/** Order matters — `onInvalid` scrolls to the first of these that has an error. */
const FIELD_ORDER = ['name', 'email', 'password'] as const;

function bannerForError(error: unknown, onRetry: () => void): BannerProps {
  if (error instanceof ApiError) {
    // Offline gets a Retry action here that no other screen offers, and a 401 means bad
    // credentials rather than an expired session — the two cases `describeError` cannot
    // know from the status alone.
    if (error.status === OFFLINE_STATUS) {
      return { title: 'No connection', actionLabel: 'Retry', onAction: onRetry };
    }
    if (error.status === 401) {
      return { title: 'Email or password is incorrect', message: 'Check both and try again.' };
    }
  }
  return describeError(error);
}

export type AuthFormProps = {
  initialMode?: Mode;
  /** In-app path to land on after authenticating; sanitized before use. */
  next?: string;
};

export function AuthForm({ initialMode = 'signin', next }: AuthFormProps) {
  const router = useRouter();
  const setUser = useSessionStore((state) => state.setUser);
  const showToast = useToastStore((state) => state.show);

  const [mode, setMode] = useState<Mode>(initialMode);
  const [banner, setBanner] = useState<BannerProps | null>(null);
  const [resetting, setResetting] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const emailRef = useRef<TextInput>(null);
  const fieldTop = useRef<Partial<Record<keyof FormValues, number>>>({});

  // Read through a ref so the resolver stays stable while still validating against the
  // mode the user is actually on — `name` only exists in create mode.
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const resolver = useMemo(
    () =>
      zodResolver(
        z
          .object({
            name: z.string(),
            email: z.email('Enter a valid email address.'),
            password: z.string().min(8, 'At least 8 characters.'),
          })
          .superRefine((values, ctx) => {
            if (modeRef.current === 'create' && values.name.trim().length === 0) {
              ctx.addIssue({ code: 'custom', path: ['name'], message: 'Enter a display name.' });
            }
          }),
      ),
    [],
  );

  const {
    control,
    handleSubmit,
    trigger,
    getValues,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver,
    // Wireframe 01B: validation fires on blur, per field, and never blocks typing.
    mode: 'onBlur',
    defaultValues: { name: '', email: '', password: '' },
  });

  const busy = isSubmitting || resetting;
  const target = safeNextPath(next) as Href;

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setBanner(null);
    clearErrors();
  }

  function onInvalid(formErrors: FieldErrors<FormValues>) {
    const first = FIELD_ORDER.find((field) => formErrors[field]);
    const y = first ? fieldTop.current[first] : undefined;
    if (y !== undefined) {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - Spacing[6]), animated: true });
    }
  }

  async function onValid(values: FormValues) {
    setBanner(null);
    try {
      if (modeRef.current === 'create') {
        const { user } = await signUp({
          name: values.name.trim(),
          email: values.email,
          password: values.password,
        });
        setUser(user);
        router.replace(target);
        // The wireframe puts this on the auth screen, but sign-up returns a live session
        // and `(auth)/_layout.tsx` redirects away from here, so it has to follow them.
        showToast('Verify your email to secure your account');
      } else {
        const { user } = await signIn({ email: values.email, password: values.password });
        setUser(user);
        router.replace(target);
      }
    } catch (error) {
      setBanner(bannerForError(error, retrySubmit));
    }
  }

  const submit = handleSubmit(onValid, onInvalid);

  // Hoisted so the offline banner's Retry can re-run the submit that produced it.
  function retrySubmit() {
    void submit();
  }

  async function handleForgotPassword() {
    if (!(await trigger('email'))) {
      emailRef.current?.focus();
      return;
    }

    setBanner(null);
    setResetting(true);
    try {
      await requestPasswordReset({ email: getValues('email') });
    } catch (error) {
      setBanner(bannerForError(error, () => void handleForgotPassword()));
      return;
    } finally {
      setResetting(false);
    }

    // Shown whether or not the account exists — the server equalizes its own timing and
    // response, and distinguishing the two here would leak which emails are registered.
    setBanner({
      title: 'Reset password sent',
      message: 'Check your email for a reset link.',
      tone: 'success',
    });
  }

  return (
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <ThemedText type="h3">Guitar Coach</ThemedText>
        <ThemedText type="body" color="textMuted">
          Practice with a plan.
        </ThemedText>
      </View>

      <Segmented<Mode>
        options={[
          { value: 'signin', label: 'Sign In' },
          { value: 'create', label: 'Create Account' },
        ]}
        value={mode}
        onChange={switchMode}
      />

      {banner && <Banner {...banner} />}

      {mode === 'create' && (
        <View
          onLayout={(event) => {
            fieldTop.current.name = event.nativeEvent.layout.y;
          }}
        >
          <FieldLabel>Display name</FieldLabel>
          <Controller
            control={control}
            name="name"
            render={({ field }) => (
              <Input
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                editable={!busy}
                placeholder="Jordan"
                invalid={!!errors.name}
              />
            )}
          />
          <ValidationMessage>{errors.name?.message}</ValidationMessage>
        </View>
      )}

      <View
        onLayout={(event) => {
          fieldTop.current.email = event.nativeEvent.layout.y;
        }}
      >
        <FieldLabel>Email</FieldLabel>
        <Controller
          control={control}
          name="email"
          render={({ field }) => (
            <Input
              ref={emailRef}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              editable={!busy}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              placeholder="jordan@example.com"
              invalid={!!errors.email}
            />
          )}
        />
        <ValidationMessage>{errors.email?.message}</ValidationMessage>
      </View>

      <View
        onLayout={(event) => {
          fieldTop.current.password = event.nativeEvent.layout.y;
        }}
      >
        <FieldLabel>Password</FieldLabel>
        <Controller
          control={control}
          name="password"
          render={({ field }) => (
            <PasswordInput
              testID="password-input"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              editable={!busy}
              textContentType={mode === 'create' ? 'newPassword' : 'password'}
              invalid={!!errors.password}
            />
          )}
        />
        <ValidationMessage>{errors.password?.message}</ValidationMessage>
        {mode === 'create' && !errors.password && (
          <ThemedText type="caption" color="textMuted" style={styles.hint}>
            At least 8 characters.
          </ThemedText>
        )}
      </View>

      {mode === 'signin' && (
        <Pressable
          accessibilityRole="button"
          onPress={() => void handleForgotPassword()}
          disabled={busy}
          style={styles.forgot}
        >
          <ThemedText type="caption" style={styles.link}>
            Forgot password?
          </ThemedText>
        </Pressable>
      )}

      <Button
        testID="submit"
        block
        loading={busy}
        loadingLabel={mode === 'create' ? 'Creating account…' : 'Signing in…'}
        onPress={submit}
      >
        {mode === 'create' ? 'Create Account' : 'Sign In'}
      </Button>

      <Pressable
        accessibilityRole="button"
        onPress={() => switchMode(mode === 'create' ? 'signin' : 'create')}
        style={styles.switch}
      >
        <ThemedText type="body" color="textMuted">
          {mode === 'create' ? 'Already have an account? ' : 'New here? '}
          <ThemedText type="body" style={styles.link}>
            {mode === 'create' ? 'Sign in' : 'Create an account'}
          </ThemedText>
        </ThemedText>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: Spacing[4],
    paddingVertical: Spacing[8],
  },
  header: { gap: Spacing[1] },
  hint: { marginTop: Spacing[1] },
  forgot: { alignSelf: 'flex-end' },
  switch: { alignSelf: 'center' },
  // Canvas uses accent-700 for links, never the base accent.
  link: { color: Colors.accentRamp[700] },
});
