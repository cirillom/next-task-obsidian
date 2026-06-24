import { ItemView, WorkspaceLeaf } from "obsidian";
import type TaskAggregatorPlugin from "./main";
import type { TaskItem } from "./model/task";
import { TagGraph, normalizeTag } from "./model/tag-graph";

export const TASK_AGGREGATOR_VIEW = "task-aggregator-view";

const ALL_STATUSES = "__all__";
const NO_STATUS = "__none__";
const TAG_MATCH_ALL = "all";
const TAG_MATCH_ANY = "any";

type TagMatchMode = "any" | "all";

export class TaskAggregatorView extends ItemView {
	private plugin: TaskAggregatorPlugin;

	private allTasks: TaskItem[] = [];
	private tagGraph = new TagGraph();
	private configStatus: "loaded" | "missing" | "error" = "missing";
	private configError: string | null = null;
	private cycles: string[][] = [];

	private statusFilter = ALL_STATUSES;
	private tagFilterText = "";
	private tagSearchText = "";
	private tagMatchMode: TagMatchMode = TAG_MATCH_ALL;

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
		this.cycles = data.cycles;
		this.render();
	}

	render(): void {
		const container = this.contentEl;
		container.empty();

		container.createEl("h2", { text: "Task aggregator" });

		this.renderCycleWarnings(container);
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

		const statusGroup = controls.createDiv({ cls: "task-aggregator-control-group" });
		statusGroup.createEl("label", { text: "Status" });

		const statusSelect = statusGroup.createEl("select");
		this.addOption(statusSelect, ALL_STATUSES, "All statuses");

		const statuses = this.getAvailableStatuses();

		if (statuses.has(null)) {
			this.addOption(statusSelect, NO_STATUS, "No status");
		}

		for (const status of [...statuses].filter((s): s is string => s !== null)) {
			this.addOption(statusSelect, status, status);
		}

		statusSelect.value = this.statusFilter;

		statusSelect.addEventListener("change", () => {
			this.statusFilter = statusSelect.value;
			this.render();
		});

		const modeGroup = controls.createDiv({ cls: "task-aggregator-control-group" });
		modeGroup.createEl("label", { text: "Tag mode" });

		const tagModeSelect = modeGroup.createEl("select");
		this.addOption(tagModeSelect, TAG_MATCH_ALL, "All");
		this.addOption(tagModeSelect, TAG_MATCH_ANY, "Any");
		tagModeSelect.value = this.tagMatchMode;

		tagModeSelect.addEventListener("change", () => {
			this.tagMatchMode = tagModeSelect.value as TagMatchMode;
			this.render();
		});

		const buttons = controls.createDiv({ cls: "task-aggregator-buttons" });

		const refreshButton = buttons.createEl("button", { text: "Refresh" });
		refreshButton.addEventListener("click", () => {
			void this.refresh();
		});

		const resetButton = buttons.createEl("button", { text: "Reset filters" });
		resetButton.addEventListener("click", () => {
			this.statusFilter = ALL_STATUSES;
			this.tagFilterText = "";
			this.tagSearchText = "";
			this.tagMatchMode = TAG_MATCH_ALL;
			this.render();
		});

		this.renderConfigStatus(container);
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

	private renderAvailableTagHints(container: HTMLElement): void {
		const tags = this.getAvailableTags();

		if (tags.length === 0) {
			return;
		}

		const tagHints = container.createDiv({ cls: "task-aggregator-tag-hints" });
		const tagHintControls = tagHints.createDiv({ cls: "task-aggregator-tag-hint-controls" });

		const searchInput = tagHintControls.createEl("input", {
			cls: "task-aggregator-tag-search"
		});
		searchInput.type = "search";
		searchInput.placeholder = "Search tags";
		searchInput.value = this.tagSearchText;
		searchInput.setSelectionRange(this.tagSearchText.length, this.tagSearchText.length);
		searchInput.focus();
		searchInput.addEventListener("input", () => {
			this.tagSearchText = searchInput.value;
			this.render();
		});

		const visibleTags = tags.filter((tag) => tag.includes(this.normalizeTag(this.tagSearchText)));
		const selectedTags = new Set(this.parseTagFilter(this.tagFilterText));
		const allVisibleSelected = visibleTags.every((tag) => selectedTags.has(tag));

		const toggleAllButton = tagHintControls.createEl("button", {
			text: allVisibleSelected ? "Deselect all" : "Select all",
			cls: "task-aggregator-tag-hint"
		});

		toggleAllButton.addEventListener("click", () => {
			if (allVisibleSelected) {
				this.tagFilterText = [...selectedTags]
					.filter((tag) => !visibleTags.includes(tag))
					.join(" ");
			} else {
				this.tagFilterText = [...new Set([...selectedTags, ...visibleTags])].join(" ");
			}

			this.render();
		});

		const tagHintList = tagHints.createDiv({ cls: "task-aggregator-tag-hint-list" });

		for (const tag of visibleTags) {
			const isSelected = selectedTags.has(tag);
			const button = tagHintList.createEl("button", {
				text: `#${tag}`,
				cls: isSelected
					? "task-aggregator-tag-hint task-aggregator-tag-hint-selected"
					: "task-aggregator-tag-hint"
			});

			button.addEventListener("click", () => {
				if (selectedTags.has(tag)) {
					selectedTags.delete(tag);
				} else {
					selectedTags.add(tag);
				}

				this.tagFilterText = [...selectedTags].join(" ");
				this.render();
			});
		}
	}

	private renderTask(parent: HTMLElement, task: TaskItem): void {
		const card = parent.createDiv({ cls: "task-aggregator-task" });

		const header = card.createDiv({ cls: "task-aggregator-task-header" });

		const checkbox = header.createEl("input", {
			cls: "task-aggregator-checkbox"
		});
		checkbox.type = "checkbox";
		checkbox.checked = task.completed;
		checkbox.disabled = true;

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

	private getFilteredTasks(): TaskItem[] {
		const tagFilter = this.parseTagFilter(this.tagFilterText);

		return this.allTasks.filter((task) => {
			return this.matchesStatusFilter(task) && this.matchesTagFilter(task, tagFilter);
		});
	}

	private matchesStatusFilter(task: TaskItem): boolean {
		if (this.statusFilter === ALL_STATUSES) {
			return true;
		}

		if (this.statusFilter === NO_STATUS) {
			return task.status === null;
		}

		return task.status === this.statusFilter;
	}

	private matchesTagFilter(task: TaskItem, tagFilter: string[]): boolean {
		if (tagFilter.length === 0) {
			return true;
		}

		const taskTags = task.tags.map((tag) => this.normalizeTag(tag));
		const expandedFilters = tagFilter.map((tag) => this.tagGraph.expandDescendants(tag));

		if (this.tagMatchMode === "any") {
			return expandedFilters.some((expandedFilter) =>
				taskTags.some((taskTag) => expandedFilter.has(taskTag))
			);
		}

		return expandedFilters.every((expandedFilter) =>
			taskTags.some((taskTag) => expandedFilter.has(taskTag))
		);
	}

	private getAvailableStatuses(): Set<string | null> {
		const statuses = new Set<string | null>();

		for (const task of this.allTasks) {
			statuses.add(task.status);
		}

		return statuses;
	}

	private getAvailableTags(): string[] {
		const tags = new Set<string>();

		for (const task of this.allTasks) {
			for (const tag of task.tags) {
				tags.add(this.normalizeTag(tag));
			}
		}

		return [...tags].sort((a, b) => a.localeCompare(b));
	}

	private parseTagFilter(value: string): string[] {
		return value
			.split(/[,\s]+/)
			.map((tag) => this.normalizeTag(tag))
			.filter((tag) => tag.length > 0);
	}

	private normalizeTag(tag: string): string {
		return normalizeTag(tag);
	}

	private addOption(select: HTMLSelectElement, value: string, text: string): void {
		const option = select.createEl("option", { text });
		option.value = value;
	}
}
