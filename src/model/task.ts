export type TaskItem = {
  title: string;
  status: string | null;
  createdDate: string | null; // YYYY-MM-DD
  dueDate: string | null;     // YYYY-MM-DD
  priority: number | null;
  tags: string[];
  resolvedTags?: string[];
  description: string;
  filePath: string;
  line: number;
  completed: boolean;
  score: number;
};
