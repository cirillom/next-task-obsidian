import { ItemView, Modal, setIcon, WorkspaceLeaf } from "obsidian";
import type TaskAggregatorPlugin from "./main";
import type { NewTaskInput } from "./main";
import type { TaskItem } from "./model/task";
import { TagGraph, normalizeTag } from "./model/tag-graph";

export const TASK_AGGREGATOR_VIEW = "task-aggregator-view";

const EDITABLE_STATUSES = ["doing", "blocked"] as const;
const STATUS_ORDER = ["todo", "doing", "blocked", "done"];

export class TaskAggregatorView extends ItemView {
	private plugin: TaskAggregatorPlugin;

	private allTasks: TaskItem[] = [];
	private tagGraph = new TagGraph();
	private configStatus: "loaded" | "missing" | "error" = "missing";
	private configError: string | null = null;
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

		const buttons = controls.createDiv({ cls: "task-aggregator-buttons" });

		const newTaskButton = buttons.createEl("button", { text: "New task" });
		newTaskButton.addEventListener("click", () => {
			new NewTaskModal(
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

	private renderStatusHints(container: HTMLElement): void {
		const statuses = this.getAvailableStatuses();

		if (statuses.length === 0) {
			return;
		}

		const selectedStatuses = new Set(this.parseStatusFilter(this.statusFilterText));
		const statusHints = container.createDiv({ cls: "task-aggregator-status-hints" });
		statusHints.createSpan({
			text: "Status",
			cls: "task-aggregator-status-hints-label"
		});

		for (const status of statuses) {
			const isSelected = selectedStatuses.has(status);
			const button = statusHints.createEl("button", {
				text: status,
				cls: isSelected
					? "task-aggregator-status-hint task-aggregator-status-hint-selected"
					: "task-aggregator-status-hint"
			});

			button.addEventListener("click", () => {
				if (selectedStatuses.has(status)) {
					selectedStatuses.delete(status);
				} else {
					selectedStatuses.add(status);
				}

				this.statusFilterText = [...selectedStatuses].join(" ");
				this.render();
			});
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
		checkbox.addEventListener("change", () => {
			void this.plugin.updateTaskCompleted(task, checkbox.checked)
				.then(() => this.refresh());
		});

		header.createEl("strong", {
			text: task.title,
			cls: "task-aggregator-title"
		});

		header.createEl("span", {
			text: `score: ${task.score.toFixed(1)}`,
			cls: "task-aggregator-score"
		});

		const editTaskButton = header.createEl("button", {
			cls: "task-aggregator-edit-task"
		});
		editTaskButton.ariaLabel = "Edit task";
		setIcon(editTaskButton, "pencil");
		editTaskButton.addEventListener("click", () => {
			new NewTaskModal(
				this.plugin,
				this.getEditableTags(),
				async (input) => {
					await this.plugin.updateTask(task, input);
					await this.refresh();
				},
				task
			).open();
		});

		const meta = card.createDiv({ cls: "task-aggregator-meta" });

		const dueDateField = meta.createDiv({ cls: "task-aggregator-field" });
		dueDateField.createSpan({ text: "Due date", cls: "task-aggregator-field-label" });

		const dueDateInput = dueDateField.createEl("input");
		dueDateInput.type = "date";
		dueDateInput.value = task.dueDate ?? "";
		dueDateInput.addEventListener("change", () => {
			void this.plugin.updateTaskDueDate(task, dueDateInput.value || null)
				.then(() => this.refresh());
		});

		const priorityField = meta.createDiv({ cls: "task-aggregator-field" });
		priorityField.createSpan({ text: "Priority", cls: "task-aggregator-field-label" });

		const priorityControls = priorityField.createDiv({ cls: "task-aggregator-priority-controls" });
		const decreasePriorityButton = priorityControls.createEl("button", { text: "-" });
		const priorityInput = priorityControls.createEl("input");
		const increasePriorityButton = priorityControls.createEl("button", { text: "+" });

		decreasePriorityButton.disabled = (task.priority ?? 1) <= 1;
		decreasePriorityButton.addEventListener("click", () => {
			void this.plugin.updateTaskPriority(task, Math.max(1, (task.priority ?? 1) - 1))
				.then(() => this.refresh());
		});

		priorityInput.type = "number";
		priorityInput.min = "1";
		priorityInput.required = true;
		priorityInput.value = task.priority?.toString() ?? "1";
		priorityInput.addEventListener("change", () => {
			const priority = Math.max(1, Math.floor(Number(priorityInput.value) || 1));

			void this.plugin.updateTaskPriority(task, priority)
				.then(() => this.refresh());
		});

		increasePriorityButton.addEventListener("click", () => {
			void this.plugin.updateTaskPriority(task, (task.priority ?? 1) + 1)
				.then(() => this.refresh());
		});

		const statusField = meta.createDiv({ cls: "task-aggregator-field" });
		statusField.createSpan({ text: "Status", cls: "task-aggregator-field-label" });

		const statusSelect = statusField.createEl("select");
		this.addOption(statusSelect, "", "");

		for (const status of EDITABLE_STATUSES) {
			this.addOption(statusSelect, status, status);
		}

		statusSelect.value = task.status ?? "";
		statusSelect.addEventListener("change", () => {
			void this.plugin.updateTaskStatus(task, statusSelect.value || null)
				.then(() => this.refresh());
		});

		const tags = card.createDiv({ cls: "task-aggregator-tags" });

		for (const tag of task.tags) {
			const tagButton = tags.createEl("button", {
				text: `#${tag}`,
				cls: "task-aggregator-tag"
			});
			tagButton.addEventListener("click", () => {
				const selectedTags = new Set(this.parseTagFilter(this.tagFilterText));
				selectedTags.add(this.normalizeTag(tag));
				this.tagFilterText = [...selectedTags].join(" ");
				this.render();
			});
		}

		if (task.description.trim().length > 0) {
			card.createEl("p", {
				text: task.description,
				cls: "task-aggregator-description"
			});
		}

		const source = card.createEl("small", {
			text: `${task.filePath}:${task.line} · created: ${task.createdDate}`,
			cls: "task-aggregator-source"
		});
		source.addEventListener("click", () => {
			void this.plugin.openTaskSource(task);
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

	private addOption(select: HTMLSelectElement, value: string, text: string): void {
		const option = select.createEl("option", { text });
		option.value = value;
	}
}

class NewTaskModal extends Modal {
	private selectedTags = new Set<string>();
	private availableTags: string[];
	private titleText = "";
	private dueDate = "";
	private priority = 1;
	private status = "";
	private description = "";
	private tagSearchText = "";

	constructor(
		private readonly plugin: TaskAggregatorPlugin,
		availableTags: string[],
		private readonly onSave: (input: NewTaskInput) => Promise<void>,
		private readonly task?: TaskItem
	) {
		super(plugin.app);
		this.availableTags = availableTags;

		if (task) {
			this.selectedTags = new Set(task.tags.map((tag) => normalizeTag(tag)));
			this.titleText = task.title;
			this.dueDate = task.dueDate ?? "";
			this.priority = task.priority ?? 1;
			this.status = task.status ?? "";
			this.description = task.description;
		}
	}

	onOpen(): void {
		this.render();
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: this.task ? "Edit task" : "New task" });

		const titleField = contentEl.createDiv({ cls: "task-aggregator-field" });
		titleField.createSpan({ text: "Title", cls: "task-aggregator-field-label" });
		const titleInput = titleField.createEl("input");
		titleInput.type = "text";
		titleInput.value = this.titleText;
		titleInput.addEventListener("input", () => {
			this.titleText = titleInput.value;
		});

		const meta = contentEl.createDiv({ cls: "task-aggregator-meta" });
		const dueDateField = meta.createDiv({ cls: "task-aggregator-field" });
		dueDateField.createSpan({ text: "Due date", cls: "task-aggregator-field-label" });
		const dueDateInput = dueDateField.createEl("input");
		dueDateInput.type = "date";
		dueDateInput.value = this.dueDate;
		dueDateInput.addEventListener("change", () => {
			this.dueDate = dueDateInput.value;
		});

		const priorityField = meta.createDiv({ cls: "task-aggregator-field" });
		priorityField.createSpan({ text: "Priority", cls: "task-aggregator-field-label" });
		const priorityInput = priorityField.createEl("input");
		priorityInput.type = "number";
		priorityInput.min = "1";
		priorityInput.value = this.priority.toString();
		priorityInput.addEventListener("change", () => {
			this.priority = Math.max(1, Math.floor(Number(priorityInput.value) || 1));
		});

		const statusField = meta.createDiv({ cls: "task-aggregator-field" });
		statusField.createSpan({ text: "Status", cls: "task-aggregator-field-label" });
		const statusSelect = statusField.createEl("select");
		this.addOption(statusSelect, "", "");

		for (const status of EDITABLE_STATUSES) {
			this.addOption(statusSelect, status, status);
		}

		statusSelect.value = this.status;
		statusSelect.addEventListener("change", () => {
			this.status = statusSelect.value;
		});

		const tags = contentEl.createDiv({ cls: "task-aggregator-tag-hint-list task-aggregator-modal-tag-list" });
		const searchInput = tags.createEl("input", { cls: "task-aggregator-tag-search" });
		searchInput.type = "search";
		searchInput.placeholder = "Search tags";
		searchInput.value = this.tagSearchText;
		searchInput.setSelectionRange(this.tagSearchText.length, this.tagSearchText.length);
		searchInput.focus();
		searchInput.addEventListener("input", () => {
			this.tagSearchText = searchInput.value;
			this.render();
		});

		const visibleTags = this.availableTags.filter((tag) => tag.includes(normalizeTag(this.tagSearchText)));

		if (visibleTags.length === 0 && normalizeTag(this.tagSearchText).length > 0) {
			const createTagButton = tags.createEl("button", {
				text: `Create #${normalizeTag(this.tagSearchText)}`,
				cls: "task-aggregator-tag-hint"
			});
			createTagButton.addEventListener("click", () => {
				void this.addNewTag();
			});
		}

		for (const tag of visibleTags) {
			const isSelected = this.selectedTags.has(tag);
			const button = tags.createEl("button", {
				text: `#${tag}`,
				cls: isSelected
					? "task-aggregator-tag-hint task-aggregator-tag-hint-selected"
					: "task-aggregator-tag-hint"
			});

			button.addEventListener("click", () => {
				if (isSelected) {
					this.selectedTags.delete(tag);
				} else {
					this.selectedTags.add(tag);
				}

				this.render();
			});
		}

		const descriptionField = contentEl.createDiv({ cls: "task-aggregator-field task-aggregator-new-task-description" });
		descriptionField.createSpan({ text: "Description", cls: "task-aggregator-field-label" });
		const descriptionInput = descriptionField.createEl("textarea");
		descriptionInput.value = this.description;
		descriptionInput.addEventListener("input", () => {
			this.description = descriptionInput.value;
		});

		const actions = contentEl.createDiv({ cls: "task-aggregator-modal-actions" });
		const saveButton = actions.createEl("button", { text: this.task ? "Save" : "Create task" });
		saveButton.addEventListener("click", () => {
			void this.onSave({
				title: this.titleText,
				dueDate: this.dueDate || null,
				priority: this.priority,
				status: this.status || null,
				tags: [...this.selectedTags],
				description: this.description
			}).then(() => this.close());
		});
	}

	private addOption(select: HTMLSelectElement, value: string, text: string): void {
		const option = select.createEl("option", { text });
		option.value = value;
	}

	private async addNewTag(): Promise<void> {
		const tag = await this.plugin.addConfigTag(this.tagSearchText);

		if (!tag) {
			return;
		}

		if (!this.availableTags.includes(tag)) {
			this.availableTags = [...this.availableTags, tag].sort((a, b) => a.localeCompare(b));
		}

		this.selectedTags.add(tag);
		this.tagSearchText = "";
		this.render();
	}
}
