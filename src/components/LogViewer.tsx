import React from 'react';
import { AgentLog } from '../types/orchestrator';
import { ScrollArea } from './ui/scroll-area';

interface LogViewerProps {
  logs: AgentLog[];
}

export const LogViewer: React.FC<LogViewerProps> = ({ logs }) => {
  return (
    <ScrollArea className="h-[300px] w-full rounded-md border bg-slate-950 p-4 font-mono text-xs text-slate-200">
      {logs.length === 0 && (
        <div className="text-slate-500 italic">No logs yet...</div>
      )}
      {logs.map((log, index) => (
        <div key={index} className="mb-1 flex gap-2">
          <span className="text-slate-500">
            [{new Date(log.timestamp).toLocaleTimeString()}]
          </span>
          <span className={
            log.level === 'error' ? 'text-red-400' :
            log.level === 'warn' ? 'text-yellow-400' :
            log.level === 'debug' ? 'text-blue-400' :
            'text-green-400'
          }>
            {log.level.toUpperCase()}
          </span>
          <span>{log.message}</span>
        </div>
      ))}
    </ScrollArea>
  );
};
