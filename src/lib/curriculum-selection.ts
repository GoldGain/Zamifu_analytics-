export interface StrandSelectionNode {
  id: string;
  sub_strands?: Array<{ id: string }>;
}

export interface TopicSelectionNode {
  id: string;
  strand_id?: string;
  sub_strand_id?: string;
}

export function filterSubStrands<T extends StrandSelectionNode>(
  strands: T[],
  selectedStrandIds: Set<string>,
): Array<NonNullable<T['sub_strands']>[number]> {
  return strands
    .filter((strand) => selectedStrandIds.size === 0 || selectedStrandIds.has(strand.id))
    .flatMap((strand) => strand.sub_strands || []);
}

export function filterTopics<T extends TopicSelectionNode>(
  topics: T[],
  selectedStrandIds: Set<string>,
  selectedSubStrandIds: Set<string>,
): T[] {
  if (selectedSubStrandIds.size > 0) {
    return topics.filter((topic) => Boolean(topic.sub_strand_id && selectedSubStrandIds.has(topic.sub_strand_id)));
  }
  if (selectedStrandIds.size > 0) {
    return topics.filter((topic) => Boolean(topic.strand_id && selectedStrandIds.has(topic.strand_id)));
  }
  return topics;
}

export function retainVisibleIds(selectedIds: Set<string>, visibleIds: Iterable<string>): Set<string> {
  const visible = new Set(visibleIds);
  let unchanged = true;
  for (const id of selectedIds) {
    if (!visible.has(id)) {
      unchanged = false;
      break;
    }
  }
  return unchanged ? selectedIds : new Set([...selectedIds].filter((id) => visible.has(id)));
}
