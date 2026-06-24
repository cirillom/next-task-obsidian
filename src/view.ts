import { ItemView, setIcon, WorkspaceLeaf } from "obsidian";
import type TaskAggregatorPlugin from "./main";
import type { TaskItem } from "./model/task";
import { TagGraph, normalizeTag } from "./model/tag-graph";
import { renderStatusFilter } from "./ui/status-filter";
import { renderTaskCard } from "./ui/task-card";
import { TaskFormModal } from "./ui/task-form-modal";
import { renderTagFilter } from "./ui/tag-filter";

export const TASK_AGGREGATOR_VIEW = "task-aggregator-view";

const STATUS_ORDER = ["todo", "doing", "blocked", "done"];

export class TaskAggregatorView extends ItemView {
	private plugin: TaskAggregatorPlugin;

	private allTasks: TaskItem[] = [];
	private tagGraph = new TagGraph();
	private configStatus: "loaded" | "missing" | "error" = "missing";
	private configError: string | null = null;
	private scoreError: string | null = null;
	private cycles: string[][] = [];

	private statusFilterText = "";
	private tagFilterText = "";
	private tagSearchText = "";

	constructor(leaf: WorkspaceLeaf, plugin: TaskAggregatorPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return TASK_AGGREGATOR_VIEW;
	}

	getDisplayText(): string {
		return "Task aggregator";
	}

	getIcon(): string {
		return "list-todo";
	}

	async onOpen(): Promise<void> {
		await this.refresh();
	}

	async refresh(): Promise<void> {
		const data = await this.plugin.loadTaskAggregatorData();
		this.allTasks = data.tasks;
		this.tagGraph = data.tagGraph;
		this.configStatus = data.configStatus;
		this.configError = data.configError;
		this.scoreError = data.scoreError;
		this.cycles = data.cycles;
		this.render();
	}

	render(): void {
		const container = this.contentEl;
		container.empty();

		const title = container.createDiv({ cls: "task-aggregator-title-row" });
		title.createEl("h2", { text: "Task aggregator" });
		const refreshButton = title.createEl("button", { cls: "task-aggregator-icon-button" });
		refreshButton.ariaLabel = "Refresh";
		setIcon(refreshButton, "refresh-cw");
		refreshButton.addEventListener("click", () => {
			void this.refresh();
		});
		const configButton = title.createEl("button", { cls: "task-aggregator-icon-button" });
		configButton.ariaLabel = "Open Tasks-Config.md";
		setIcon(configButton, "settings");
		configButton.addEventListener("click", () => {
			void this.plugin.openTaskConfig();
		});

		this.renderCycleWarnings(container);
		this.renderScoreWarning(container);
		this.renderControls(container);

		const filteredTasks = this.getFilteredTasks();

		container.createEl("p", {
			text: `${filteredTasks.length} of ${this.allTasks.length} task(s) shown.`,
			cls: "task-aggregator-summary"
		});

		if (filteredTasks.length === 0) {
			container.createEl("p", {
				text: "No tasks match the current filters.",
				cls: "task-aggregator-empty"
			});
			return;
		}

		const list = container.createDiv({ cls: "task-aggregator-list" });

		for (const task of filteredTasks) {
			this.renderTask(list, task);
		}
	}

	private renderControls(container: HTMLElement): void {
		const controls = container.createDiv({ cls: "task-aggregator-controls" });

		const buttons = controls.createDiv({ cls: "task-aggregator-buttons" });

		const newTaskButton = buttons.createEl("button", { text: "New task" });
		newTaskButton.addEventListener("click", () => {
			new TaskFormModal(
				this.plugin,
				this.getEditableTags(),
				async (input) => {
					await this.plugin.createTask(input);
					await this.refresh();
				}
			).open();
		});

		this.renderConfigStatus(container);
		this.renderStatusHints(container);
		this.renderAvailableTagHints(container);
	}

	private renderConfigStatus(container: HTMLElement): void {
		const status = container.createDiv({ cls: "task-aggregator-config-status" });

		if (this.configStatus === "loaded") {
			status.setText("Tasks-Config.md loaded");
			return;
		}

		if (this.configStatus === "error") {
			status.setText(`Tasks-Config.md could not be loaded: ${this.configError ?? "Unknown error"}`);
			return;
		}

		status.setText("No Tasks-Config.md found");
	}

	private renderCycleWarnings(container: HTMLElement): void {
		if (this.cycles.length === 0) {
			return;
		}

		const warning = container.createDiv({ cls: "task-aggregator-warning" });
		warning.createEl("strong", { text: "Circular tag dependencies detected" });

		const list = warning.createEl("ul");

		for (const cycle of this.cycles) {
			list.createEl("li", { text: cycle.join(" -> ") });
		}
	}

	private renderScoreWarning(container: HTMLElement): void {
		if (!this.scoreError) {
			return;
		}

		const warning = container.createDiv({ cls: "task-aggregator-warning" });
		warning.createEl("strong", { text: "Score calculation error" });
		warning.createEl("p", {
			text: `Scores are not being calculated from Tasks-Config.md. Using the default score instead. ${this.scoreError}`
		});
	}

