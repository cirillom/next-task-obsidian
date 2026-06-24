import { normalizeTag } from "../model/tag-graph";

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
