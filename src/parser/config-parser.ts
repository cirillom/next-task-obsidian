import { TagGraph, normalizeTag } from "../model/tag-graph";

const PARENT_TAG = /#([\p{L}\p{N}_/-]+)/gu;
const SCORE_FORMULA = /^score\s*[:=]\s*(.+)$/i;
const SCORE_BLOCK_START = /^score\s*\{\s*$/i;
const SCORE_CODE_BLOCK_START = /^```(?:task-aggregator-score|js|javascript)\s*$/i;
const TAG_RELATION_SEPARATOR = "|";

export type TaskConfig = {
	tagGraph: TagGraph;
	scoreFormula: string | null;
};

export function parseTagGraphConfig(source: string): TagGraph {
	return parseTaskConfig(source).tagGraph;
}

export function parseTaskConfig(source: string): TaskConfig {
	const graph = new TagGraph();
	let scoreFormula: string | null = null;
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
			scoreFormula = scoreMatch[1]?.trim() ?? null;
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

			scoreFormula = scoreLines.join("\n");
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

			scoreFormula = scoreLines.join("\n");
			continue;
		}

		const [rawChild, rawParents] = trimmedLine.split(TAG_RELATION_SEPARATOR, 2);
		const child = normalizeTag(rawChild ?? "");

		if (child.length === 0 || rawParents === undefined) {
			continue;
		}

		graph.addTag(child);

		for (const match of rawParents.matchAll(PARENT_TAG)) {
			const parent = match[1];

			if (parent) {
				graph.addRelationship(child, parent);
			}
		}
	}

	return {
		tagGraph: graph,
		scoreFormula
	};
}
