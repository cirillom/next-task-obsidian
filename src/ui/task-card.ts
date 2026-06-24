import { App, Component, MarkdownRenderer, setIcon } from "obsidian";
import type { TaskItem } from "../model/task";
import { renderDueDateField } from "./due-date-field";
import { renderPriorityStepper } from "./priority-stepper";
import { renderStatusSelectField } from "./status-select";

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
	statuses: string[];
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
	renderDueDateField(meta, {
		value: task.dueDate ?? "",
		onCommit: (dueDate) => {
			if ((task.dueDate ?? "") !== dueDate) {
				void options.callbacks.updateDueDate(task, dueDate || null);
			}
		}
	});
	renderPriorityStepper(meta, task.priority, (priority) => {
		void options.callbacks.updatePriority(task, priority);
	});
	renderStatusSelectField(meta, task.status ?? "", options.statuses, (status) => {
		void options.callbacks.updateStatus(task, status || null);
	});
	renderTags(card, task, options.callbacks.filterTag);
	renderDescription(card, task, options);
	renderSource(card, task, options.callbacks.openSource);
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
		text: `${task.filePath}:${task.line} - created: ${task.createdDate}`,
		cls: "task-aggregator-source"
	});
	source.addEventListener("click", () => {
		void openSource(task);
	});
}
