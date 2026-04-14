import { useState, useEffect, useMemo } from 'react';
import { AgentTask } from './types/orchestrator';
import { OrchestratorEngine } from './lib/orchestrator/engine';
import { TaskInput } from './components/TaskInput';
import { TaskList } from './components/TaskList';
import { LogViewer } from './components/LogViewer';
import { ProviderSettings } from './components/ProviderSettings';
import { AgentRegistry } from './components/AgentRegistry';
import { WorkflowManagement } from './components/WorkflowManagement';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Separator } from './components/ui/separator';
import { Toaster } from './components/ui/sonner';
import { toast } from 'sonner';
import { LayoutDashboard, ListTodo, Terminal, Settings, Cpu, Users, GitBranch } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | undefined>();
  const [isEngineReady, setIsEngineReady] = useState(false);

  const engine = useMemo(() => new OrchestratorEngine(), []);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const response = await fetch('/api/v1/tasks');
        if (response.ok) {
          const data = await response.json();
          // The list endpoint returns logs_count, we need full logs for selected task
          // For now, we'll just set the tasks and fetch full details when selected
          setTasks(data);
        }
      } catch (error) {
        console.error('Failed to fetch tasks:', error);
      }
    };

    fetchTasks();
    setIsEngineReady(true);
  }, []);

  useEffect(() => {
    if (selectedTaskId) {
      const fetchTaskDetails = async () => {
        try {
          const response = await fetch(`/api/v1/tasks/${selectedTaskId}`);
          if (response.ok) {
            const data = await response.json();
            setTasks(prev => prev.map(t => t.id === data.id ? data : t));
          }
        } catch (error) {
          console.error('Failed to fetch task details:', error);
        }
      };
      fetchTaskDetails();
    }
  }, [selectedTaskId]);

  const selectedTask = useMemo(() => 
    tasks.find(t => t.id === selectedTaskId), 
    [tasks, selectedTaskId]
  );

  const handleRunTask = async (prompt: string, provider: string) => {
    try {
      // 1. Create task on backend
      const createResponse = await fetch('/api/v1/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, provider }),
      });

      if (!createResponse.ok) throw new Error('Failed to create task on backend');
      
      const newTask = await createResponse.json();
      newTask.logs = []; // Initialize logs locally

      setTasks(prev => [newTask, ...prev]);
      setSelectedTaskId(newTask.id);
      toast.info(`Starting task: ${prompt}`);

      // 2. Run task locally and sync updates to backend
      await engine.runTask(newTask, async (updatedTask) => {
        setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
        
        // Sync to backend (throttled or on important changes)
        // For simplicity in Slice 2, we sync every update
        try {
          await fetch(`/api/v1/tasks/${updatedTask.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              status: updatedTask.status,
              logs: updatedTask.logs.slice(-1), // Only send the latest log to append
              result: updatedTask.result
            }),
          });
        } catch (error) {
          console.error('Failed to sync task update:', error);
        }
      });

      if (newTask.status === 'completed') {
        toast.success('Task completed successfully');
      } else if (newTask.status === 'failed') {
        toast.error('Task failed');
      }
    } catch (error) {
      console.error('Task execution error:', error);
      toast.error('Failed to start task');
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-slate-200 selection:bg-indigo-500/30">
      <Toaster position="top-right" theme="dark" />
      
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 shadow-lg shadow-indigo-500/20">
              <Cpu className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">ClawOrch</h1>
              <p className="text-xs text-slate-500 font-mono">LOCAL_AGENT_ORCHESTRATOR_V1.0</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <ProviderSettings />
            <div className="flex items-center gap-2 rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-400 border border-slate-700">
              <span className="h-2 w-2 rounded-full bg-green-500"></span>
              ENGINE_READY
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Tabs defaultValue="dashboard" className="w-full">
          <div className="mb-8 flex items-center justify-between">
            <TabsList className="bg-slate-900/50 border border-slate-800">
              <TabsTrigger value="dashboard" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-slate-400">
                <LayoutDashboard className="mr-2 h-4 w-4" />
                Dashboard
              </TabsTrigger>
              <TabsTrigger value="agents" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-slate-400">
                <Users className="mr-2 h-4 w-4" />
                Agent Registry
              </TabsTrigger>
              <TabsTrigger value="workflows" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-slate-400">
                <GitBranch className="mr-2 h-4 w-4" />
                Workflows
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="dashboard" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
              
              {/* Left Column: Controls & Task List */}
              <div className="lg:col-span-5 flex flex-col gap-6">
                <TaskInput 
                  onRun={handleRunTask} 
                  providers={engine.getProviders()} 
                  disabled={!isEngineReady}
                />

                <Card className="flex-1 border-slate-800 bg-slate-900/50 backdrop-blur-sm">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg font-medium text-slate-100 flex items-center gap-2">
                      <ListTodo className="h-5 w-5 text-indigo-400" />
                      Orchestration History
                    </CardTitle>
                    <span className="text-xs text-slate-500 font-mono">{tasks.length} TASKS</span>
                  </CardHeader>
                  <CardContent>
                    <TaskList 
                      tasks={tasks} 
                      onSelect={(t) => setSelectedTaskId(t.id)} 
                      selectedTaskId={selectedTaskId}
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Right Column: Details & Logs */}
              <div className="lg:col-span-7">
                <AnimatePresence mode="wait">
                  {selectedTask ? (
                    <motion.div
                      key={selectedTask.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-sm">
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-xl font-semibold text-white">
                              Task Details
                            </CardTitle>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-500 font-mono">ID: {selectedTask.id}</span>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-6">
                          <div>
                            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Prompt</h4>
                            <div className="rounded-lg bg-slate-800 p-4 font-mono text-sm text-slate-300 border border-slate-700">
                              {selectedTask.prompt}
                            </div>
                          </div>

                          <Tabs defaultValue="logs" className="w-full">
                            <TabsList className="grid w-full grid-cols-2 bg-slate-800 border border-slate-700">
                              <TabsTrigger value="logs" className="data-[state=active]:bg-slate-700">
                                <Terminal className="mr-2 h-4 w-4" />
                                Live Logs
                              </TabsTrigger>
                              <TabsTrigger value="result" className="data-[state=active]:bg-slate-700">
                                <LayoutDashboard className="mr-2 h-4 w-4" />
                                Result
                              </TabsTrigger>
                            </TabsList>
                            <TabsContent value="logs" className="mt-4">
                              <LogViewer logs={selectedTask.logs} />
                            </TabsContent>
                            <TabsContent value="result" className="mt-4">
                              <div className="rounded-lg bg-slate-950 p-6 border border-slate-800 min-h-[300px]">
                                {selectedTask.result ? (
                                  <div className="prose prose-invert max-w-none">
                                    <pre className="whitespace-pre-wrap font-sans text-slate-300">
                                      {selectedTask.result}
                                    </pre>
                                  </div>
                                ) : (
                                  <div className="flex h-[250px] items-center justify-center text-slate-600 italic">
                                    {selectedTask.status === 'running' ? 'Processing results...' : 'No results available yet.'}
                                  </div>
                                )}
                              </div>
                            </TabsContent>
                          </Tabs>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ) : (
                    <div className="flex h-full min-h-[400px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-800 bg-slate-900/20 p-12 text-center">
                      <div className="mb-4 rounded-full bg-slate-800 p-4">
                        <Cpu className="h-8 w-8 text-slate-600" />
                      </div>
                      <h3 className="text-lg font-medium text-slate-400">No Task Selected</h3>
                      <p className="mt-2 text-sm text-slate-600 max-w-xs mx-auto">
                        Select a task from the history or start a new orchestration to view details and logs.
                      </p>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="agents" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
            <AgentRegistry />
          </TabsContent>

          <TabsContent value="workflows" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
            <WorkflowManagement />
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="mt-12 border-t border-slate-800 py-8">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <p className="text-xs text-slate-600 font-mono">
            &copy; 2026 CLAWORCH ORCHESTRATOR • READY FOR OPENCLAW / CLAUDE_CODE / HERMES
          </p>
        </div>
      </footer>
    </div>
  );
}
