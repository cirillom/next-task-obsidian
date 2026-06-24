import { Notice, Plugin, TFile } from "obsidian";
import { parseTasksFromMarkdown } from "./parser/task-parser";
import type { TaskItem } from "./model/task";
import { scoreTask } from "./scoring/score";
import { TaskAggregatorView, TASK_AGGREGATOR_VIEW } from "./view";
import { parseTagGraphConfig } from "./parser/config-parser";
import { TagGraph } from "./model/tag-graph";

const CONFIG_FILE_PATH = "Tasks-Config.md";

export type TaskAggregatorData = {
	tasks: TaskItem[];
	tagGraph: TagGraph;
	configStatus: "loaded" | "missing" | "error";
	configError: string | null;
	cycles: string[][];
};

export default class TaskAggregatorPlugin extends Plugin {
	async onload(): Promise<void> {
		this.registerView(
			TASK_AGGREGATOR_VIEW,
			(leaf) => new TaskAggregatorView(leaf, this)
		);

		this.addRibbonIcon("list-todo", "Open task aggregator", async () => {
			await this.activateView();
		});

		this.addCommand({
			id: "open",
			name: "Open",
			callback: async () => {
				await this.activateView();
			}
		});

		this.addCommand({
			id: "refresh",
			name: "Refresh",
			callback: async () => {
				await this.refreshOpenViews();
				new Notice("Task aggregator refreshed");
			}
		});
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

	async loadTasks(): Promise<TaskItem[]> {
		const files = this.app.vault
			.getMarkdownFiles()
			.filter((file) => file.path !== CONFIG_FILE_PATH);

		const allTasks: TaskItem[] = [];

		for (const file of files) {
			const content = await this.app.vault.cachedRead(file);
			const tasks = parseTasksFromMarkdown(content, file.path);

			for (const task of tasks) {
				task.score = scoreTask(task);
				allTasks.push(task);
			}
		}

		return allTasks.sort((a, b) => b.score - a.score);
	}

	async loadTaskAggregatorData(): Promise<TaskAggregatorData> {
		const [tasks, configResult] = await Promise.all([
			this.loadTasks(),
			this.loadTagGraph()
		]);

		return {
			tasks,
			tagGraph: configResult.tagGraph,
			configStatus: configResult.status,
			configError: configResult.error,
			cycles: configResult.tagGraph.detectCycles()
		};
	}

	private async loadTagGraph(): Promise<{
		tagGraph: TagGraph;
		status: TaskAggregatorData["configStatus"];
		error: string | null;
	}> {
		const configFile = this.app.vault.getAbstractFileByPath(CONFIG_FILE_PATH);

		if (!(configFile instanceof TFile)) {
			return {
				tagGraph: new TagGraph(),
				status: "missing",
				error: null
			};
		}

		try {
			const content = await this.app.vault.cachedRead(configFile);

			return {
				tagGraph: parseTagGraphConfig(content),
				status: "loaded",
				error: null
			};
		} catch (error) {
			console.error("Task Aggregator failed to load Tasks-Config.md", error);

			return {
				tagGraph: new TagGraph(),
				status: "error",
				error: error instanceof Error ? error.message : "Unknown error"
			};
		}
	}
}
