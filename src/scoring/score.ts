import type { TaskItem } from "../model/task";

const DAY_MS = 24 * 60 * 60 * 1000;

export function scoreTask(task: TaskItem, now = new Date()): number {
	const priority = task.priority ?? 0;

	const ageDays = task.createdDate
		? Math.max(0, (now.getTime() - new Date(task.createdDate).getTime()) / DAY_MS)
		: 0;

	const daysUntilDue = task.dueDate
		? (new Date(task.dueDate).getTime() - now.getTime()) / DAY_MS
		: 999;

	const duePressure =
		daysUntilDue < 0 ? 100 :
		daysUntilDue <= 1 ? 50 :
		daysUntilDue <= 7 ? 20 :
		0;

	const statusPenalty = task.completed ? -10000 : 0;

	return statusPenalty + priority * 20 + ageDays * 1.5 + duePressure;
}
