import type TaskAggregatorPlugin from "../main";
import { openTaskForm } from "../ui/task-form-modal";

export async function createFileTask(plugin: TaskAggregatorPlugin): Promise<void> {
	await openTaskForm(plugin, async (input) => {
		return await plugin.createTaskFile(input);
	});
}
