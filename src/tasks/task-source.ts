import { App, Notice, TFile } from "obsidian";
import type { TaskItem } from "../model/task";

type TaskLineUpdater = (line: string) => string;

export async function modifyTaskLine(
	app: App,
	task: TaskItem,
	updateLine: TaskLineUpdater
): Promise<void> {
	const source = await readTaskSource(app, task);

	if (!source) {
		return;
	}

	source.lines[source.lineIndex] = updateLine(source.line);
	await app.vault.modify(source.file, source.lines.join("\n"));
}

export async function replaceTaskBlock(
	app: App,
	task: TaskItem,
	nextTaskLines: string[]
): Promise<void> {
	const source = await readTaskSource(app, task);

	if (!source) {
		return;
	}

	let deleteCount = 1;

	while (
		source.lines[source.lineIndex + deleteCount] !== undefined &&
		/^\s{2,}\S/.test(source.lines[source.lineIndex + deleteCount] ?? "")
	) {
		deleteCount++;
	}

	source.lines.splice(source.lineIndex, deleteCount, ...nextTaskLines);
	await app.vault.modify(source.file, source.lines.join("\n"));
}

async function readTaskSource(
	app: App,
	task: TaskItem
): Promise<{
	file: TFile;
	lines: string[];
	line: string;
	lineIndex: number;
} | null> {
	const file = app.vault.getAbstractFileByPath(task.filePath);

	if (!(file instanceof TFile)) {
		new Notice("Could not find task file");
		return null;
	}

	const content = await app.vault.read(file);
	const lines = content.split(/\r?\n/);
	const lineIndex = task.line - 1;
	const line = lines[lineIndex];

	if (line === undefined) {
		new Notice("Could not find task line");
		return null;
	}

	return {
		file,
		lines,
		line,
		lineIndex
	};
}
