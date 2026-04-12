import { AgentLog, IProvider } from "../../types/orchestrator";

export class GenericAgentProvider implements IProvider {
  constructor(public name: string) {}

  async execute(prompt: string, onLog: (log: AgentLog) => void): Promise<string> {
    onLog({
      timestamp: Date.now(),
      level: "info",
      message: `Connecting to ${this.name} agent...`,
    });

    await new Promise(resolve => setTimeout(resolve, 800));

    onLog({
      timestamp: Date.now(),
      level: "debug",
      message: `${this.name}: Initializing local environment context...`,
    });

    await new Promise(resolve => setTimeout(resolve, 1200));

    onLog({
      timestamp: Date.now(),
      level: "info",
      message: `${this.name}: Executing task: ${prompt}`,
    });

    await new Promise(resolve => setTimeout(resolve, 1500));

    onLog({
      timestamp: Date.now(),
      level: "info",
      message: `${this.name} execution completed.`,
    });

    return `${this.name} response for: "${prompt}"\n\nTask orchestrated successfully.`;
  }
}
