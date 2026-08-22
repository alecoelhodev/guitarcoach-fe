import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';
import { z } from 'zod';

import { signIn } from '@/api/auth';
import { ApiError } from '@/api/client';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { FieldLabel } from '@/components/ui/field-label';
import { Input } from '@/components/ui/input';
import { ValidationMessage } from '@/components/ui/validation-message';
import { useSessionStore } from '@/stores/session-store';
import { Spacing } from '@/theme/tokens';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'At least 8 characters'),
});

type FormValues = z.infer<typeof schema>;

export function SignInForm() {
  const router = useRouter();
  const setUser = useSessionStore((state) => state.setUser);
  const [formError, setFormError] = useState<string>();
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(undefined);
    try {
      const { user } = await signIn(values);
      setUser(user);
      router.replace('/');
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Something went wrong. Try again.');
    }
  });

  return (
    <View style={{ gap: Spacing[4] }}>
      <View>
        <FieldLabel>Email</FieldLabel>
        <Controller
          control={control}
          name="email"
          render={({ field }) => (
            <Input
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              autoCapitalize="none"
              keyboardType="email-address"
              invalid={!!errors.email}
            />
          )}
        />
        <ValidationMessage>{errors.email?.message}</ValidationMessage>
      </View>

      <View>
        <FieldLabel>Password</FieldLabel>
        <Controller
          control={control}
          name="password"
          render={({ field }) => (
            <Input
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              secureTextEntry
              invalid={!!errors.password}
            />
          )}
        />
        <ValidationMessage>{errors.password?.message}</ValidationMessage>
      </View>

      <ValidationMessage>{formError}</ValidationMessage>

      <Button block loading={isSubmitting} onPress={onSubmit}>
        Sign in
      </Button>

      <ThemedText type="body" color="textMuted" style={{ textAlign: 'center' }}>
        No account yet? Use Create Account below.
      </ThemedText>
    </View>
  );
}
