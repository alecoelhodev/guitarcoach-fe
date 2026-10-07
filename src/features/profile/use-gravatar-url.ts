import { useQuery } from '@tanstack/react-query';
import { CryptoDigestAlgorithm, digestStringAsync } from 'expo-crypto';

import { queryKeys } from '@/api/query-keys';

/** 3× the 66 pt Profile avatar, the largest place it is drawn. */
const GRAVATAR_PX = 200;

/**
 * Gravatar keys a photo by the SHA-256 of the trimmed, lower-cased email. `d=404` makes "no
 * Gravatar" an image error, which `Avatar` already turns into the initials.
 */
export async function gravatarUrl(email: string) {
  const hash = await digestStringAsync(CryptoDigestAlgorithm.SHA256, email.trim().toLowerCase());
  return `https://gravatar.com/avatar/${hash}?s=${GRAVATAR_PX}&d=404`;
}

/** A local hash, not a request: cached for good, and nothing to retry. */
export function useGravatarUrl(email: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.gravatarUrl(email),
    queryFn: () => gravatarUrl(email),
    enabled: enabled && email !== '',
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });
}
