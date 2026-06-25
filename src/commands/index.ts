import { Notice } from "obsidian";
import type TaskAggregatorPlugin from "../main";

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
		id: "create-task-file",
		name: "Create task file",
		callback: async () => {
			await plugin.createTaskFileTemplate();
		}
	});
}
