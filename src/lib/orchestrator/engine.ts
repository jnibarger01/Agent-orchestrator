import { AgentLog, AgentTask, IProvider } from "../../types/orchestrator";
import { GenericAgentProvider } from "../providers/genericProvider";

export class OrchestratorEngine {
  private providers: Map<string, IProvider> = new Map();

  constructor() {
    this.registerProvider(new GenericAgentProvider("codex"));
    this.registerProvider(new GenericAgentProvider("openclaw"));
    this.registerProvider(new GenericAgentProvider("hermes"));
    this.registerProvider(new GenericAgentProvider("claude-code"));
  }

  registerProvider(provider: IProvider) {
    this.providers.set(provider.name, provider);
  }

  getProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  async runTask(
    task: AgentTask,
    onUpdate: (updatedTask: AgentTask) => void
  ): Promise<void> {
    const provider = this.providers.get(task.provider);
    if (!provider) {
      task.status = 'failed';
      task.logs.push({
        timestamp: Date.now(),
        level: 'error',
        message: `Provider ${task.provider} not found.`
      });
      onUpdate({ ...task });
      return;
    }

    task.status = 'running';
    onUpdate({ ...task });

    try {
      const result = await provider.execute(task.prompt, (log) => {
        task.logs.push(log);
        onUpdate({ ...task });
      });

      task.status = 'completed';
      task.result = result;
      onUpdate({ ...task });
    } catch (error) {
      task.status = 'failed';
      onUpdate({ ...task });
    }
  }
}
