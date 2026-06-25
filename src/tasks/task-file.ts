import { parseYaml } from "obsidian";
import type { TFile } from "obsidian";
import type { TaskItem } from "../model/task";
import { DONE_STATUS, normalizeStatus } from "../model/task-status";
import { normalizeTag } from "../model/tag-graph";
import taskFileTemplate from "../templates/Task-File.md";

export const TASK_FILE_STATUS_PROPERTY = "status";
export const TASK_FILE_PRIORITY_PROPERTY = "priority";
export const TASK_FILE_CREATED_DATE_PROPERTY = "creation-date";
export const TASK_FILE_DUE_DATE_PROPERTY = "due-date";
export const TASK_FILE_TAGS_PROPERTY = "tags";

type TaskFileFrontMatter = Record<string, unknown>;
type FrontMatterBlock = {
	yaml: string;
	contentStart: number;
};

export function parseTaskFile(content: string, file: TFile): TaskItem | null {
	const frontMatter = parseTaskFileFrontMatter(content);

	if (!frontMatter) {
		return null;
	}

	const status = getString(frontMatter[TASK_FILE_STATUS_PROPERTY]);
	const createdDate = getString(frontMatter[TASK_FILE_CREATED_DATE_PROPERTY]);
	const dueDate = getString(frontMatter[TASK_FILE_DUE_DATE_PROPERTY]);
	const priority = Number(frontMatter[TASK_FILE_PRIORITY_PROPERTY]);

	if (!status || !createdDate || !dueDate || !isValidPriority(priority)) {
		return null;
	}

	const normalizedStatus = normalizeStatus(status);

	return {
		sourceType: "file",
		title: file.basename,
		status: normalizedStatus,
		createdDate,
		dueDate,
		priority,
		tags: getTags(frontMatter[TASK_FILE_TAGS_PROPERTY]),
		description: getTaskFileBody(content),
		filePath: file.path,
		line: 1,
		completed: normalizedStatus === DONE_STATUS,
		score: 0
	};
}

export function buildTaskFileTemplate(createdDate: string): string {
	return taskFileTemplate.replaceAll("{{date}}", createdDate);
}

export function getTaskFileBody(content: string): string {
	const frontMatter = getFrontMatterBlock(content);

	if (!frontMatter) {
		return content.trim();
	}

	return content.slice(frontMatter.contentStart).trim();
}

export function replaceTaskFileBody(content: string, description: string): string {
	const frontMatter = getFrontMatterBlock(content);
	const body = description.trim();

	if (!frontMatter) {
		return body.length > 0 ? `${body}\n` : "";
	}

	return `${content.slice(0, frontMatter.contentStart)}${body.length > 0 ? `${body}\n` : ""}`;
}

function parseTaskFileFrontMatter(content: string): TaskFileFrontMatter | null {
	const frontMatterBlock = getFrontMatterBlock(content);

	if (!frontMatterBlock) {
		return null;
	}

	const frontMatter = parseYaml(frontMatterBlock.yaml) as unknown;

	return isRecord(frontMatter) ? frontMatter : null;
}

function getFrontMatterBlock(content: string): FrontMatterBlock | null {
	if (!content.startsWith("---")) {
		return null;
	}

	const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);

	if (!match) {
		return null;
	}

	return {
		yaml: match[1] ?? "",
		contentStart: match[0].length
	};
}

function getString(value: unknown): string | null {
	return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function getTags(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value
			.map((tag) => typeof tag === "string" ? normalizeTag(tag) : "")
			.filter((tag) => tag.length > 0);
	}

	if (typeof value === "string") {
		return value
			.split(/[,\s]+/)
			.map((tag) => normalizeTag(tag))
			.filter((tag) => tag.length > 0);
	}

	return [];
}

function isValidPriority(priority: number): boolean {
	return Number.isInteger(priority) && priority >= 1;
}

function isRecord(value: unknown): value is TaskFileFrontMatter {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
