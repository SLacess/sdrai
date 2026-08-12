import Anthropic from '@anthropic-ai/sdk';
import type { AIProvider, ProviderCompleteRequest, ProviderRawResponse } from './types';

export class AnthropicProvider implements AIProvider {
  readonly name = 'anthropic';
  private readonly client: Anthropic;

  constructor(
    private readonly model: string,
    apiKey: string,
  ) {
    this.client = new Anthropic({ apiKey });
  }

  async complete(request: ProviderCompleteRequest): Promise<ProviderRawResponse> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: request.maxTokens,
      temperature: request.temperature,
      system: request.systemPrompt,
      messages: [{ role: 'user', content: request.userPrompt }],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    return {
      text,
      model: response.model,
      tokensInput: response.usage.input_tokens,
      tokensOutput: response.usage.output_tokens,
    };
  }
}
