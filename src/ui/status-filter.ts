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

	const statusFilter = parent.createDiv({
		cls: "task-aggregator-status-filter task-aggregator-status-hints"
	});
	statusFilter.createSpan({
		text: "Status",
		cls: "task-aggregator-status-filter-label task-aggregator-status-hints-label"
	});

	for (const status of options.statuses) {
		const isSelected = options.selectedStatuses.has(status);
		const button = statusFilter.createEl("button", {
			text: status,
			cls: isSelected
				? "task-aggregator-status-filter-option task-aggregator-status-filter-option-selected task-aggregator-status-hint task-aggregator-status-hint-selected"
				: "task-aggregator-status-filter-option task-aggregator-status-hint"
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
