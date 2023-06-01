import { BaseUtils } from '@voiceflow/base-types';

export abstract class AIModel {
  public abstract modelRef: BaseUtils.ai.GPT_MODEL;

  protected TIMEOUT = 20000;

  abstract generateCompletion(prompt: string, params: BaseUtils.ai.AIModelParams): Promise<string | null>;

  abstract generateChatCompletion(
    messages: BaseUtils.ai.Message[],
    params: BaseUtils.ai.AIModelParams
  ): Promise<string | null>;
}