import { useLocalSearchParams } from 'expo-router';

import { RoutineNewTaskScreen } from '@/features/routines/routine-new-task-screen';

export default function RoutineNewTaskRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <RoutineNewTaskScreen routineId={id} />;
}
