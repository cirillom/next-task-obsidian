import { normalizeTag } from "../model/tag-graph";

export const TASK_LINE = /^\s*-\s+\[( |x|X)\]\s+(.*)$/;
export const DESCRIPTION_LINE = /^(?:\t+| {2,})\s*\S/;

const FIELD = /@\w+:[^\s]+/g;
const STATUS_FIELD = /\s+@s:[^\s]+/;
const DUE_DATE_FIELD = /\s+@d:[^\s]+/;
const PRIORITY_FIELD = /\s+@p:[^\s]+/;
const TAG = /#[\p{L}\p{N}_/-]+/gu;
const TAG_WITH_LEADING_SPACE = /\s+#[\p{L}\p{N}_/-]+/gu;
const DESCRIPTION_INDENT = /^(?:\t| {2,4})/;
const DESCRIPTION_CHECKBOX = /^(\s*[-*+]\s+\[)( |x|X)(\]\s+)/;

export type ParsedTaskLine = {
	completed: boolean;
	body: string;
};

export type ParsedTaskMetadata = {
	status: string | null;
	createdDate: string | null;
	dueDate: string | null;
	priority: number;
	tags: string[];
	title: string;
};

export type TaskMarkdownInput = {
	title: string;
	completed: boolean;
	createdDate: string;
	dueDate: string | null;
	priority: number;
	status: string | null;
	tags: string[];
	description: string;
};

export function parseTaskLine(line: string): ParsedTaskLine | null {
	const match = line.match(TASK_LINE);

	if (!match) {
		return null;
	}

	return {
		completed: (match[1] ?? "").toLowerCase() === "x",
		body: match[2] ?? ""
	};
}

export function parseTaskMetadata(body: string): ParsedTaskMetadata {
	const priorityRaw = extractField(body, "p");

	return {
		status: extractField(body, "s"),
		createdDate: extractField(body, "c"),
		dueDate: extractField(body, "d"),
		priority: priorityRaw ? Number(priorityRaw) : NaN,
		tags: [...body.matchAll(TAG)]
			.map((tagMatch) => tagMatch[0])
			.map((tag) => normalizeTag(tag))
			.filter((tag) => tag.length > 0),
		title: body
			.replace(FIELD, "")
			.replace(TAG, "")
			.trim()
	};
}

export function collectTaskDescription(lines: string[], startIndex: number): string[] {
	const descriptionLines: string[] = [];
	let lineIndex = startIndex;

	while (lineIndex < lines.length && DESCRIPTION_LINE.test(lines[lineIndex] ?? "")) {
		descriptionLines.push(stripDescriptionIndent(lines[lineIndex] ?? ""));
		lineIndex++;
	}

	return descriptionLines;
}

export function updateDescriptionCheckbox(
	description: string,
	checkboxIndex: number,
	checked: boolean
): string {
	let currentCheckboxIndex = 0;
	let didUpdate = false;
	const lines = description.split(/\r?\n/).map((line) => {
		const match = line.match(DESCRIPTION_CHECKBOX);

		if (!match) {
			return line;
		}

		if (currentCheckboxIndex !== checkboxIndex) {
			currentCheckboxIndex++;
			return line;
		}

		currentCheckboxIndex++;
		didUpdate = true;
		return line.replace(DESCRIPTION_CHECKBOX, `$1${checked ? "x" : " "}$3`);
	});

	return didUpdate ? lines.join("\n") : description;
}

export function buildTaskMarkdownLines(input: TaskMarkdownInput): string[] {
	const metadata = [
		!input.completed && input.status ? `@s:${input.status}` : null,
		`@c:${input.createdDate}`,
		input.dueDate ? `@d:${input.dueDate}` : null,
		`@p:${input.priority}`,
		...input.tags.map((tag) => `#${normalizeTag(tag)}`)
	].filter((value): value is string => value !== null);
	const description = input.description.trim();

	return [
		`- [${input.completed ? "x" : " "}] ${input.title.trim()} ${metadata.join(" ")}`,
		...(description.length > 0 ? [`    ${description.replace(/\n/g, "\n    ")}`] : [])
	];
}

export function updateTaskLineStatus(line: string, status: string | null): string {
	const lineWithoutStatus = line.replace(STATUS_FIELD, "");

	return status === null
		? lineWithoutStatus
		: `${lineWithoutStatus.trimEnd()} @s:${status}`;
}

export function updateTaskLineCompleted(line: string, completed: boolean): string {
	const nextLine = line.replace(/^(\s*-\s+\[)( |x|X)(\]\s+)/, `$1${completed ? "x" : " "}$3`);

	return completed ? updateTaskLineStatus(nextLine, null) : nextLine;
}

export function updateTaskLineDueDate(line: string, dueDate: string | null): string {
	const lineWithoutDueDate = line.replace(DUE_DATE_FIELD, "");

	return dueDate === null
		? lineWithoutDueDate
		: `${lineWithoutDueDate.trimEnd()} @d:${dueDate}`;
}

export function updateTaskLinePriority(line: string, priority: number): string {
	const lineWithoutPriority = line.replace(PRIORITY_FIELD, "");

	return `${lineWithoutPriority.trimEnd()} @p:${priority}`;
}

export function updateTaskLineTags(line: string, tags: string[]): string {
	const normalizedTags = tags
		.map((tag) => normalizeTag(tag))
		.filter((tag) => tag.length > 0);
	const tagText = normalizedTags.map((tag) => `#${tag}`).join(" ");
	const lineWithoutTags = line.replace(TAG_WITH_LEADING_SPACE, "");

	return tagText.length === 0
		? lineWithoutTags
		: `${lineWithoutTags.trimEnd()} ${tagText}`;
}

function extractField(text: string, field: string): string | null {
	const match = text.match(new RegExp(`@${field}:([^\\s]+)`));
	return match?.[1] ?? null;
}

function stripDescriptionIndent(line: string): string {
	return line.replace(DESCRIPTION_INDENT, "").trimEnd();
}
