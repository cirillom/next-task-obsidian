import { ItemView, WorkspaceLeaf } from "obsidian";
import type TaskAggregatorPlugin from "./main";
import type { TaskItem } from "./model/task";

export const TASK_AGGREGATOR_VIEW = "task-aggregator-view";

export class TaskAggregatorView extends ItemView {
	private plugin: TaskAggregatorPlugin;

	constructor(leaf: WorkspaceLeaf, plugin: TaskAggregatorPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return TASK_AGGREGATOR_VIEW;
	}

	getDisplayText(): string {
		return "Task Aggregator";
	}

	getIcon(): string {
		return "list-todo";
	}

	async onOpen(): Promise<void> {
		await this.render();
	}

	async render(): Promise<void> {
		const container = this.containerEl.children[1];
		container.empty();

		container.createEl("h2", { text: "Task Aggregator" });

		const controls = container.createDiv({ cls: "task-aggregator-controls" });

		const refreshButton = controls.createEl("button", { text: "Refresh" });
		refreshButton.addEventListener("click", async () => {
			await this.render();
		});

		const tasks = await this.plugin.loadTasks();

		container.createEl("p", {
			text: `${tasks.length} task(s) found.`,
			cls: "task-aggregator-summary"
		});

		const list = container.createDiv({ cls: "task-aggregator-list" });

		for (const task of tasks) {
			this.renderTask(list, task);
		}
	}

	private renderTask(parent: HTMLElement, task: TaskItem): void {
		const card = parent.createDiv({ cls: "task-aggregator-task" });

		const header = card.createDiv({ cls: "task-aggregator-task-header" });

		header.createEl("input", {
			type: "checkbox",
			cls: "task-aggregator-checkbox"
		}).toggleAttribute("checked", task.completed);

		header.createEl("strong", {
			text: task.title,
			cls: "task-aggregator-title"
		});

		header.createEl("span", {
			text: `score: ${task.score.toFixed(1)}`,
			cls: "task-aggregator-score"
		});

		const meta = card.createDiv({ cls: "task-aggregator-meta" });

		meta.createSpan({ text: `status: ${task.status ?? "none"}` });
		meta.createSpan({ text: `created: ${task.createdDate ?? "none"}` });
		meta.createSpan({ text: `due: ${task.dueDate ?? "none"}` });
		meta.createSpan({ text: `priority: ${task.priority ?? "none"}` });

		if (task.tags.length > 0) {
			const tags = card.createDiv({ cls: "task-aggregator-tags" });

			for (const tag of task.tags) {
				tags.createSpan({
					text: `#${tag}`,
					cls: "task-aggregator-tag"
				});
			}
		}

		if (task.description.trim().length > 0) {
			card.createEl("p", {
				text: task.description,
				cls: "task-aggregator-description"
			});
		}

		card.createEl("small", {
			text: `${task.filePath}:${task.line}`,
			cls: "task-aggregator-source"
		});
	}
}