import { Notice } from "obsidian";
import type TaskAggregatorPlugin from "../main";
import { createFileTask } from "./create-file-task";
import { createInlineTask } from "./create-inline-task";
import { createQuickTask } from "./create-quick-task";

export function registerCommands(plugin: TaskAggregatorPlugin): void {
	plugin.addRibbonIcon("list-todo", "Open next task", async () => {
		await plugin.activateView();
	});

	plugin.addCommand({
		id: "open",
		name: "Open",
		callback: async () => {
			await plugin.activateView();
		}
	});

	plugin.addCommand({
		id: "refresh",
		name: "Refresh",
		callback: async () => {
			await plugin.refreshOpenViews();
			new Notice("Next task refreshed");
		}
	});

	plugin.addCommand({
		id: "create-config-template",
		name: "Create config template",
		callback: async () => {
			await plugin.createConfigTemplate();
		}
	});

	plugin.addCommand({
		id: "create-inline-task",
		name: "Inline task",
		editorCallback: (editor) => {
			void createInlineTask(plugin, editor);
		}
	});

	plugin.addCommand({
		id: "create-task-file",
		name: "File task",
		callback: async () => {
			await createFileTask(plugin);
		}
	});

	plugin.addCommand({
		id: "create-quick-task",
		name: "Quick task",
		callback: async () => {
			await createQuickTask(plugin);
		}
	});
}
