export const CONFIG_FILE_PATH = "Tasks-Config.md";
export const TASKS_FILE_PATH = "Tasks.md";

export const EDITABLE_STATUSES = ["doing", "blocked"] as const;
export const STATUS_ORDER = ["todo", ...EDITABLE_STATUSES, "done"];
