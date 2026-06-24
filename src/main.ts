import { MarkdownView, Notice, Plugin, TFile } from "obsidian";
import { parseTasksFromMarkdown } from "./parser/task-parser";
import type { TaskItem } from "./model/task";
import { DEFAULT_SCORE_FORMULA, scoreTask } from "./scoring/score";
import { TaskAggregatorView, TASK_AGGREGATOR_VIEW } from "./view";
import { parseTaskConfig } from "./parser/config-parser";
import { TagGraph, normalizeTag } from "./model/tag-graph";
import { registerCommands } from "./commands";
import taskConfigTemplate from "./templates/Tasks-Config.md";

const CONFIG_FILE_PATH = "Tasks-Config.md";
const TASKS_FILE_PATH = "Tasks.md";

export type NewTaskInput = {
	title: string;
	dueDate: string | null;
	priority: number;
	status: string | null;
	tags: string[];
	description: string;
};

export type TaskAggregatorData = {
	tasks: TaskItem[];
	tagGraph: TagGraph;
	configStatus: "loaded" | "missing" | "error";
	configError: string | null;
	cycles: string[][];
};

export default class TaskAggregatorPlugin extends Plugin {
	readonly configFilePath = CONFIG_FILE_PATH;

	async onload(): Promise<void> {
		this.registerView(
			TASK_AGGREGATOR_VIEW,
			(leaf) => new TaskAggregatorView(leaf, this)
		);

		registerCommands(this);
	}

	async activateView(): Promise<void> {
		const existingLeaves = this.app.workspace.getLeavesOfType(TASK_AGGREGATOR_VIEW);
		const existingLeaf = existingLeaves[0];

		if (existingLeaf) {
			this.app.workspace.setActiveLeaf(existingLeaf, { focus: true });
			return;
		}

		const leaf = this.app.workspace.getRightLeaf(false);

		if (!leaf) {
			new Notice("Could not open task aggregator view");
			return;
		}

		await leaf.setViewState({
			type: TASK_AGGREGATOR_VIEW,
			active: true
		});

		this.app.workspace.setActiveLeaf(leaf, { focus: true });
	}

	async refreshOpenViews(): Promise<void> {
		const leaves = this.app.workspace.getLeavesOfType(TASK_AGGREGATOR_VIEW);

		for (const leaf of leaves) {
			const view = leaf.view;

			if (view instanceof TaskAggregatorView) {
				await view.refresh();
			}
		}
	}

	async loadTasks(
		scoreFormula = DEFAULT_SCORE_FORMULA,
		tagGraph = new TagGraph()
	): Promise<TaskItem[]> {
		const files = this.app.vault
			.getMarkdownFiles()
			.filter((file) => file.path !== CONFIG_FILE_PATH);

		const allTasks: TaskItem[] = [];

		for (const file of files) {
			const content = await this.app.vault.cachedRead(file);
			const tasks = parseTasksFromMarkdown(content, file.path);
			const lines = content.split(/\r?\n/);
			let didRemoveDoneStatuses = false;

			for (const task of tasks) {
				if (task.completed && task.status !== null) {
					const lineIndex = task.line - 1;
					lines[lineIndex] = (lines[lineIndex] ?? "").replace(/\s+@s:[^\s]+/, "");
					task.status = null;
					didRemoveDoneStatuses = true;
				}

				task.resolvedTags = this.expandTaskTags(task.tags, tagGraph);
				task.score = scoreTask(task, new Date(), scoreFormula);
				allTasks.push(task);
			}

			if (didRemoveDoneStatuses) {
				await this.app.vault.modify(file, lines.join("\n"));
			}
		}

		return allTasks.sort((a, b) => b.score - a.score);
	}

	async loadTaskAggregatorData(): Promise<TaskAggregatorData> {
		const configResult = await this.loadConfig();
		const tasks = await this.loadTasks(
			configResult.scoreFormula ?? DEFAULT_SCORE_FORMULA,
			configResult.tagGraph
		);

		return {
			tasks,
			tagGraph: configResult.tagGraph,
			configStatus: configResult.status,
			configError: configResult.error,
			cycles: configResult.tagGraph.detectCycles()
		};
	}

	async updateTaskStatus(task: TaskItem, status: string | null): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(task.filePath);

		if (!(file instanceof TFile)) {
			new Notice("Could not find task file");
			return;
		}

		const content = await this.app.vault.read(file);
		const lines = content.split(/\r?\n/);
		const lineIndex = task.line - 1;
		const line = lines[lineIndex];

		if (line === undefined) {
			new Notice("Could not find task line");
			return;
		}

		const lineWithoutStatus = line.replace(/\s+@s:[^\s]+/, "");
		const nextStatus = task.completed ? null : status;

		lines[lineIndex] = nextStatus === null
			? lineWithoutStatus
			: `${lineWithoutStatus.trimEnd()} @s:${nextStatus}`;

		await this.app.vault.modify(file, lines.join("\n"));
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

