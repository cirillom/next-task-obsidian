import { Notice, Plugin } from "obsidian";
import { parseTasksFromMarkdown } from "./parser/task-parser";
import type { TaskItem } from "./model/task";
import { scoreTask } from "./scoring/score";
import { TaskAggregatorView, TASK_AGGREGATOR_VIEW } from "./view";

export default class TaskAggregatorPlugin extends Plugin {
	async onload(): Promise<void> {
		this.registerView(
			TASK_AGGREGATOR_VIEW,
			(leaf) => new TaskAggregatorView(leaf, this)
		);

		this.addRibbonIcon("list-todo", "Open Task Aggregator", async () => {
			await this.activateView();
		});

		this.addCommand({
			id: "open-task-aggregator",
			name: "Open Task Aggregator",
			callback: async () => {
				await this.activateView();
			}
		});

		this.addCommand({
			id: "refresh-task-aggregator",
			name: "Refresh Task Aggregator",
			callback: async () => {
				await this.refreshOpenViews();
				new Notice("Task Aggregator refreshed");
			}
		});
	}

	onunload(): void {
		this.app.workspace.detachLeavesOfType(TASK_AGGREGATOR_VIEW);
	}

	async activateView(): Promise<void> {
		const existingLeaves = this.app.workspace.getLeavesOfType(TASK_AGGREGATOR_VIEW);

		if (existingLeaves.length > 0) {
			this.app.workspace.revealLeaf(existingLeaves[0]);
			return;
		}

		const leaf = this.app.workspace.getRightLeaf(false);

		if (!leaf) {
			new Notice("Could not open Task Aggregator view");
			return;
		}

		await leaf.setViewState({
			type: TASK_AGGREGATOR_VIEW,
			active: true
		});

		this.app.workspace.revealLeaf(leaf);
	}

	async refreshOpenViews(): Promise<void> {
		const leaves = this.app.workspace.getLeavesOfType(TASK_AGGREGATOR_VIEW);

		for (const leaf of leaves) {
			const view = leaf.view;

			if (view instanceof TaskAggregatorView) {
				await view.render();
			}
		}
	}

	async loadTasks(): Promise<TaskItem[]> {
		const files = this.app.vault
			.getMarkdownFiles()
			.filter((file) => file.path !== "Tasks-Config.md");

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
}