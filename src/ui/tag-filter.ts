import { normalizeTag } from "../model/tag-graph";

export type TagFilterOptions = {
	tags: string[];
	selectedTags: Set<string>;
	searchText: string;
	focusSearch?: boolean;
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

	const tagFilter = parent.createDiv({ cls: "task-aggregator-tag-filter" });
	const tagFilterControls = tagFilter.createDiv({
		cls: "task-aggregator-tag-filter-controls"
	});

	const searchInput = tagFilterControls.createEl("input", {
		cls: "task-aggregator-tag-search"
	});
	searchInput.type = "search";
	searchInput.placeholder = "Search tags";
	searchInput.value = options.searchText;

	if (options.focusSearch) {
		searchInput.setSelectionRange(options.searchText.length, options.searchText.length);
		searchInput.focus();
	}

	searchInput.addEventListener("input", () => {
		options.onSearchChange(searchInput.value);
	});

	const visibleTags = options.tags.filter((tag) => tag.includes(normalizeTag(options.searchText)));

	if (options.selectedTags.size > 0) {
		const deselectAllButton = tagFilterControls.createEl("button", {
			text: "Deselect all",
			cls: "task-aggregator-tag-filter-option"
		});

		deselectAllButton.addEventListener("click", () => {
			options.onChange([]);
		});
	}

	const tagFilterList = tagFilter.createDiv({
		cls: "task-aggregator-tag-filter-list"
	});

	for (const tag of visibleTags) {
		const isSelected = options.selectedTags.has(tag);
		const button = tagFilterList.createEl("button", {
			text: `#${tag}`,
			cls: isSelected
				? "task-aggregator-tag-filter-option task-aggregator-tag-filter-option-selected"
				: "task-aggregator-tag-filter-option"
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
