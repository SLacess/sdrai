import { describe, expect, it } from 'vitest';
import { parseEvalDataset } from './dataset';

describe('parseEvalDataset', () => {
  it('parses one case per non-empty line', () => {
    const jsonl = [
      '{"id":"EVAL-001","agent":"reply_classifier","category":"intent","input":{"a":1},"expected":{"intent":"OPT_OUT"},"critical":true}',
      '',
      '{"id":"EVAL-002","agent":"policy_engine","category":"decision","input":{},"expected":{"outcome":"ALLOW"},"critical":false}',
    ].join('\n');

    const cases = parseEvalDataset(jsonl);
    expect(cases).toHaveLength(2);
    expect(cases[0]).toEqual({
      id: 'EVAL-001',
      agent: 'reply_classifier',
      category: 'intent',
      input: { a: 1 },
      expected: { intent: 'OPT_OUT' },
      critical: true,
    });
  });

  it('ignores blank lines', () => {
    const jsonl = '\n\n{"id":"EVAL-001","agent":"a","category":"c","input":{},"expected":{},"critical":false}\n\n';
    expect(parseEvalDataset(jsonl)).toHaveLength(1);
  });

  it('throws with the line number for invalid JSON', () => {
    const jsonl = '{"id":"EVAL-001","agent":"a","category":"c","input":{},"expected":{},"critical":false}\nnot json';
    expect(() => parseEvalDataset(jsonl)).toThrow('line 2');
  });

  it('throws when a line is missing a required field', () => {
    const jsonl = '{"id":"EVAL-001","agent":"a"}';
    expect(() => parseEvalDataset(jsonl)).toThrow('line 1');
  });
});
