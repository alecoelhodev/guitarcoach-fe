import { useLocalSearchParams } from 'expo-router';

import { RoutineBuilder } from '@/features/routines/routine-builder';

export default function RoutineDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <RoutineBuilder routineId={id} />;
}
