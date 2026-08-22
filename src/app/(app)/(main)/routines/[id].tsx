import { useLocalSearchParams } from 'expo-router';

import { RoutineDetail } from '@/features/routines/routine-detail';

export default function RoutineDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <RoutineDetail routineId={id} />;
}
