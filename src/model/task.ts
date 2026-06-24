export type TaskItem = {
  title: string;
  status: string | null;
  createdDate: string; // YYYY-MM-DD
  dueDate: string | null;     // YYYY-MM-DD
  priority: number;
  tags: string[];
  resolvedTags?: string[];
  description: string;
  filePath: string;
  line: number;
  completed: boolean;
  score: number;
};
