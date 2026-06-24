export type DueDateFieldOptions = {
	value: string;
	onChange?: (dueDate: string) => void;
	onCommit?: (dueDate: string) => void;
};

export function renderDueDateField(
	parent: HTMLElement,
	options: DueDateFieldOptions
): HTMLInputElement {
	const dueDateField = parent.createDiv({ cls: "task-aggregator-field" });
	dueDateField.createSpan({ text: "Due date", cls: "task-aggregator-field-label" });

	const dueDateInput = dueDateField.createEl("input");
	dueDateInput.type = "date";
	dueDateInput.value = options.value;
	dueDateInput.addEventListener("change", () => {
		options.onChange?.(dueDateInput.value);
	});

	if (options.onCommit) {
		dueDateInput.addEventListener("keydown", (event) => {
			if (event.key === "Enter") {
				options.onCommit?.(dueDateInput.value);
			}
		});
		dueDateInput.addEventListener("blur", () => {
			options.onCommit?.(dueDateInput.value);
		});
	}

	return dueDateInput;
}
