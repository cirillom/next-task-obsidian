import { Modal } from "obsidian";
import type TaskAggregatorPlugin from "../main";
import type { NewTaskInput } from "../main";
import type { TaskItem } from "../model/task";
import { normalizeTag } from "../model/tag-graph";

const EDITABLE_STATUSES = ["doing", "blocked"] as const;

export class TaskFormModal extends Modal {
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
			this.priority = task.priority;
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
