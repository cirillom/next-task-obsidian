import { App, Notice, TFile } from "obsidian";
import { CONFIG_FILE_PATH, TASKS_FILE_PATH } from "../constants";
import type { TaskItem } from "../model/task";
import { DEFAULT_STATUS_DEFINITIONS } from "../model/task-status";
import { TagGraph } from "../model/tag-graph";
import { parseTasksFromMarkdown } from "../parser/task-parser";
import { DEFAULT_SCORE_SCRIPT, scoreTask } from "../scoring/score";
import {
	buildTaskFileCompletionPath,
	buildTaskFileName,
	buildTaskFileTemplate,
	parseTaskFile,
	replaceTaskFileBody,
	TASK_FILE_DUE_DATE_PROPERTY,
	TASK_FILE_PRIORITY_PROPERTY,
	TASK_FILE_STATUS_PROPERTY,
	TASK_FILE_TAGS_PROPERTY
} from "./task-file";
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
			const fileTask = parseTaskFile(content, file);
			const tasks = parseTasksFromMarkdown(content, file.path);

			if (fileTask) {
				fileTask.resolvedTags = this.expandTaskTags(fileTask.tags, tagGraph);
				fileTask.score = scoreTask(fileTask, new Date(), scoreScript, statusDefinitions);
				allTasks.push(fileTask);
				continue;
			}

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
		if (task.sourceType === "file") {
			if (!input.dueDate) {
				new Notice("Due date is required for file tasks");
				return;
			}

			const file = this.getTaskFile(task);

			if (!file) {
				return;
			}

			await this.updateTaskFileProperties(task, {
				[TASK_FILE_STATUS_PROPERTY]: task.completed ? null : input.status,
				[TASK_FILE_PRIORITY_PROPERTY]: input.priority,
				[TASK_FILE_DUE_DATE_PROPERTY]: input.dueDate,
				[TASK_FILE_TAGS_PROPERTY]: input.tags
			});

			const content = await this.app.vault.read(file);
			await this.app.vault.modify(file, replaceTaskFileBody(content, input.description));
			return;
		}

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

	async updateTaskDescription(task: TaskItem, description: string): Promise<void> {
		if (task.sourceType === "file") {
			const file = this.getTaskFile(task);

			if (!file) {
				return;
			}

			const content = await this.app.vault.read(file);
			await this.app.vault.modify(file, replaceTaskFileBody(content, description));
			return;
		}

		const nextTaskLines = buildTaskMarkdownLines({
			title: task.title,
			completed: task.completed,
			createdDate: task.createdDate,
			dueDate: task.dueDate,
			priority: task.priority,
			status: task.status,
			tags: task.tags,
			description
		});

		await replaceTaskBlock(this.app, task, nextTaskLines);
	}

	async updateTaskStatus(task: TaskItem, status: string | null): Promise<void> {
		if (task.sourceType === "file") {
			await this.updateTaskFileProperty(
				task,
				TASK_FILE_STATUS_PROPERTY,
				task.completed ? null : status
			);
			return;
		}

		const nextStatus = task.completed ? null : status;

		await modifyTaskLine(this.app, task, (line) => {
			return updateTaskLineStatus(line, nextStatus);
		});
	}

	async updateTaskCompleted(task: TaskItem, completed: boolean): Promise<void> {
		if (task.sourceType === "file") {
			const file = this.getTaskFile(task);

			if (!file) {
				return;
			}

			if (completed) {
				await this.updateTaskFileProperty(task, TASK_FILE_STATUS_PROPERTY, null);
			}

			await this.renameTaskFile(file, completed);
			return;
		}

		await modifyTaskLine(this.app, task, (line) => {
			return updateTaskLineCompleted(line, completed);
		});
	}

	async updateTaskDueDate(task: TaskItem, dueDate: string | null): Promise<void> {
		if (task.sourceType === "file") {
			if (!dueDate) {
				new Notice("Due date is required for file tasks");
				return;
			}

			await this.updateTaskFileProperty(task, TASK_FILE_DUE_DATE_PROPERTY, dueDate);
			return;
		}

		await modifyTaskLine(this.app, task, (line) => {
			return updateTaskLineDueDate(line, dueDate);
		});
	}

	async updateTaskPriority(task: TaskItem, priority: number): Promise<void> {
		if (task.sourceType === "file") {
			await this.updateTaskFileProperty(task, TASK_FILE_PRIORITY_PROPERTY, priority);
			return;
		}

		await modifyTaskLine(this.app, task, (line) => {
			return updateTaskLinePriority(line, priority);
		});
	}

	async updateTaskTags(task: TaskItem, tags: string[]): Promise<void> {
		if (task.sourceType === "file") {
			await this.updateTaskFileProperty(task, TASK_FILE_TAGS_PROPERTY, tags);
			return;
		}

		await modifyTaskLine(this.app, task, (line) => {
			return updateTaskLineTags(line, tags);
		});
	}

	async createTaskFileTemplate(): Promise<TFile> {
		const title = "New task";
		const path = this.getAvailableTaskFilePath(buildTaskFileName(title, false));

		return this.app.vault.create(path, buildTaskFileTemplate(this.getTodayIsoDate()));
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

	private async updateTaskFileProperty(
		task: TaskItem,
		property: string,
		value: unknown
	): Promise<void> {
		await this.updateTaskFileProperties(task, { [property]: value });
	}

	private async updateTaskFileProperties(
		task: TaskItem,
		properties: Record<string, unknown>
	): Promise<void> {
		const file = this.getTaskFile(task);

		if (!file) {
			return;
		}

		await this.app.fileManager.processFrontMatter(file, (frontMatter) => {
			const taskFrontMatter = frontMatter as Record<string, unknown>;

			for (const [property, value] of Object.entries(properties)) {
				taskFrontMatter[property] = value;
			}
		});
	}

	private getTaskFile(task: TaskItem): TFile | null {
		const file = this.app.vault.getAbstractFileByPath(task.filePath);

		if (!(file instanceof TFile)) {
			new Notice("Could not find task file");
			return null;
		}

		return file;
	}

	private async renameTaskFile(file: TFile, completed: boolean): Promise<void> {
		const nextPath = this.getAvailableTaskFilePath(
			buildTaskFileCompletionPath(file, completed),
			file.path
		);

		if (nextPath !== file.path) {
			await this.app.vault.rename(file, nextPath);
		}
	}

	private getAvailableTaskFilePath(preferredPath: string, currentPath?: string): string {
		if (preferredPath === currentPath || !this.app.vault.getAbstractFileByPath(preferredPath)) {
			return preferredPath;
		}

		const extension = ".md";
		const basePath = preferredPath.endsWith(extension)
			? preferredPath.slice(0, -extension.length)
			: preferredPath;

		for (let index = 1; ; index++) {
			const path = `${basePath} ${index}${extension}`;

			if (!this.app.vault.getAbstractFileByPath(path)) {
				return path;
			}
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
