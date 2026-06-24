import { Modal } from "obsidian";
import type TaskAggregatorPlugin from "../main";
import type { NewTaskInput } from "../main";
import type { TaskItem } from "../model/task";
import { normalizeTag } from "../model/tag-graph";
import { renderDueDateField } from "./due-date-field";
import { renderPriorityStepper } from "./priority-stepper";
import { renderStatusSelectField } from "./status-select";
import { renderTagSelector } from "./tag-selector";

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
		private readonly statuses: string[],
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
		renderDueDateField(meta, {
			value: this.dueDate,
			onChange: (dueDate) => {
				this.dueDate = dueDate;
			}
		});
		renderPriorityStepper(meta, this.priority, (priority) => {
			this.priority = priority;
		});
		renderStatusSelectField(meta, this.status, this.statuses, (status) => {
			this.status = status;
		});

		renderTagSelector(contentEl, {
			availableTags: this.availableTags,
			selectedTags: this.selectedTags,
			searchText: this.tagSearchText,
			onSearchChange: (searchText) => {
				this.tagSearchText = searchText;
				this.render();
			},
			onCreateTag: () => {
				void this.addNewTag();
			},
			onToggleTag: (tag) => {
				if (this.selectedTags.has(tag)) {
					this.selectedTags.delete(tag);
				} else {
					this.selectedTags.add(tag);
				}

				this.render();
			}
		});

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
