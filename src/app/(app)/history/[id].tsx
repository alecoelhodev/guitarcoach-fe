import { useLocalSearchParams } from 'expo-router';

import { SessionDetail } from '@/features/history/session-detail';

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <SessionDetail sessionId={id} />;
}
