import { parseCompanionStreamLine } from './companionStreamParse';

describe('parseCompanionStreamLine', () => {
  it('extracts text from Mastra text-delta payload.text events', () => {
    const line =
      'data: {"type":"text-delta","runId":"x","from":"AGENT","payload":{"id":"1","text":"Hello"}}';
    expect(parseCompanionStreamLine(line)).toBe('Hello');
  });

  it('ignores tool-call and start events', () => {
    expect(
      parseCompanionStreamLine(
        'data: {"type":"tool-call","payload":{"toolName":"listTodaysPanel"}}',
      ),
    ).toBe('');
    expect(
      parseCompanionStreamLine(
        'data: {"type":"start","payload":{"id":"doctor-practice-partner"}}',
      ),
    ).toBe('');
  });

  it('throws on error events', () => {
    expect(() =>
      parseCompanionStreamLine(
        'data: {"type":"error","message":"upstream failed"}',
      ),
    ).toThrow('upstream failed');
  });
});
