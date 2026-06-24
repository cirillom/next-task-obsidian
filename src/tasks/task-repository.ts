import { App, MarkdownView, Notice, TFile } from "obsidian";
import { CONFIG_FILE_PATH, TASKS_FILE_PATH } from "../constants";
import type { TaskItem } from "../model/task";
import { normalizeTag, TagGraph } from "../model/tag-graph";
import { parseTasksFromMarkdown } from "../parser/task-parser";
import { DEFAULT_SCORE_SCRIPT, scoreTask } from "../scoring/score";
import { modifyTaskLine, replaceTaskBlock } from "./task-source";

export type NewTaskInput = {
	title: string;
	dueDate: string | null;
	priority: number;
	status: string | null;
	tags: string[];
	description: string;
};

export class TaskRepository {
	constructor(private readonly app: App) {}

	async loadTasks(
		scoreScript = DEFAULT_SCORE_SCRIPT,
		tagGraph = new TagGraph()
	): Promise<TaskItem[]> {
		const files = this.app.vault
			.getMarkdownFiles()
			.filter((file) => file.path !== CONFIG_FILE_PATH);

		const allTasks: TaskItem[] = [];

		for (const file of files) {
			const content = await this.app.vault.cachedRead(file);
			const tasks = parseTasksFromMarkdown(content, file.path);

			for (const task of tasks) {
				task.resolvedTags = this.expandTaskTags(task.tags, tagGraph);
				task.score = scoreTask(task, new Date(), scoreScript);
				allTasks.push(task);
			}

			await this.normalizeCompletedTaskStatuses(file, content, tasks);
		}

		return allTasks.sort((a, b) => b.score - a.score);
	}

	async createTask(input: NewTaskInput): Promise<void> {
		const title = input.title.trim();

		if (title.length === 0) {
			new Notice("Task title is required");
			return;
		}

		const metadata = [
			input.status ? `@s:${input.status}` : null,
			`@c:${this.getTodayIsoDate()}`,
			input.dueDate ? `@d:${input.dueDate}` : null,
			`@p:${input.priority}`,
			...input.tags.map((tag) => `#${normalizeTag(tag)}`)
		].filter((value): value is string => value !== null);
		const description = input.description.trim();
		const taskText = [
			`- [ ] ${title} ${metadata.join(" ")}`,
			...(description.length > 0 ? [`    ${description.replace(/\n/g, "\n    ")}`] : [])
		].join("\n");
		const tasksFile = this.app.vault.getAbstractFileByPath(TASKS_FILE_PATH);

		if (!(tasksFile instanceof TFile)) {
			await this.app.vault.create(TASKS_FILE_PATH, `${taskText}\n`);
			return;
		}

		const content = await this.app.vault.read(tasksFile);
		const nextContent = content.endsWith("\n")
			? `${content}${taskText}\n`
			: `${content}\n${taskText}\n`;

		await this.app.vault.modify(tasksFile, nextContent);
	}

	async updateTask(task: TaskItem, input: NewTaskInput): Promise<void> {
		const title = input.title.trim();

		if (title.length === 0) {
			new Notice("Task title is required");
			return;
		}

		const metadata = [
			!task.completed && input.status ? `@s:${input.status}` : null,
			`@c:${task.createdDate}`,
			input.dueDate ? `@d:${input.dueDate}` : null,
			`@p:${input.priority}`,
			...input.tags.map((tag) => `#${normalizeTag(tag)}`)
		].filter((value): value is string => value !== null);
		const description = input.description.trim();
		const nextTaskLines = [
			`- [${task.completed ? "x" : " "}] ${title} ${metadata.join(" ")}`,
			...(description.length > 0 ? [`    ${description.replace(/\n/g, "\n    ")}`] : [])
		];

		await replaceTaskBlock(this.app, task, nextTaskLines);
	}

	async updateTaskStatus(task: TaskItem, status: string | null): Promise<void> {
		const nextStatus = task.completed ? null : status;

		await modifyTaskLine(this.app, task, (line) => {
			const lineWithoutStatus = line.replace(/\s+@s:[^\s]+/, "");

			return nextStatus === null
				? lineWithoutStatus
				: `${lineWithoutStatus.trimEnd()} @s:${nextStatus}`;
		});
	}

	async updateTaskCompleted(task: TaskItem, completed: boolean): Promise<void> {
		await modifyTaskLine(this.app, task, (line) => {
			const nextLine = line.replace(/^(\s*-\s+\[)( |x|X)(\]\s+)/, `$1${completed ? "x" : " "}$3`);

			return completed ? nextLine.replace(/\s+@s:[^\s]+/, "") : nextLine;
		});
	}

	async updateTaskDueDate(task: TaskItem, dueDate: string | null): Promise<void> {
		await modifyTaskLine(this.app, task, (line) => {
			const lineWithoutDueDate = line.replace(/\s+@d:[^\s]+/, "");

			return dueDate === null
				? lineWithoutDueDate
				: `${lineWithoutDueDate.trimEnd()} @d:${dueDate}`;
		});
	}

	async updateTaskPriority(task: TaskItem, priority: number): Promise<void> {
		await modifyTaskLine(this.app, task, (line) => {
			const lineWithoutPriority = line.replace(/\s+@p:[^\s]+/, "");

			return `${lineWithoutPriority.trimEnd()} @p:${priority}`;
		});
	}

	async updateTaskTags(task: TaskItem, tags: string[]): Promise<void> {
		const normalizedTags = tags
			.map((tag) => normalizeTag(tag))
			.filter((tag) => tag.length > 0);
		const tagText = normalizedTags.map((tag) => `#${tag}`).join(" ");

		await modifyTaskLine(this.app, task, (line) => {
			const lineWithoutTags = line.replace(/\s+#[\p{L}\p{N}_/-]+/gu, "");

			return tagText.length === 0
				? lineWithoutTags
				: `${lineWithoutTags.trimEnd()} ${tagText}`;
		});
	}

	async openTaskSource(task: TaskItem): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(task.filePath);

		if (!(file instanceof TFile)) {
			new Notice("Could not find task file");
			return;
		}

		const leaf = this.app.workspace.getLeaf(false);
		await leaf.openFile(file, { active: true });

		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		view?.editor.setCursor({ line: Math.max(0, task.line - 1), ch: 0 });
	}

	private async normalizeCompletedTaskStatuses(
		file: TFile,
		content: string,
		tasks: TaskItem[]
	): Promise<void> {
		const lines = content.split(/\r?\n/);
		let didRemoveDoneStatuses = false;

		for (const task of tasks) {
			if (task.completed && task.status !== null) {
				const lineIndex = task.line - 1;
				lines[lineIndex] = (lines[lineIndex] ?? "").replace(/\s+@s:[^\s]+/, "");
				task.status = null;
				didRemoveDoneStatuses = true;
			}
		}

		if (didRemoveDoneStatuses) {
			await this.app.vault.modify(file, lines.join("\n"));
		}
	}

	private expandTaskTags(tags: string[], tagGraph: TagGraph): string[] {
		const expandedTags = new Set<string>();

		for (const tag of tags) {
			for (const expandedTag of tagGraph.expandAncestors(tag)) {
				expandedTags.add(expandedTag);
			}
		}

		return [...expandedTags];
	}

	private getTodayIsoDate(): string {
		const now = new Date();
		const timezoneOffsetMs = now.getTimezoneOffset() * 60 * 1000;

		return new Date(now.getTime() - timezoneOffsetMs).toISOString().slice(0, 10);
	}
}
