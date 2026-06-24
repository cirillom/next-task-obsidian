import type { TaskItem } from "./task";

export type TaskStatusName = string;

export type TaskStatusDefinition = {
	name: TaskStatusName;
	defaultVisible: boolean;
	scoreValue: number;
};

export const TODO_STATUS = "todo";
export const DONE_STATUS = "done";

export const DEFAULT_STATUS_DEFINITIONS: TaskStatusDefinition[] = [
	{ name: TODO_STATUS, defaultVisible: true, scoreValue: 0 },
	{ name: "doing", defaultVisible: true, scoreValue: 1 },
	{ name: "blocked", defaultVisible: false, scoreValue: 2 },
	{ name: DONE_STATUS, defaultVisible: false, scoreValue: 0 }
];

export function normalizeStatus(status: string): TaskStatusName {
	return status.trim().toLowerCase();
}

export function getTaskFilterStatus(task: TaskItem): TaskStatusName {
	if (task.status) {
		return normalizeStatus(task.status);
	}

	return task.completed ? DONE_STATUS : TODO_STATUS;
}

export function getDefaultStatusFilterText(statuses: TaskStatusDefinition[]): string {
	return statuses
		.filter((status) => status.defaultVisible)
		.map((status) => status.name)
		.join(" ");
}

export function getWritableStatuses(statuses: TaskStatusDefinition[]): TaskStatusName[] {
	return statuses
		.map((status) => status.name)
		.filter((status) => status !== TODO_STATUS && status !== DONE_STATUS);
}

export function getStatusScoreValue(
	status: TaskStatusName,
	statuses: TaskStatusDefinition[]
): number {
	return statuses.find((definition) => definition.name === status)?.scoreValue ?? 0;
}

export function sortStatuses(
	statuses: TaskStatusName[],
	statusDefinitions: TaskStatusDefinition[]
): TaskStatusName[] {
	return [...statuses].sort((a, b) => {
		const orderDiff = getStatusOrder(a, statusDefinitions) - getStatusOrder(b, statusDefinitions);

		return orderDiff !== 0 ? orderDiff : a.localeCompare(b);
	});
}

function getStatusOrder(status: TaskStatusName, statusDefinitions: TaskStatusDefinition[]): number {
	const index = statusDefinitions.findIndex((definition) => definition.name === status);

	return index >= 0 ? index : Number.MAX_SAFE_INTEGER;
}
