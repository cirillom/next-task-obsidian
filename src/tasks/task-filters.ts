import type { TaskItem } from "../model/task";
import { normalizeTag, TagGraph } from "../model/tag-graph";
import {
	DEFAULT_STATUS_DEFINITIONS,
	getDefaultStatusFilterText,
	getTaskFilterStatus,
	sortStatuses,
} from "../model/task-status";

export const DEFAULT_STATUS_FILTER_TEXT = getDefaultStatusFilterText(DEFAULT_STATUS_DEFINITIONS);

export function getFilteredTasks(
	tasks: TaskItem[],
	tagGraph: TagGraph,
	statusFilterText: string,
	tagFilterText: string,
	statusDefinitions = DEFAULT_STATUS_DEFINITIONS
): TaskItem[] {
	const tagFilter = parseTagFilter(tagFilterText);
	const statusFilter = parseStatusFilter(statusFilterText);

	return tasks.filter((task) => {
		return matchesStatusFilter(task, statusFilter) &&
			matchesTagFilter(task, tagGraph, tagFilter);
	});
}

export function getAvailableStatuses(
	tasks: TaskItem[],
	statusDefinitions = DEFAULT_STATUS_DEFINITIONS
): string[] {
	const statuses = new Set<string>();

	for (const task of tasks) {
		statuses.add(getTaskFilterStatus(task));
	}

	return sortStatuses([...statuses], statusDefinitions);
}

export function getAvailableTags(tasks: TaskItem[], tagGraph: TagGraph): string[] {
	const tags = new Set<string>();

	for (const task of tasks) {
		for (const tag of getTaskFilterTags(task)) {
			tags.add(normalizeTag(tag));
		}
	}

	return sortTags([...tags], tagGraph);
}

export function getEditableTags(tasks: TaskItem[], tagGraph: TagGraph): string[] {
	const tags = new Set<string>(tagGraph.getAllTags());

	for (const task of tasks) {
		for (const tag of task.tags) {
			tags.add(normalizeTag(tag));
		}
	}

	return sortTags([...tags], tagGraph);
}

export function parseTagFilter(value: string): string[] {
	return value
		.split(/[,\s]+/)
		.map((tag) => normalizeTag(tag))
		.filter((tag) => tag.length > 0);
}

export function parseStatusFilter(value: string): string[] {
	return value
		.split(/\s+/)
		.map((status) => status.trim())
		.filter((status) => status.length > 0);
}

function matchesStatusFilter(task: TaskItem, statusFilter: string[]): boolean {
	return statusFilter.includes(getTaskFilterStatus(task));
}

function matchesTagFilter(task: TaskItem, tagGraph: TagGraph, tagFilter: string[]): boolean {
	if (tagFilter.length === 0) {
		return true;
	}

	const taskTags = getTaskFilterTags(task);
	const expandedFilters = tagFilter.map((tag) => tagGraph.expandDescendants(tag));

	return expandedFilters.some((expandedFilter) =>
		taskTags.some((taskTag) => expandedFilter.has(taskTag))
	);
}

function getTaskFilterTags(task: TaskItem): string[] {
	return (task.resolvedTags ?? task.tags).map((tag) => normalizeTag(tag));
}

function sortTags(tags: string[], tagGraph: TagGraph): string[] {
	return [...tags].sort((a, b) => {
		const descendantDiff = getDescendantCount(b, tagGraph) - getDescendantCount(a, tagGraph);

		return descendantDiff !== 0 ? descendantDiff : a.localeCompare(b);
	});
}

function getDescendantCount(tag: string, tagGraph: TagGraph): number {
	return Math.max(0, tagGraph.expandDescendants(tag).size - 1);
}
