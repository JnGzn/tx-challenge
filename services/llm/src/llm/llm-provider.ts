export const LLM_PROVIDER = Symbol('ILLMProvider');

export interface CompletionRequest {
  system: string;
  user: string;
  temperature?: number;
}

export interface CompletionResult {
  text: string;
  model: string;
  raw: Record<string, unknown>;
}

export interface ILLMProvider {
  complete(request: CompletionRequest): Promise<CompletionResult>;
}
