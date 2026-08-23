import assert from 'node:assert/strict';
import { filterSubStrands, filterTopics, retainVisibleIds } from '../src/lib/curriculum-selection';

const strands = [
  {
    id: 'science',
    sub_strands: [{ id: 'matter' }, { id: 'energy' }],
  },
  {
    id: 'living',
    sub_strands: [{ id: 'cells' }],
  },
];
const topics = [
  { id: 'states', topic_name: 'States of matter', strand_id: 'science', sub_strand_id: 'matter' },
  { id: 'heat', topic_name: 'Heat transfer', strand_id: 'science', sub_strand_id: 'energy' },
  { id: 'cells-topic', topic_name: 'Cell structure', strand_id: 'living', sub_strand_id: 'cells' },
];

assert.deepEqual(filterSubStrands(strands, new Set()), strands.flatMap((strand) => strand.sub_strands));
assert.deepEqual(filterSubStrands(strands, new Set(['science'])), [{ id: 'matter' }, { id: 'energy' }]);
assert.deepEqual(filterSubStrands(strands, new Set(['living'])), [{ id: 'cells' }]);

assert.deepEqual(filterTopics(topics, new Set(), new Set()).map((topic) => topic.id), ['states', 'heat', 'cells-topic']);
assert.deepEqual(filterTopics(topics, new Set(['science']), new Set()).map((topic) => topic.id), ['states', 'heat']);
assert.deepEqual(filterTopics(topics, new Set(['science', 'living']), new Set(['matter'])).map((topic) => topic.id), ['states']);
assert.deepEqual(filterTopics(topics, new Set(['science']), new Set(['cells'])).map((topic) => topic.id), []);
assert.deepEqual(filterTopics(topics, new Set(['science', 'living']), new Set(['cells'])).map((topic) => topic.id), ['cells-topic']);

const retained = retainVisibleIds(new Set(['matter', 'cells']), ['matter', 'energy']);
assert.deepEqual([...retained], ['matter']);
const unchanged = new Set(['matter']);
assert.equal(retainVisibleIds(unchanged, ['matter']), unchanged);

console.log('PASS: curriculum selection dependency behavior is deterministic.');
