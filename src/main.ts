import { Notice, Plugin } from "obsidian";
import type { TaskItem } from "./model/task";
import { DEFAULT_SCORE_SCRIPT } from "./scoring/score";
import { TaskAggregatorView, TASK_AGGREGATOR_VIEW } from "./view";
import { TagGraph } from "./model/tag-graph";
import { registerCommands } from "./commands";
import { ConfigService } from "./config/config-service";
import { CONFIG_FILE_PATH } from "./constants";
import { TaskRepository } from "./tasks/task-repository";
import type { NewTaskInput } from "./tasks/task-repository";

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
	private configService!: ConfigService;

	async onload(): Promise<void> {
		this.taskRepository = new TaskRepository(this.app);
		this.configService = new ConfigService(this.app);

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
		const configResult = await this.configService.loadConfig();
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
		await this.configService.openTaskConfig();
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
		return this.configService.addConfigTag(tag);
	}

	async createConfigTemplate(): Promise<void> {
		const result = await this.configService.createConfigTemplate();

		new Notice(result === "created" ? `${CONFIG_FILE_PATH} created` : `${CONFIG_FILE_PATH} already exists`);

		if (result === "created") {
			await this.refreshOpenViews();
		}
	}
}
