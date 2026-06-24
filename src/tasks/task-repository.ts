import { App, Notice, TFile } from "obsidian";
import { CONFIG_FILE_PATH, TASKS_FILE_PATH } from "../constants";
import type { TaskItem } from "../model/task";
import { DEFAULT_STATUS_DEFINITIONS } from "../model/task-status";
import { TagGraph } from "../model/tag-graph";
import { parseTasksFromMarkdown } from "../parser/task-parser";
import { DEFAULT_SCORE_SCRIPT, scoreTask } from "../scoring/score";
import {
	buildTaskMarkdownLines,
	updateTaskLineCompleted,
	updateTaskLineDueDate,
	updateTaskLinePriority,
	updateTaskLineStatus,
	updateTaskLineTags
} from "./task-markdown";
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
		tagGraph = new TagGraph(),
		statusDefinitions = DEFAULT_STATUS_DEFINITIONS
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
				task.score = scoreTask(task, new Date(), scoreScript, statusDefinitions);
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

		const taskText = buildTaskMarkdownLines({
			...input,
			title,
			completed: false,
			createdDate: this.getTodayIsoDate()
		}).join("\n");
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

		const nextTaskLines = buildTaskMarkdownLines({
			...input,
			title,
			completed: task.completed,
			createdDate: task.createdDate
		});

		await replaceTaskBlock(this.app, task, nextTaskLines);
	}

	async updateTaskStatus(task: TaskItem, status: string | null): Promise<void> {
		const nextStatus = task.completed ? null : status;

		await modifyTaskLine(this.app, task, (line) => {
			return updateTaskLineStatus(line, nextStatus);
		});
	}

	async updateTaskCompleted(task: TaskItem, completed: boolean): Promise<void> {
		await modifyTaskLine(this.app, task, (line) => {
			return updateTaskLineCompleted(line, completed);
		});
	}

	async updateTaskDueDate(task: TaskItem, dueDate: string | null): Promise<void> {
		await modifyTaskLine(this.app, task, (line) => {
			return updateTaskLineDueDate(line, dueDate);
		});
	}

	async updateTaskPriority(task: TaskItem, priority: number): Promise<void> {
		await modifyTaskLine(this.app, task, (line) => {
			return updateTaskLinePriority(line, priority);
		});
	}

	async updateTaskTags(task: TaskItem, tags: string[]): Promise<void> {
		await modifyTaskLine(this.app, task, (line) => {
			return updateTaskLineTags(line, tags);
		});
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
				lines[lineIndex] = updateTaskLineStatus(lines[lineIndex] ?? "", null);
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
