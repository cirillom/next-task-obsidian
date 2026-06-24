import { EDITABLE_STATUSES } from "../constants";
import { normalizeTag } from "../model/tag-graph";

export function normalizePriority(value: string | number): number {
	return Math.max(1, Math.floor(Number(value) || 1));
}

export function renderDueDateField(
	parent: HTMLElement,
	value: string,
	onChange: (dueDate: string) => void,
	onCommit?: (dueDate: string) => void
): HTMLInputElement {
	const dueDateField = parent.createDiv({ cls: "task-aggregator-field" });
	dueDateField.createSpan({ text: "Due date", cls: "task-aggregator-field-label" });

	const dueDateInput = dueDateField.createEl("input");
	dueDateInput.type = "date";
	dueDateInput.value = value;
	dueDateInput.addEventListener("change", () => {
		onChange(dueDateInput.value);
	});

	if (onCommit) {
		dueDateInput.addEventListener("keydown", (event) => {
			if (event.key === "Enter") {
				onCommit(dueDateInput.value);
			}
		});
		dueDateInput.addEventListener("blur", () => {
			onCommit(dueDateInput.value);
		});
	}

	return dueDateInput;
}

export function renderPriorityStepper(
	parent: HTMLElement,
	value: number,
	onChange: (priority: number) => void
): HTMLInputElement {
	let currentValue = value;
	const priorityField = parent.createDiv({ cls: "task-aggregator-field" });
	priorityField.createSpan({ text: "Priority", cls: "task-aggregator-field-label" });

	const priorityControls = priorityField.createDiv({ cls: "task-aggregator-priority-controls" });
	const decreasePriorityButton = priorityControls.createEl("button", { text: "-" });
	const priorityInput = priorityControls.createEl("input");
	const increasePriorityButton = priorityControls.createEl("button", { text: "+" });

	const setPriority = (priority: number): void => {
		currentValue = normalizePriority(priority);
		priorityInput.value = currentValue.toString();
		decreasePriorityButton.disabled = currentValue <= 1;
		onChange(currentValue);
	};

	decreasePriorityButton.disabled = currentValue <= 1;
	decreasePriorityButton.addEventListener("click", () => {
		setPriority(Math.max(1, currentValue - 1));
	});

	priorityInput.type = "number";
	priorityInput.min = "1";
	priorityInput.required = true;
	priorityInput.value = currentValue.toString();
	priorityInput.addEventListener("change", () => {
		setPriority(normalizePriority(priorityInput.value));
	});

	increasePriorityButton.addEventListener("click", () => {
		setPriority(currentValue + 1);
	});

	return priorityInput;
}

export function renderStatusSelectField(
	parent: HTMLElement,
	value: string,
	onChange: (status: string) => void
): HTMLSelectElement {
	const statusField = parent.createDiv({ cls: "task-aggregator-field" });
	statusField.createSpan({ text: "Status", cls: "task-aggregator-field-label" });

	const statusSelect = statusField.createEl("select");
	addOption(statusSelect, "", "");

	for (const status of EDITABLE_STATUSES) {
		addOption(statusSelect, status, status);
	}

	statusSelect.value = value;
	statusSelect.addEventListener("change", () => {
		onChange(statusSelect.value);
	});

	return statusSelect;
}

export type TagSelectorOptions = {
	availableTags: string[];
	selectedTags: Set<string>;
	searchText: string;
	onSearchChange: (searchText: string) => void;
	onCreateTag: () => void;
	onToggleTag: (tag: string) => void;
};

export function renderTagSelector(parent: HTMLElement, options: TagSelectorOptions): void {
	const tags = parent.createDiv({ cls: "task-aggregator-tag-hint-list task-aggregator-modal-tag-list" });
	const searchInput = tags.createEl("input", { cls: "task-aggregator-tag-search" });
	searchInput.type = "search";
	searchInput.placeholder = "Search tags";
	searchInput.value = options.searchText;
	searchInput.setSelectionRange(options.searchText.length, options.searchText.length);
	searchInput.focus();
	searchInput.addEventListener("input", () => {
		options.onSearchChange(searchInput.value);
	});

	const normalizedSearch = normalizeTag(options.searchText);
	const visibleTags = options.availableTags.filter((tag) => tag.includes(normalizedSearch));

	if (visibleTags.length === 0 && normalizedSearch.length > 0) {
		const createTagButton = tags.createEl("button", {
			text: `Create #${normalizedSearch}`,
			cls: "task-aggregator-tag-hint"
		});
		createTagButton.addEventListener("click", () => {
			options.onCreateTag();
		});
	}

	for (const tag of visibleTags) {
		const isSelected = options.selectedTags.has(tag);
		const button = tags.createEl("button", {
			text: `#${tag}`,
			cls: isSelected
				? "task-aggregator-tag-hint task-aggregator-tag-hint-selected"
				: "task-aggregator-tag-hint"
		});

		button.addEventListener("click", () => {
			options.onToggleTag(tag);
		});
	}
}

function addOption(select: HTMLSelectElement, value: string, text: string): void {
	const option = select.createEl("option", { text });
	option.value = value;
}
