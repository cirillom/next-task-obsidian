import { App, MarkdownView, TFile } from "obsidian";
import { normalizeTag, TagGraph } from "../model/tag-graph";
import { parseTaskConfig } from "../parser/config-parser";
import { validateScoreScript } from "../scoring/score";
import taskConfigTemplate from "../templates/Tasks-Config.md";

export const CONFIG_FILE_PATH = "Tasks-Config.md";

export type ConfigLoadResult = {
	tagGraph: TagGraph;
	scoreScript: string | null;
	scoreError: string | null;
	status: "loaded" | "missing" | "error";
	error: string | null;
};

export class ConfigService {
	constructor(private readonly app: App) {}

	async loadConfig(): Promise<ConfigLoadResult> {
		const configFile = this.app.vault.getAbstractFileByPath(CONFIG_FILE_PATH);

		if (!(configFile instanceof TFile)) {
			return {
				tagGraph: new TagGraph(),
				scoreScript: null,
				scoreError: null,
				status: "missing",
				error: null
			};
		}

		try {
			const content = await this.app.vault.read(configFile);
			const config = parseTaskConfig(content);

			return {
				tagGraph: config.tagGraph,
				scoreScript: config.scoreScript,
				scoreError: config.scoreScript ? validateScoreScript(config.scoreScript) : null,
				status: "loaded",
				error: null
			};
		} catch (error) {
			console.error("Task Aggregator failed to load Tasks-Config.md", error);

			return {
				tagGraph: new TagGraph(),
				scoreScript: null,
				scoreError: null,
				status: "error",
				error: error instanceof Error ? error.message : "Unknown error"
			};
		}
	}

	async openTaskConfig(): Promise<void> {
		const file = await this.ensureTaskConfig();
		const leaf = this.app.workspace.getLeaf(false);
		await leaf.openFile(file, { active: true });

		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		view?.editor.setCursor({ line: 0, ch: 0 });
	}

	async createConfigTemplate(): Promise<"created" | "exists"> {
		const existingConfig = this.app.vault.getAbstractFileByPath(CONFIG_FILE_PATH);

		if (existingConfig) {
			return "exists";
		}

		await this.app.vault.create(CONFIG_FILE_PATH, taskConfigTemplate);
		return "created";
	}

	async addConfigTag(tag: string): Promise<string | null> {
		const normalizedTag = normalizeTag(tag).replace(/\s+/g, "-");

		if (normalizedTag.length === 0) {
			return null;
		}

		const configFile = this.app.vault.getAbstractFileByPath(CONFIG_FILE_PATH);
		const tagLine = `#${normalizedTag} |`;

		if (!(configFile instanceof TFile)) {
			await this.app.vault.create(CONFIG_FILE_PATH, `${tagLine}\n`);
			return normalizedTag;
		}

		const content = await this.app.vault.read(configFile);

		if (parseTaskConfig(content).tagGraph.getAllTags().includes(normalizedTag)) {
			return normalizedTag;
		}

		const nextContent = content.endsWith("\n")
			? `${content}${tagLine}\n`
			: `${content}\n${tagLine}\n`;

		await this.app.vault.modify(configFile, nextContent);

		return normalizedTag;
	}

	private async ensureTaskConfig(): Promise<TFile> {
		const existingFile = this.app.vault.getAbstractFileByPath(CONFIG_FILE_PATH);

		return existingFile instanceof TFile
			? existingFile
			: await this.app.vault.create(CONFIG_FILE_PATH, taskConfigTemplate);
	}
}
