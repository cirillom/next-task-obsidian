import type { TaskItem } from "../model/task";
import {
	collectTaskDescription,
	parseTaskLine,
	parseTaskMetadata
} from "../tasks/task-markdown";

export function parseTasksFromMarkdown(source: string, filePath: string): TaskItem[] {
	const lines = source.split(/\r?\n/);
	const tasks: TaskItem[] = [];

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i] ?? "";
		const taskLine = parseTaskLine(line);
		if (!taskLine) continue;

		const metadata = parseTaskMetadata(taskLine.body);

		if (!metadata.createdDate || !isValidPriority(metadata.priority)) {
			continue;
		}

		const descriptionLines = collectTaskDescription(lines, i + 1);

		tasks.push({
			sourceType: "line",
			title: metadata.title,
			status: metadata.status,
			createdDate: metadata.createdDate,
			dueDate: metadata.dueDate,
			priority: metadata.priority,
			tags: metadata.tags,
			description: descriptionLines.join("\n"),
			filePath,
			line: i + 1,
			completed: taskLine.completed,
			score: 0
		});
	}

	return tasks;
}

function isValidPriority(priority: number): boolean {
	return Number.isInteger(priority) && priority >= 1;
}
