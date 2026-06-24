import type { TaskItem } from "../model/task";

const TASK_LINE = /^\s*-\s+\[( |x|X)\]\s+(.*)$/;

export function parseTasksFromMarkdown(source: string, filePath: string): TaskItem[] {
	const lines = source.split(/\r?\n/);
	const tasks: TaskItem[] = [];

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i] ?? "";
		const match = line.match(TASK_LINE);
		if (!match) continue;

		const completed = (match[1] ?? "").toLowerCase() === "x";
		const rawBody = match[2] ?? "";

		const tags = [...rawBody.matchAll(/#([\p{L}\p{N}_/-]+)/gu)]
			.map((tagMatch) => tagMatch[1])
			.filter((tag): tag is string => tag !== undefined);

		const status = extractField(rawBody, "s");
		const createdDate = extractField(rawBody, "c");
		const dueDate = extractField(rawBody, "d");
		const priorityRaw = extractField(rawBody, "p");

		if (!createdDate || !priorityRaw) {
			continue;
		}

		const title = rawBody
			.replace(/@\w+:[^\s]+/g, "")
			.replace(/#[\p{L}\p{N}_/-]+/gu, "")
			.trim();

		const descriptionLines: string[] = [];
		let j = i + 1;

		while (j < lines.length && /^\s{2,}\S/.test(lines[j] ?? "")) {
			descriptionLines.push((lines[j] ?? "").trim());
			j++;
		}

		tasks.push({
			title,
			status,
			createdDate,
			dueDate,
			priority: Number(priorityRaw),
			tags,
			description: descriptionLines.join("\n"),
			filePath,
			line: i + 1,
			completed,
			score: 0
		});
	}

	return tasks;
}

function extractField(text: string, field: string): string | null {
	const match = text.match(new RegExp(`@${field}:([^\\s]+)`));
	return match?.[1] ?? null;
}
