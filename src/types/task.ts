export type TaskCategory = 'technique' | 'theory' | 'repertoire';
export type TaskDifficulty = 'easy' | 'medium' | 'hard';

export type Task = {
  id: string;
  title: string;
  category?: TaskCategory;
  difficulty?: TaskDifficulty;
  referenceLink?: string;
  description?: string;
};
