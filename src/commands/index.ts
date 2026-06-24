import { Notice } from "obsidian";
import type TaskAggregatorPlugin from "../main";
import taskConfigTemplate from "../templates/Tasks-Config.md";

export function registerCommands(plugin: TaskAggregatorPlugin): void {
	plugin.addRibbonIcon("list-todo", "Open task aggregator", async () => {
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
			new Notice("Task aggregator refreshed");
		}
	});

	plugin.addCommand({
		id: "create-config-template",
		name: "Create config template",
		callback: async () => {
			const existingConfig = plugin.app.vault.getAbstractFileByPath(plugin.configFilePath);

			if (existingConfig) {
				new Notice("Tasks-Config.md already exists");
				return;
			}

			await plugin.app.vault.create(plugin.configFilePath, taskConfigTemplate);
			new Notice("Tasks-Config.md created");
			await plugin.refreshOpenViews();
		}
	});
}
