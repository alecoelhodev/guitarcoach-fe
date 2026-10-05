import { useLocalSearchParams } from 'expo-router';

import { EditTaskScreen } from '@/features/library/edit-task-screen';

export default function EditTaskRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EditTaskScreen taskId={id} />;
}
