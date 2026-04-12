export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface AgentLog {
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
}

export interface AgentTask {
  id: string;
  prompt: string;
  provider: string;
  status: TaskStatus;
  logs: AgentLog[];
  result?: string;
  createdAt: number;
}

export interface IProvider {
  name: string;
  execute(prompt: string, onLog: (log: AgentLog) => void): Promise<string>;
}
