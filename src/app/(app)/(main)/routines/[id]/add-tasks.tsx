import { useLocalSearchParams } from 'expo-router';

import { AddTasksScreen } from '@/features/routines/add-tasks-screen';

export default function AddRoutineTasksScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AddTasksScreen routineId={id} />;
}
