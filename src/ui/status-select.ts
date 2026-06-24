export function renderStatusSelectField(
	parent: HTMLElement,
	value: string,
	statuses: string[],
	onChange: (status: string) => void
): HTMLSelectElement {
	const statusField = parent.createDiv({ cls: "task-aggregator-field" });
	statusField.createSpan({ text: "Status", cls: "task-aggregator-field-label" });

	const statusSelect = statusField.createEl("select");
	addOption(statusSelect, "", "");

	for (const status of statuses) {
		addOption(statusSelect, status, status);
	}

	statusSelect.value = value;
	statusSelect.addEventListener("change", () => {
		onChange(statusSelect.value);
	});

	return statusSelect;
}

function addOption(select: HTMLSelectElement, value: string, text: string): void {
	const option = select.createEl("option", { text });
	option.value = value;
}
