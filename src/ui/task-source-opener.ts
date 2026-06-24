import { App, MarkdownView, Notice, TFile } from "obsidian";
import type { TaskItem } from "../model/task";

export async function openTaskSource(app: App, task: TaskItem): Promise<void> {
	const file = app.vault.getAbstractFileByPath(task.filePath);

	if (!(file instanceof TFile)) {
		new Notice("Could not find task file");
		return;
	}

	const leaf = app.workspace.getLeaf(false);
	await leaf.openFile(file, { active: true });

	const view = app.workspace.getActiveViewOfType(MarkdownView);
	view?.editor.setCursor({ line: Math.max(0, task.line - 1), ch: 0 });
}
