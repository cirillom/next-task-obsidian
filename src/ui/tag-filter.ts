import { normalizeTag } from "../model/tag-graph";

export type TagFilterOptions = {
	tags: string[];
	selectedTags: Set<string>;
	searchText: string;
	onSearchChange: (searchText: string) => void;
	onChange: (tags: string[]) => void;
};

export function renderTagFilter(
	parent: HTMLElement,
	options: TagFilterOptions
): void {
	if (options.tags.length === 0) {
		return;
	}

	const tagHints = parent.createDiv({ cls: "task-aggregator-tag-hints" });
	const tagHintControls = tagHints.createDiv({ cls: "task-aggregator-tag-hint-controls" });

	const searchInput = tagHintControls.createEl("input", {
		cls: "task-aggregator-tag-search"
	});
	searchInput.type = "search";
	searchInput.placeholder = "Search tags";
	searchInput.value = options.searchText;
	searchInput.setSelectionRange(options.searchText.length, options.searchText.length);
	searchInput.focus();
	searchInput.addEventListener("input", () => {
		options.onSearchChange(searchInput.value);
	});

	const visibleTags = options.tags.filter((tag) => tag.includes(normalizeTag(options.searchText)));
	const allVisibleSelected = visibleTags.every((tag) => options.selectedTags.has(tag));

	const toggleAllButton = tagHintControls.createEl("button", {
		text: allVisibleSelected ? "Deselect all" : "Select all",
		cls: "task-aggregator-tag-hint"
	});

	toggleAllButton.addEventListener("click", () => {
		if (allVisibleSelected) {
			options.onChange([...options.selectedTags].filter((tag) => !visibleTags.includes(tag)));
		} else {
			options.onChange([...new Set([...options.selectedTags, ...visibleTags])]);
		}
	});

	const tagHintList = tagHints.createDiv({ cls: "task-aggregator-tag-hint-list" });

	for (const tag of visibleTags) {
		const isSelected = options.selectedTags.has(tag);
		const button = tagHintList.createEl("button", {
			text: `#${tag}`,
			cls: isSelected
				? "task-aggregator-tag-hint task-aggregator-tag-hint-selected"
				: "task-aggregator-tag-hint"
		});

		button.addEventListener("click", () => {
			const selectedTags = new Set(options.selectedTags);

			if (selectedTags.has(tag)) {
				selectedTags.delete(tag);
			} else {
				selectedTags.add(tag);
			}

			options.onChange([...selectedTags]);
		});
	}
}
