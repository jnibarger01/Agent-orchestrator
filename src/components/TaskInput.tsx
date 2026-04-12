import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Play, ChevronDown } from 'lucide-react';

interface TaskInputProps {
  onRun: (prompt: string, provider: string) => void;
  providers: string[];
  disabled?: boolean;
}

export const TaskInput: React.FC<TaskInputProps> = ({ onRun, providers, disabled }) => {
  const [prompt, setPrompt] = useState('');
  const [provider, setProvider] = useState(providers[0] || 'hermes');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim()) {
      onRun(prompt, provider);
      setPrompt('');
    }
  };

  return (
    <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-lg font-medium text-slate-100">New Task</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter task prompt (e.g., 'Analyze local repo structure')"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="flex-1 border-slate-700 bg-slate-800 text-slate-100 focus:ring-slate-500"
              disabled={disabled}
            />
            <div className="relative">
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="h-full rounded-md border border-slate-700 bg-slate-800 pl-3 pr-8 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-500 transition-colors cursor-pointer appearance-none"
                disabled={disabled}
              >
                {providers.map((p) => (
                  <option key={p} value={p}>
                    {p.toUpperCase()}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>
            <Button type="submit" disabled={disabled || !prompt.trim()} className="bg-indigo-600 hover:bg-indigo-700">
              <Play className="mr-2 h-4 w-4" />
              Run
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
