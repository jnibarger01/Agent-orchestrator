import React from 'react';
import { AgentTask } from '../types/orchestrator';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { CheckCircle2, Circle, Clock, XCircle } from 'lucide-react';

interface TaskListProps {
  tasks: AgentTask[];
  onSelect: (task: AgentTask) => void;
  selectedTaskId?: string;
}

export const TaskList: React.FC<TaskListProps> = ({ tasks, onSelect, selectedTaskId }) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running': return <Clock className="h-4 w-4 text-blue-500 animate-spin" />;
      default: return <Circle className="h-4 w-4 text-slate-500" />;
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {tasks.length === 0 && (
        <div className="py-8 text-center text-slate-500">No tasks orchestrated yet.</div>
      )}
      {tasks.map((task) => (
        <Card
          key={task.id}
          className={`cursor-pointer border-slate-800 transition-all hover:border-slate-600 ${
            selectedTaskId === task.id ? 'bg-slate-800/80 ring-1 ring-indigo-500' : 'bg-slate-900/40'
          }`}
          onClick={() => onSelect(task)}
        >
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3 overflow-hidden">
              {getStatusIcon(task.status)}
              <div className="flex flex-col overflow-hidden">
                <span className="truncate font-medium text-slate-200">{task.prompt}</span>
                <span className="text-xs text-slate-500">
                  {new Date(task.createdAt).toLocaleString()} • {task.provider}
                </span>
              </div>
            </div>
            <Badge variant="outline" className="ml-2 border-slate-700 text-slate-400">
              {task.id}
            </Badge>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
