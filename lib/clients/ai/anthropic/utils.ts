/* eslint-disable sonarjs/no-nested-template-literals */
import { AI_PROMPT, Client, HUMAN_PROMPT } from '@anthropic-ai/sdk';
import { BaseUtils } from '@voiceflow/base-types';
import { AIModelParams } from '@voiceflow/base-types/build/cjs/utils/ai';

import log from '@/logger';
import { Config } from '@/types';

import { AIModel } from '../types';

export abstract class AnthropicAIModel extends AIModel {
  protected client: Client;

  protected abstract anthropicModel: string;

  protected maxTokens = 128;

  constructor(config: Partial<Config>) {
    super();

    if (!config.ANTHROPIC_API_KEY) {
      throw new Error(`Anthropic client not initialized`);
    }

    this.client = new Client(config.ANTHROPIC_API_KEY);
  }

  static RoleMap = {
    [BaseUtils.ai.Role.SYSTEM]: HUMAN_PROMPT,
    [BaseUtils.ai.Role.USER]: HUMAN_PROMPT,
    [BaseUtils.ai.Role.ASSISTANT]: AI_PROMPT,
  };

  generateCompletion(prompt: string, params: AIModelParams): Promise<string | null> {
    const messages: BaseUtils.ai.Message[] = [{ role: BaseUtils.ai.Role.USER, content: prompt }];
    if (params.system) messages.unshift({ role: BaseUtils.ai.Role.SYSTEM, content: params.system });

    return this.generateChatCompletion(messages, params);
  }

  async generateChatCompletion(messages: BaseUtils.ai.Message[], params: AIModelParams): Promise<string | null> {
    let topSystem = '';
    if (messages[0]?.role === BaseUtils.ai.Role.SYSTEM) {
      topSystem = messages.shift()!.content;
    }

    const prompt = `${topSystem}\n\n${messages.map(
      (message) => `${AnthropicAIModel.RoleMap[message.role]} ${message.content}`
    )}${AI_PROMPT}`;

    const result = await this.client
      .complete({
        prompt,
        model: this.anthropicModel,
        temperature: params.temperature,
        max_tokens_to_sample: params.maxTokens || this.maxTokens,
        stop_sequences: [HUMAN_PROMPT],
      })
      .catch((error) => {
        log.warn(`${this.modelRef} completion ${log.vars({ error, messages, params })})}`);
        return null;
      });

    return result?.completion ?? null;
  }
}