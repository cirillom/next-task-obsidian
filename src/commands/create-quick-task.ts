import type TaskAggregatorPlugin from "../main";
import { openTaskForm } from "../ui/task-form-modal";

export async function createQuickTask(plugin: TaskAggregatorPlugin): Promise<void> {
	await openTaskForm(plugin, async (input) => {
		await plugin.createTask(input);
		await plugin.refreshOpenViews();
		return true;
	});
}
