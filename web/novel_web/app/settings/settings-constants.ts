import type {
  AIProviderType,
} from "../api";

export const aiProviderDefaultPage = 1;
export const aiProviderPageSize = 20;
export const aiProviderTypeOptions: { value: AIProviderType; label: string }[] = [
  { value: "openai", label: "OpenAI" },
  { value: "claude", label: "Claude" },
];
export const agentReasoningEffortOptions: { value: string; label: string }[] = [
  { value: "", label: "默认 high" },
  { value: "low", label: "low" },
  { value: "medium", label: "medium" },
  { value: "high", label: "high" },
];
