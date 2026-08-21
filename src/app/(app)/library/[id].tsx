import { useLocalSearchParams } from 'expo-router';

import { TaskDetail } from '@/features/library/task-detail';

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TaskDetail taskId={id} />;
}
