import { Notice, Plugin, TFile } from "obsidian";
import { parseTasksFromMarkdown } from "./parser/task-parser";
import type { TaskItem } from "./model/task";
import { DEFAULT_SCORE_FORMULA, scoreTask } from "./scoring/score";
import { TaskAggregatorView, TASK_AGGREGATOR_VIEW } from "./view";
import { parseTaskConfig } from "./parser/config-parser";
import { TagGraph } from "./model/tag-graph";
import { registerCommands } from "./commands";

const CONFIG_FILE_PATH = "Tasks-Config.md";

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

			for (const task of tasks) {
				task.resolvedTags = this.expandTaskTags(task.tags, tagGraph);
				task.score = scoreTask(task, new Date(), scoreFormula);
				allTasks.push(task);
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

	async updateTaskPriority(task: TaskItem, priority: number | null): Promise<void> {
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
		lines[lineIndex] = priority === null
			? lineWithoutPriority
			: `${lineWithoutPriority.trimEnd()} @p:${priority}`;

		await this.app.vault.modify(file, lines.join("\n"));
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
}
