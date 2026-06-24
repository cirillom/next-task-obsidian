export type StatusFilterOptions = {
	statuses: string[];
	selectedStatuses: Set<string>;
	onChange: (statuses: string[]) => void;
};

export function renderStatusFilter(
	parent: HTMLElement,
	options: StatusFilterOptions
): void {
	if (options.statuses.length === 0) {
		return;
	}

	const statusHints = parent.createDiv({ cls: "task-aggregator-status-hints" });
	statusHints.createSpan({
		text: "Status",
		cls: "task-aggregator-status-hints-label"
	});

	for (const status of options.statuses) {
		const isSelected = options.selectedStatuses.has(status);
		const button = statusHints.createEl("button", {
			text: status,
			cls: isSelected
				? "task-aggregator-status-hint task-aggregator-status-hint-selected"
				: "task-aggregator-status-hint"
		});

		button.addEventListener("click", () => {
			const selectedStatuses = new Set(options.selectedStatuses);

			if (selectedStatuses.has(status)) {
				selectedStatuses.delete(status);
			} else {
				selectedStatuses.add(status);
			}

			options.onChange([...selectedStatuses]);
		});
	}
}
