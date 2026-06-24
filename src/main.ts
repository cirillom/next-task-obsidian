import { Notice, Plugin, TFile } from "obsidian";
import type { TaskItem } from "./model/task";
import { DEFAULT_SCORE_SCRIPT, validateScoreScript } from "./scoring/score";
import { TaskAggregatorView, TASK_AGGREGATOR_VIEW } from "./view";
import { parseTaskConfig } from "./parser/config-parser";
import { TagGraph, normalizeTag } from "./model/tag-graph";
import { registerCommands } from "./commands";
import taskConfigTemplate from "./templates/Tasks-Config.md";
import { TaskRepository } from "./tasks/task-repository";
import type { NewTaskInput } from "./tasks/task-repository";

const CONFIG_FILE_PATH = "Tasks-Config.md";

export type { NewTaskInput };

export type TaskAggregatorData = {
	tasks: TaskItem[];
	tagGraph: TagGraph;
	configStatus: "loaded" | "missing" | "error";
	configError: string | null;
	scoreError: string | null;
	cycles: string[][];
};

export default class TaskAggregatorPlugin extends Plugin {
	readonly configFilePath = CONFIG_FILE_PATH;
	private taskRepository!: TaskRepository;

	async onload(): Promise<void> {
		this.taskRepository = new TaskRepository(this.app);

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
		scoreScript = DEFAULT_SCORE_SCRIPT,
		tagGraph = new TagGraph()
	): Promise<TaskItem[]> {
		return this.taskRepository.loadTasks(scoreScript, tagGraph);
	}

	async loadTaskAggregatorData(): Promise<TaskAggregatorData> {
		const configResult = await this.loadConfig();
		const tasks = await this.loadTasks(
			configResult.scoreScript ?? DEFAULT_SCORE_SCRIPT,
			configResult.tagGraph
		);

		return {
			tasks,
			tagGraph: configResult.tagGraph,
			configStatus: configResult.status,
			configError: configResult.error,
			scoreError: configResult.scoreError,
			cycles: configResult.tagGraph.detectCycles()
		};
	}

	async updateTaskStatus(task: TaskItem, status: string | null): Promise<void> {
		await this.taskRepository.updateTaskStatus(task, status);
	}

	async openTaskSource(task: TaskItem): Promise<void> {
		await this.taskRepository.openTaskSource(task);
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
		await this.taskRepository.createTask(input);
	}

	async updateTask(task: TaskItem, input: NewTaskInput): Promise<void> {
		await this.taskRepository.updateTask(task, input);
	}

	async updateTaskCompleted(task: TaskItem, completed: boolean): Promise<void> {
		await this.taskRepository.updateTaskCompleted(task, completed);
	}

	async updateTaskDueDate(task: TaskItem, dueDate: string | null): Promise<void> {
		await this.taskRepository.updateTaskDueDate(task, dueDate);
	}

	async updateTaskPriority(task: TaskItem, priority: number): Promise<void> {
		await this.taskRepository.updateTaskPriority(task, priority);
	}

	async updateTaskTags(task: TaskItem, tags: string[]): Promise<void> {
		await this.taskRepository.updateTaskTags(task, tags);
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

	private async loadConfig(): Promise<{
		tagGraph: TagGraph;
		scoreScript: string | null;
		scoreError: string | null;
		status: TaskAggregatorData["configStatus"];
		error: string | null;
	}> {
		const configFile = this.app.vault.getAbstractFileByPath(CONFIG_FILE_PATH);

		if (!(configFile instanceof TFile)) {
			return {
				tagGraph: new TagGraph(),
				scoreScript: null,
				scoreError: null,
				status: "missing",
				error: null
			};
		}

		try {
			const content = await this.app.vault.read(configFile);
			const config = parseTaskConfig(content);

			return {
				tagGraph: config.tagGraph,
				scoreScript: config.scoreScript,
				scoreError: config.scoreScript ? validateScoreScript(config.scoreScript) : null,
				status: "loaded",
				error: null
			};
		} catch (error) {
			console.error("Task Aggregator failed to load Tasks-Config.md", error);

			return {
				tagGraph: new TagGraph(),
				scoreScript: null,
				scoreError: null,
				status: "error",
				error: error instanceof Error ? error.message : "Unknown error"
			};
		}
	}

}
