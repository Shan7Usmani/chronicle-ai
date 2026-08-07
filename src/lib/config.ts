import { z } from "zod";

const envSchema = z.object({
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  LLM_PROVIDER: z.enum(["gemini", "groq", "simulation"]).default("simulation"),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().default("llama-3.3-70b-versatile"),
  AGENT_SECRET: z.string().default("chronicle-dev-secret"),
  BASE_URL: z.string().url().optional(),
  MAX_POSTS_PER_TICK: z.coerce.number().int().min(1).max(5).default(2),
  PUBLISH_FIRST_SLOT_MIN: z.coerce.number().min(0).max(120).default(15),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid environment: ${parsed.error.message}`);
}

export const env = parsed.data;

export function isLlmConfigured(): boolean {
  if (env.LLM_PROVIDER === "gemini") return Boolean(env.GEMINI_API_KEY);
  if (env.LLM_PROVIDER === "groq") return Boolean(env.GROQ_API_KEY);
  return false;
}
