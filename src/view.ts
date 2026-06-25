import { ItemView, setIcon, WorkspaceLeaf } from "obsidian";
import { CONFIG_FILE_PATH } from "./constants";
import type TaskAggregatorPlugin from "./main";
import type { TaskItem } from "./model/task";
import { TagGraph, normalizeTag } from "./model/tag-graph";
import {
	DEFAULT_STATUS_DEFINITIONS,
	getDefaultStatusFilterText,
	getWritableStatuses
} from "./model/task-status";
import {
	DEFAULT_STATUS_FILTER_TEXT,
	getAvailableStatuses,
	getAvailableTags,
	getFilteredTasks,
	parseStatusFilter,
	parseTagFilter
} from "./tasks/task-filters";
import { renderStatusFilter } from "./ui/status-filter";
import { renderTaskCard } from "./ui/task-card";
import { openTaskForm } from "./ui/task-form-modal";
import { renderTagFilter } from "./ui/tag-filter";

export const NEXT_TASK_VIEW = "next-task-view";

export class TaskAggregatorView extends ItemView {
	private plugin: TaskAggregatorPlugin;

	private allTasks: TaskItem[] = [];
	private tagGraph = new TagGraph();
	private configStatus: "loaded" | "missing" | "error" = "missing";
	private configError: string | null = null;
	private scoreError: string | null = null;
	private cycles: string[][] = [];
	private statusDefinitions = DEFAULT_STATUS_DEFINITIONS;
	private didApplyDefaultStatusFilter = false;

	private statusFilterText = DEFAULT_STATUS_FILTER_TEXT;
	private tagFilterText = "";
	private tagSearchText = "";
	private shouldFocusTagSearch = false;

	constructor(leaf: WorkspaceLeaf, plugin: TaskAggregatorPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return NEXT_TASK_VIEW;
	}

	getDisplayText(): string {
		return "Next task";
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
		this.statusDefinitions = data.statusDefinitions;

		if (!this.didApplyDefaultStatusFilter) {
			this.statusFilterText = getDefaultStatusFilterText(this.statusDefinitions);
			this.didApplyDefaultStatusFilter = true;
		}

		this.render();
	}

	render(): void {
		const container = this.contentEl;
		container.empty();

		const title = container.createDiv({ cls: "task-aggregator-title-row" });
		title.createEl("h2", { text: "Next task" });
		const refreshButton = title.createEl("button", { cls: "task-aggregator-icon-button" });
		refreshButton.ariaLabel = "Refresh";
		setIcon(refreshButton, "refresh-cw");
		refreshButton.addEventListener("click", () => {
			void this.refresh();
		});
		const configButton = title.createEl("button", { cls: "task-aggregator-icon-button" });
		configButton.ariaLabel = `Open ${CONFIG_FILE_PATH}`;
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
			void openTaskForm(
				this.plugin,
				async (input) => {
					await this.plugin.createTask(input);
					await this.refresh();
					return true;
				}
			);
		});

		this.renderConfigStatus(container);
		this.renderStatusFilterControls(container);
		this.renderTagFilterControls(container);
	}

	private renderConfigStatus(container: HTMLElement): void {
		const status = container.createDiv({ cls: "task-aggregator-config-status" });

		if (this.configStatus === "loaded") {
			status.setText(`${CONFIG_FILE_PATH} loaded`);
			return;
		}

		if (this.configStatus === "error") {
			status.setText(`${CONFIG_FILE_PATH} could not be loaded: ${this.configError ?? "Unknown error"}`);
			return;
		}

		status.setText(`No ${CONFIG_FILE_PATH} found`);
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
			text: `Scores are not being calculated from ${CONFIG_FILE_PATH}. Using the default score instead. ${this.scoreError}`
		});
	}

	private renderStatusFilterControls(container: HTMLElement): void {
		const statuses = getAvailableStatuses(this.allTasks, this.statusDefinitions);

		renderStatusFilter(container, {
			statuses,
			selectedStatuses: new Set(parseStatusFilter(this.statusFilterText)),
			onChange: (selectedStatuses) => {
				this.statusFilterText = selectedStatuses.join(" ");
				this.render();
			}
		});
	}

	private renderTagFilterControls(container: HTMLElement): void {
		const tags = getAvailableTags(this.allTasks, this.tagGraph);

		renderTagFilter(container, {
			tags,
			selectedTags: new Set(parseTagFilter(this.tagFilterText)),
			searchText: this.tagSearchText,
			focusSearch: this.shouldFocusTagSearch,
			onSearchChange: (searchText) => {
				this.tagSearchText = searchText;
				this.shouldFocusTagSearch = true;
				this.render();
			},
			onChange: (selectedTags) => {
				this.tagFilterText = selectedTags.join(" ");
				this.render();
			}
		});
		this.shouldFocusTagSearch = false;
	}

	private renderTask(parent: HTMLElement, task: TaskItem): void {
		renderTaskCard(parent, task, {
			app: this.plugin.app,
			component: this,
			statuses: this.getWritableStatuses(),
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
				updateDescription: async (selectedTask, description) => {
					await this.plugin.updateTaskDescription(selectedTask, description);
					await this.refresh();
				},
				openSource: async (selectedTask) => {
					await this.plugin.openTaskSource(selectedTask);
				},
				filterTag: (tag) => {
					const selectedTags = new Set(parseTagFilter(this.tagFilterText));
					selectedTags.add(this.normalizeTag(tag));
					this.tagFilterText = [...selectedTags].join(" ");
					this.render();
				},
				editTask: (selectedTask) => {
					void openTaskForm(
						this.plugin,
						async (input) => {
							await this.plugin.updateTask(selectedTask, input);
							await this.refresh();
							return true;
						},
						selectedTask
					);
				}
			}
		});
	}

	private getFilteredTasks(): TaskItem[] {
		return getFilteredTasks(
			this.allTasks,
			this.tagGraph,
			this.statusFilterText,
			this.tagFilterText,
			this.statusDefinitions
		);
	}

	private normalizeTag(tag: string): string {
		return normalizeTag(tag);
	}

	private getWritableStatuses(): string[] {
		return getWritableStatuses(this.statusDefinitions);
	}

}
