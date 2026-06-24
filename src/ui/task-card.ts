import { App, Component, MarkdownRenderer, setIcon } from "obsidian";
import type { TaskItem } from "../model/task";

const EDITABLE_STATUSES = ["doing", "blocked"] as const;

type TaskCardCallbacks = {
	updateCompleted: (task: TaskItem, completed: boolean) => Promise<void>;
	updateDueDate: (task: TaskItem, dueDate: string | null) => Promise<void>;
	updatePriority: (task: TaskItem, priority: number) => Promise<void>;
	updateStatus: (task: TaskItem, status: string | null) => Promise<void>;
	openSource: (task: TaskItem) => Promise<void>;
	filterTag: (tag: string) => void;
	editTask: (task: TaskItem) => void;
};

export type TaskCardOptions = {
	app: App;
	component: Component;
	callbacks: TaskCardCallbacks;
};

export function renderTaskCard(
	parent: HTMLElement,
	task: TaskItem,
	options: TaskCardOptions
): void {
	const card = parent.createDiv({ cls: "task-aggregator-task" });
	const header = card.createDiv({ cls: "task-aggregator-task-header" });
	const checkbox = header.createEl("input", {
		cls: "task-aggregator-checkbox"
	});
	checkbox.type = "checkbox";
	checkbox.checked = task.completed;
	checkbox.addEventListener("change", () => {
		void options.callbacks.updateCompleted(task, checkbox.checked);
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
		options.callbacks.editTask(task);
	});

	const meta = card.createDiv({ cls: "task-aggregator-meta" });
	renderDueDateField(meta, task, options.callbacks.updateDueDate);
	renderPriorityField(meta, task, options.callbacks.updatePriority);
	renderStatusField(meta, task, options.callbacks.updateStatus);
	renderTags(card, task, options.callbacks.filterTag);
	renderDescription(card, task, options);
	renderSource(card, task, options.callbacks.openSource);
}

function renderDueDateField(
	parent: HTMLElement,
	task: TaskItem,
	updateDueDate: (task: TaskItem, dueDate: string | null) => Promise<void>
): void {
	const dueDateField = parent.createDiv({ cls: "task-aggregator-field" });
	dueDateField.createSpan({ text: "Due date", cls: "task-aggregator-field-label" });

	const dueDateInput = dueDateField.createEl("input");
	dueDateInput.type = "date";
	dueDateInput.value = task.dueDate ?? "";
	const saveDueDate = (): void => {
		if ((task.dueDate ?? "") === dueDateInput.value) {
			return;
		}

		void updateDueDate(task, dueDateInput.value || null);
	};
	dueDateInput.addEventListener("keydown", (event) => {
		if (event.key === "Enter") {
			saveDueDate();
		}
	});
	dueDateInput.addEventListener("blur", () => {
		saveDueDate();
	});
}

function renderPriorityField(
	parent: HTMLElement,
	task: TaskItem,
	updatePriority: (task: TaskItem, priority: number) => Promise<void>
): void {
	const priorityField = parent.createDiv({ cls: "task-aggregator-field" });
	priorityField.createSpan({ text: "Priority", cls: "task-aggregator-field-label" });

	const priorityControls = priorityField.createDiv({ cls: "task-aggregator-priority-controls" });
	const decreasePriorityButton = priorityControls.createEl("button", { text: "-" });
	const priorityInput = priorityControls.createEl("input");
	const increasePriorityButton = priorityControls.createEl("button", { text: "+" });

	decreasePriorityButton.disabled = task.priority <= 1;
	decreasePriorityButton.addEventListener("click", () => {
		void updatePriority(task, Math.max(1, task.priority - 1));
	});

	priorityInput.type = "number";
	priorityInput.min = "1";
	priorityInput.required = true;
	priorityInput.value = task.priority.toString();
	priorityInput.addEventListener("change", () => {
		const priority = Math.max(1, Math.floor(Number(priorityInput.value) || 1));

		void updatePriority(task, priority);
	});

	increasePriorityButton.addEventListener("click", () => {
		void updatePriority(task, task.priority + 1);
	});
}

function renderStatusField(
	parent: HTMLElement,
	task: TaskItem,
	updateStatus: (task: TaskItem, status: string | null) => Promise<void>
): void {
	const statusField = parent.createDiv({ cls: "task-aggregator-field" });
	statusField.createSpan({ text: "Status", cls: "task-aggregator-field-label" });

	const statusSelect = statusField.createEl("select");
	addOption(statusSelect, "", "");

	for (const status of EDITABLE_STATUSES) {
		addOption(statusSelect, status, status);
	}

	statusSelect.value = task.status ?? "";
	statusSelect.addEventListener("change", () => {
		void updateStatus(task, statusSelect.value || null);
	});
}

function renderTags(
	parent: HTMLElement,
	task: TaskItem,
	filterTag: (tag: string) => void
): void {
	const tags = parent.createDiv({ cls: "task-aggregator-tags" });

	for (const tag of task.tags) {
		const tagButton = tags.createEl("button", {
			text: `#${tag}`,
			cls: "task-aggregator-tag"
		});
		tagButton.addEventListener("click", () => {
			filterTag(tag);
		});
	}
}

function renderDescription(
	parent: HTMLElement,
	task: TaskItem,
	options: TaskCardOptions
): void {
	if (task.description.trim().length === 0) {
		return;
	}

	const description = parent.createDiv({ cls: "task-aggregator-description" });
	void MarkdownRenderer.render(
		options.app,
		task.description,
		description,
		task.filePath,
		options.component
	);
}

function renderSource(
	parent: HTMLElement,
	task: TaskItem,
	openSource: (task: TaskItem) => Promise<void>
): void {
	const source = parent.createEl("small", {
		text: `${task.filePath}:${task.line} · created: ${task.createdDate}`,
		cls: "task-aggregator-source"
	});
	source.addEventListener("click", () => {
		void openSource(task);
	});
}

function addOption(select: HTMLSelectElement, value: string, text: string): void {
	const option = select.createEl("option", { text });
	option.value = value;
}
