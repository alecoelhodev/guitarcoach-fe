import type { TaskCategory, TaskDifficulty } from '@/types/task';

export const categoryLabels: Record<TaskCategory, string> = {
  technique: 'Technique',
  theory: 'Theory',
  repertoire: 'Repertoire',
};

export const difficultyLabels: Record<TaskDifficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};
