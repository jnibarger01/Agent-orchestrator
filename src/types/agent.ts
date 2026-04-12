export interface AgentDefinition {
  id: string;
  name: string;
  role: string;
  description: string;
  provider: string;
  model: string;
  tools: any[];
  permissions: string[];
  inputSchema: any;
  outputSchema: any;
  runtimeStatus: 'idle' | 'running' | 'error' | 'offline';
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}
