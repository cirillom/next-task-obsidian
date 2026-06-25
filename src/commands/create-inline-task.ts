import type { Editor, EditorPosition } from "obsidian";
import { Notice } from "obsidian";
import type TaskAggregatorPlugin from "../main";
import { buildTaskMarkdownLines } from "../tasks/task-markdown";
import { openTaskForm } from "../ui/task-form-modal";
import { getTodayIsoDate } from "../utils/date";

export async function createInlineTask(
	plugin: TaskAggregatorPlugin,
	editor: Editor
): Promise<void> {
	const cursor = editor.getCursor();

	await openTaskForm(plugin, async (input) => {
		const title = input.title.trim();

		if (title.length === 0) {
			new Notice("Task title is required");
			return false;
		}

		const taskText = buildTaskMarkdownLines({
			...input,
			title,
			completed: false,
			createdDate: getTodayIsoDate()
		}).join("\n");

		editor.replaceRange(taskText, cursor);
		editor.setCursor(getInsertionEnd(cursor, taskText));
		await plugin.refreshOpenViews();
		return true;
	});
}

function getInsertionEnd(cursor: EditorPosition, text: string): EditorPosition {
	const lines = text.split("\n");

	if (lines.length === 1) {
		return {
			line: cursor.line,
			ch: cursor.ch + text.length
		};
	}

	return {
		line: cursor.line + lines.length - 1,
		ch: lines[lines.length - 1]?.length ?? 0
	};
}
