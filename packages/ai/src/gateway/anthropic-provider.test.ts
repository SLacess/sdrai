import { beforeEach, describe, expect, it, vi } from 'vitest';

const createMock = vi.fn();

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: createMock },
  })),
}));

const { AnthropicProvider } = await import('./anthropic-provider');

describe('AnthropicProvider', () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it('exposes its provider name as "anthropic"', () => {
    const provider = new AnthropicProvider('claude-sonnet-5', 'test-key');
    expect(provider.name).toBe('anthropic');
  });

  it('maps the SDK response into a ProviderRawResponse and joins text blocks', async () => {
    createMock.mockResolvedValue({
      model: 'claude-sonnet-5',
      content: [
        { type: 'text', text: 'Hello ' },
        { type: 'text', text: 'world' },
      ],
      usage: { input_tokens: 50, output_tokens: 10 },
    });

    const provider = new AnthropicProvider('claude-sonnet-5', 'test-key');
    const result = await provider.complete({
      systemPrompt: 'sys',
      userPrompt: 'usr',
      maxTokens: 100,
      temperature: 0.2,
    });

    expect(result).toEqual({ text: 'Hello world', model: 'claude-sonnet-5', tokensInput: 50, tokensOutput: 10 });
    expect(createMock).toHaveBeenCalledWith({
      model: 'claude-sonnet-5',
      max_tokens: 100,
      temperature: 0.2,
      system: 'sys',
      messages: [{ role: 'user', content: 'usr' }],
    });
  });

  it('ignores non-text content blocks (e.g. tool_use)', async () => {
    createMock.mockResolvedValue({
      model: 'claude-sonnet-5',
      content: [
        { type: 'tool_use', id: 'x', name: 'y', input: {} },
        { type: 'text', text: 'only this' },
      ],
      usage: { input_tokens: 1, output_tokens: 1 },
    });

    const provider = new AnthropicProvider('claude-sonnet-5', 'test-key');
    const result = await provider.complete({ systemPrompt: 's', userPrompt: 'u', maxTokens: 10, temperature: 0 });
    expect(result.text).toBe('only this');
  });
});