	private renderStatusHints(container: HTMLElement): void {
		const statuses = this.getAvailableStatuses();

		renderStatusFilter(container, {
			statuses,
			selectedStatuses: new Set(this.parseStatusFilter(this.statusFilterText)),
			onChange: (selectedStatuses) => {
				this.statusFilterText = selectedStatuses.join(" ");
				this.render();
			}
		});
	}

	private renderAvailableTagHints(container: HTMLElement): void {
		const tags = this.getAvailableTags();

		renderTagFilter(container, {
			tags,
			selectedTags: new Set(this.parseTagFilter(this.tagFilterText)),
			searchText: this.tagSearchText,
			onSearchChange: (searchText) => {
				this.tagSearchText = searchText;
				this.render();
			},
			onChange: (selectedTags) => {
				this.tagFilterText = selectedTags.join(" ");
				this.render();
			}
		});
	}

	private renderTask(parent: HTMLElement, task: TaskItem): void {
		renderTaskCard(parent, task, {
			app: this.plugin.app,
			component: this,
			callbacks: {
				updateCompleted: async (selectedTask, completed) => {
					await this.plugin.updateTaskCompleted(selectedTask, completed);
					await this.refresh();
				},
				updateDueDate: async (selectedTask, dueDate) => {
					await this.plugin.updateTaskDueDate(selectedTask, dueDate);
					await this.refresh();
				},
				updatePriority: async (selectedTask, priority) => {
					await this.plugin.updateTaskPriority(selectedTask, priority);
					await this.refresh();
				},
				updateStatus: async (selectedTask, status) => {
					await this.plugin.updateTaskStatus(selectedTask, status);
					await this.refresh();
				},
				openSource: async (selectedTask) => {
					await this.plugin.openTaskSource(selectedTask);
				},
				filterTag: (tag) => {
					const selectedTags = new Set(this.parseTagFilter(this.tagFilterText));
					selectedTags.add(this.normalizeTag(tag));
					this.tagFilterText = [...selectedTags].join(" ");
					this.render();
				},
				editTask: (selectedTask) => {
					new TaskFormModal(
						this.plugin,
						this.getEditableTags(),
						async (input) => {
							await this.plugin.updateTask(selectedTask, input);
							await this.refresh();
						},
						selectedTask
					).open();
				}
			}
		});
	}

	private getFilteredTasks(): TaskItem[] {
		const tagFilter = this.parseTagFilter(this.tagFilterText);
		const statusFilter = this.parseStatusFilter(this.statusFilterText);

		return this.allTasks.filter((task) => {
			return this.matchesStatusFilter(task, statusFilter) && this.matchesTagFilter(task, tagFilter);
		});
	}

	private matchesStatusFilter(task: TaskItem, statusFilter: string[]): boolean {
		return statusFilter.length === 0 || statusFilter.includes(this.getTaskFilterStatus(task));
	}

	private matchesTagFilter(task: TaskItem, tagFilter: string[]): boolean {
		if (tagFilter.length === 0) {
			return true;
		}

		const taskTags = this.getTaskFilterTags(task);
		const expandedFilters = tagFilter.map((tag) => this.tagGraph.expandDescendants(tag));

		return expandedFilters.some((expandedFilter) =>
			taskTags.some((taskTag) => expandedFilter.has(taskTag))
		);
	}

	private getAvailableStatuses(): string[] {
		const statuses = new Set<string>();

		for (const task of this.allTasks) {
			statuses.add(this.getTaskFilterStatus(task));
		}

		return [...statuses].sort((a, b) => {
			const orderDiff = STATUS_ORDER.indexOf(a) - STATUS_ORDER.indexOf(b);

			return orderDiff !== 0 ? orderDiff : a.localeCompare(b);
		});
	}

	private getAvailableTags(): string[] {
		const tags = new Set<string>();

		for (const task of this.allTasks) {
			for (const tag of this.getTaskFilterTags(task)) {
				tags.add(this.normalizeTag(tag));
			}
		}

		return this.sortTags([...tags]);
	}

	private sortTags(tags: string[]): string[] {
		return [...tags].sort((a, b) => {
			const descendantDiff = this.getDescendantCount(b) - this.getDescendantCount(a);

			return descendantDiff !== 0 ? descendantDiff : a.localeCompare(b);
		});
	}

	private getEditableTags(): string[] {
		const tags = new Set<string>(this.tagGraph.getAllTags());

		for (const task of this.allTasks) {
			for (const tag of task.tags) {
				tags.add(this.normalizeTag(tag));
			}
		}

		return this.sortTags([...tags]);
	}

	private parseTagFilter(value: string): string[] {
		return value
			.split(/[,\s]+/)
			.map((tag) => this.normalizeTag(tag))
			.filter((tag) => tag.length > 0);
	}

	private parseStatusFilter(value: string): string[] {
		return value
			.split(/\s+/)
			.map((status) => status.trim())
			.filter((status) => status.length > 0);
	}

	private normalizeTag(tag: string): string {
		return normalizeTag(tag);
	}

	private getTaskFilterTags(task: TaskItem): string[] {
		return (task.resolvedTags ?? task.tags).map((tag) => this.normalizeTag(tag));
	}

	private getDescendantCount(tag: string): number {
		return Math.max(0, this.tagGraph.expandDescendants(tag).size - 1);
	}

	private getTaskFilterStatus(task: TaskItem): string {
		if (task.status) {
			return task.status;
		}

		return task.completed ? "done" : "todo";
	}

}
