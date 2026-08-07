export type EditorialRule = {
  id: string;
  description: string;
};

export type PersonaConfig = {
  name: string;
  domain: string;
  mission: string;
  interests: string[];
  editorialRules: EditorialRule[];
  voice: string;
  outputLength?: number;
};

export type SourceKind = "hn" | "lobsters" | "google-news" | "thn" | "custom";

export type SourceStory = {
  id: string;
  title: string;
  url: string;
  source: SourceKind;
  sourceName: string;
  summary: string;
  publishedAt: string;
  tags: string[];
  points?: number;
};

export type EditorialDecision = {
  score: number;
  accepted: boolean;
  reasons: string[];
  confidence: number;
};

export type RejectedTopic = {
  id: string;
  title: string;
  url: string;
  source: SourceKind;
  sourceName: string;
  score: number;
  reasons: string[];
  rejectedAt: string;
};

export type Post = {
  id: string;
  agentId: string;
  title: string;
  text: string;
  rationale: string;
  sources: string[];
  topicIds: string[];
  createdAt: string;
  editorialScore: number;
};

export type PublishSlot = {
  at: string;
  state: "pending" | "published";
  postId?: string;
};

export type AgentRecord = {
  id: string;
  persona: PersonaConfig;
  createdAt: string;
  schedule: PublishSlot[];
  lastRunAt: string | null;
  nextRunAt: string | null;
  totalRuns: number;
};

export type TickResult = {
  agentId: string;
  ranAt: string;
  discovered: number;
  evaluated: number;
  rejected: number;
  published: number;
  skippedDuplicate: number;
  publishedPostIds: string[];
  rejectionSample: RejectedTopic[];
};

export type AgentStatus = {
  agentId: string;
  persona: PersonaConfig;
  createdAt: string;
  status: "idle" | "initialized" | "active";
  publishedCount: number;
  rejectedCount: number;
  memorySize: number;
  lastRunAt: string | null;
  nextRunAt: string | null;
  totalRuns: number;
  schedule: PublishSlot[];
};
