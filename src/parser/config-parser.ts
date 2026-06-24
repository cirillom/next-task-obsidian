import { TagGraph, normalizeTag } from "../model/tag-graph";

const PARENT_TAG = /#([\p{L}\p{N}_/-]+)/gu;

export function parseTagGraphConfig(source: string): TagGraph {
	const graph = new TagGraph();
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

		const [rawChild] = trimmedLine.split(/\s+/, 1);
		const child = normalizeTag(rawChild ?? "");

		if (child.length === 0) {
			continue;
		}

		for (const match of trimmedLine.matchAll(PARENT_TAG)) {
			const parent = match[1];

			if (parent) {
				graph.addRelationship(child, parent);
			}
		}
	}

	return graph;
}
