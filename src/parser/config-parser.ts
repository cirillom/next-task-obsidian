import { TagGraph, normalizeTag } from "../model/tag-graph";
import {
	DEFAULT_STATUS_DEFINITIONS,
	normalizeStatus,
	type TaskStatusDefinition
} from "../model/task-status";

const PARENT_TAG = /#([\p{L}\p{N}_/-]+)/gu;
const SCORE_FORMULA = /^score\s*[:=]\s*(.+)$/i;
const SCORE_BLOCK_START = /^score\s*\{\s*$/i;
const SCORE_CODE_BLOCK_START = /^```(?:task-aggregator-score|js|javascript)\s*$/i;
const TAG_RELATION_SEPARATOR = "|";
const DEFAULT_STATUS_MARKERS = new Set(["default", "*", "true", "yes"]);
const HIDDEN_STATUS_MARKERS = new Set(["-", "hidden", "false", "no"]);

export type TaskConfig = {
	tagGraph: TagGraph;
	statusDefinitions: TaskStatusDefinition[];
	scoreScript: string | null;
};

export function parseTagGraphConfig(source: string): TagGraph {
	return parseTaskConfig(source).tagGraph;
}

export function parseTaskConfig(source: string): TaskConfig {
	const graph = new TagGraph();
	const statusDefinitions: TaskStatusDefinition[] = [];
	let scoreScript: string | null = null;
	const lines = source.split(/\r?\n/);

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i] ?? "";
		const trimmedLine = line.trim();

		if (
			trimmedLine.length === 0 ||
			trimmedLine.startsWith("# ") ||
			trimmedLine.startsWith("//")
		) {
			continue;
		}

		const scoreMatch = trimmedLine.match(SCORE_FORMULA);

		if (scoreMatch) {
			scoreScript = scoreMatch[1]?.trim() ?? null;
			continue;
		}

		if (SCORE_CODE_BLOCK_START.test(trimmedLine)) {
			const scoreLines: string[] = [];

			for (i = i + 1; i < lines.length; i++) {
				const scoreLine = lines[i] ?? "";

				if (scoreLine.trim().startsWith("```")) {
					break;
				}

				scoreLines.push(scoreLine);
			}

			scoreScript = scoreLines.join("\n");
			continue;
		}

		if (SCORE_BLOCK_START.test(trimmedLine)) {
			const scoreLines: string[] = [];
			let depth = 1;

			for (i = i + 1; i < lines.length; i++) {
				const scoreLine = lines[i] ?? "";
				const trimmedScoreLine = scoreLine.trim();
				depth += (scoreLine.match(/\{/g) ?? []).length;
				depth -= (scoreLine.match(/\}/g) ?? []).length;

				if (depth === 0 && trimmedScoreLine === "}") {
					break;
				}

				if (trimmedScoreLine.startsWith("```")) {
					continue;
				}

				scoreLines.push(scoreLine);
			}

			scoreScript = scoreLines.join("\n");
			continue;
		}

		const [rawItem, rawDetails] = trimmedLine.split(TAG_RELATION_SEPARATOR, 2);

		if (rawDetails === undefined) {
			continue;
		}

		if ((rawItem ?? "").trim().startsWith("#")) {
			const child = normalizeTag(rawItem ?? "");

			if (child.length === 0) {
				continue;
			}

			graph.addTag(child);

			for (const match of rawDetails.matchAll(PARENT_TAG)) {
				const parent = match[1];

				if (parent) {
					graph.addRelationship(child, parent);
				}
			}

			continue;
		}

		const statusDefinition = parseStatusDefinition(rawItem ?? "", rawDetails);

		if (statusDefinition) {
			statusDefinitions.push(statusDefinition);
		}
	}

	return {
		tagGraph: graph,
		statusDefinitions: statusDefinitions.length > 0 ? statusDefinitions : DEFAULT_STATUS_DEFINITIONS,
		scoreScript
	};
}

function parseStatusDefinition(
	rawStatus: string,
	rawDetails: string
): TaskStatusDefinition | null {
	const name = normalizeStatus(rawStatus);

	if (name.length === 0) {
		return null;
	}

	const [firstToken = "", secondToken = ""] = rawDetails.trim().split(/\s+/, 2);
	const firstNumber = Number(firstToken);

	if (Number.isFinite(firstNumber)) {
		return {
			name,
			defaultVisible: false,
			scoreValue: firstNumber
		};
	}

	const marker = firstToken.toLowerCase();
	const scoreValue = Number(secondToken);

	if (!Number.isFinite(scoreValue)) {
		return null;
	}

	return {
		name,
		defaultVisible: DEFAULT_STATUS_MARKERS.has(marker) && !HIDDEN_STATUS_MARKERS.has(marker),
		scoreValue
	};
}