	async openTaskConfig(): Promise<void> {
		const existingFile = this.app.vault.getAbstractFileByPath(CONFIG_FILE_PATH);
		const file = existingFile instanceof TFile
			? existingFile
			: await this.app.vault.create(CONFIG_FILE_PATH, taskConfigTemplate);

		const leaf = this.app.workspace.getLeaf(false);
		await leaf.openFile(file, { active: true });
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
		const file = this.app.vault.getAbstractFileByPath(task.filePath);
		const title = input.title.trim();

		if (!(file instanceof TFile)) {
			new Notice("Could not find task file");
			return;
		}

		if (title.length === 0) {
			new Notice("Task title is required");
			return;
		}

		const content = await this.app.vault.read(file);
		const lines = content.split(/\r?\n/);
		const lineIndex = task.line - 1;

		if (lines[lineIndex] === undefined) {
			new Notice("Could not find task line");
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
		let deleteCount = 1;

		while (lines[lineIndex + deleteCount] !== undefined && /^\s{2,}\S/.test(lines[lineIndex + deleteCount] ?? "")) {
			deleteCount++;
		}

		lines.splice(lineIndex, deleteCount, ...nextTaskLines);
		await this.app.vault.modify(file, lines.join("\n"));
	}

	async updateTaskCompleted(task: TaskItem, completed: boolean): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(task.filePath);

		if (!(file instanceof TFile)) {
			new Notice("Could not find task file");
			return;
		}

		const content = await this.app.vault.read(file);
		const lines = content.split(/\r?\n/);
		const lineIndex = task.line - 1;
		const line = lines[lineIndex];

		if (line === undefined) {
			new Notice("Could not find task line");
			return;
		}

		const nextLine = line.replace(/^(\s*-\s+\[)( |x|X)(\]\s+)/, `$1${completed ? "x" : " "}$3`);
		lines[lineIndex] = completed ? nextLine.replace(/\s+@s:[^\s]+/, "") : nextLine;

		await this.app.vault.modify(file, lines.join("\n"));
	}

	async updateTaskDueDate(task: TaskItem, dueDate: string | null): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(task.filePath);

		if (!(file instanceof TFile)) {
			new Notice("Could not find task file");
			return;
		}

		const content = await this.app.vault.read(file);
		const lines = content.split(/\r?\n/);
		const lineIndex = task.line - 1;
		const line = lines[lineIndex];

		if (line === undefined) {
			new Notice("Could not find task line");
			return;
		}

		const lineWithoutDueDate = line.replace(/\s+@d:[^\s]+/, "");
		lines[lineIndex] = dueDate === null
			? lineWithoutDueDate
			: `${lineWithoutDueDate.trimEnd()} @d:${dueDate}`;

		await this.app.vault.modify(file, lines.join("\n"));
	}

	async updateTaskPriority(task: TaskItem, priority: number): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(task.filePath);

		if (!(file instanceof TFile)) {
			new Notice("Could not find task file");
			return;
		}

		const content = await this.app.vault.read(file);
		const lines = content.split(/\r?\n/);
		const lineIndex = task.line - 1;
		const line = lines[lineIndex];

		if (line === undefined) {
			new Notice("Could not find task line");
			return;
		}

		const lineWithoutPriority = line.replace(/\s+@p:[^\s]+/, "");
		lines[lineIndex] = `${lineWithoutPriority.trimEnd()} @p:${priority}`;

		await this.app.vault.modify(file, lines.join("\n"));
	}

	async updateTaskTags(task: TaskItem, tags: string[]): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(task.filePath);

		if (!(file instanceof TFile)) {
			new Notice("Could not find task file");
			return;
		}

		const content = await this.app.vault.read(file);
		const lines = content.split(/\r?\n/);
		const lineIndex = task.line - 1;
		const line = lines[lineIndex];

		if (line === undefined) {
			new Notice("Could not find task line");
			return;
		}

		const normalizedTags = tags
			.map((tag) => normalizeTag(tag))
			.filter((tag) => tag.length > 0);
		const lineWithoutTags = line.replace(/\s+#[\p{L}\p{N}_/-]+/gu, "");
		const tagText = normalizedTags.map((tag) => `#${tag}`).join(" ");
		lines[lineIndex] = tagText.length === 0
			? lineWithoutTags
			: `${lineWithoutTags.trimEnd()} ${tagText}`;

		await this.app.vault.modify(file, lines.join("\n"));
	}

	async addConfigTag(tag: string): Promise<string | null> {
		const normalizedTag = normalizeTag(tag).replace(/\s+/g, "-");

		if (normalizedTag.length === 0) {
			return null;
		}

		const configFile = this.app.vault.getAbstractFileByPath(CONFIG_FILE_PATH);
		const tagLine = `#${normalizedTag} |`;

		if (!(configFile instanceof TFile)) {
			await this.app.vault.create(CONFIG_FILE_PATH, `${tagLine}\n`);
			return normalizedTag;
		}

		const content = await this.app.vault.read(configFile);

		if (parseTaskConfig(content).tagGraph.getAllTags().includes(normalizedTag)) {
			return normalizedTag;
		}

		const nextContent = content.endsWith("\n")
			? `${content}${tagLine}\n`
			: `${content}\n${tagLine}\n`;

		await this.app.vault.modify(configFile, nextContent);

		return normalizedTag;
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

	private async loadConfig(): Promise<{
		tagGraph: TagGraph;
		scoreFormula: string | null;
		status: TaskAggregatorData["configStatus"];
		error: string | null;
	}> {
		const configFile = this.app.vault.getAbstractFileByPath(CONFIG_FILE_PATH);

		if (!(configFile instanceof TFile)) {
			return {
				tagGraph: new TagGraph(),
				scoreFormula: null,
				status: "missing",
				error: null
			};
		}

		try {
			const content = await this.app.vault.cachedRead(configFile);
			const config = parseTaskConfig(content);

			return {
				tagGraph: config.tagGraph,
				scoreFormula: config.scoreFormula,
				status: "loaded",
				error: null
			};
		} catch (error) {
			console.error("Task Aggregator failed to load Tasks-Config.md", error);

			return {
				tagGraph: new TagGraph(),
				scoreFormula: null,
				status: "error",
				error: error instanceof Error ? error.message : "Unknown error"
			};
		}
	}

	private getTodayIsoDate(): string {
		const now = new Date();
		const timezoneOffsetMs = now.getTimezoneOffset() * 60 * 1000;

		return new Date(now.getTime() - timezoneOffsetMs).toISOString().slice(0, 10);
	}
}
