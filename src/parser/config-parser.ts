import { TagGraph, normalizeTag } from "../model/tag-graph";

const PARENT_TAG = /#([\p{L}\p{N}_/-]+)/gu;
const SCORE_FORMULA = /^score\s*[:=]\s*(.+)$/i;
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

	for (const line of lines) {
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
