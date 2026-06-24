export function normalizePriority(value: string | number): number {
	return Math.max(1, Math.floor(Number(value) || 1));
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
