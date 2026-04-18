import React, { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from './ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Plus, Edit2, Trash2, GitBranch, FileJson, Play, History, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { WorkflowDefinition, WorkflowRun } from '../types/workflow';

export function WorkflowManagement() {
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [selectedWorkflowDetails, setSelectedWorkflowDetails] = useState<WorkflowDefinition | null>(null);
  const [workflowRuns, setWorkflowRuns] = useState<WorkflowRun[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<WorkflowDefinition | null>(null);
  const [formData, setFormData] = useState<Partial<WorkflowDefinition> & { stepsStr?: string }>({
    id: '',
    name: '',
    version: '1.0.0',
    description: '',
    initialStep: '',
    stepsStr: '{\n  "start": {\n    "id": "start",\n    "type": "task",\n    "agentId": "agent-id",\n    "inputMapping": {},\n    "nextStep": "end"\n  }\n}'
  });

  const [isSaving, setIsSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{ steps?: string }>({});

  useEffect(() => {
    fetchWorkflows();
  }, []);

  useEffect(() => {
    if (selectedWorkflowId) {
      fetchWorkflowDetails(selectedWorkflowId);
    }
  }, [selectedWorkflowId]);

  const fetchWorkflows = async () => {
    try {
      const res = await fetch('/api/v1/workflows');
      if (res.ok) {
        const data = await res.json();
        setWorkflows(data);
      }
    } catch (error) {
      toast.error('Failed to fetch workflows');
    }
  };

  const fetchWorkflowDetails = async (id: string) => {
    setIsLoadingDetails(true);
    try {
      const [detailsRes, runsRes] = await Promise.all([
        fetch(`/api/v1/workflows/${id}`),
        fetch(`/api/v1/workflows/${id}/runs`)
      ]);
      
      if (detailsRes.ok) {
        const data = await detailsRes.json();
        setSelectedWorkflowDetails(data);
      } else {
        toast.error('Failed to fetch workflow details');
      }

      if (runsRes.ok) {
        const runsData = await runsRes.json();
        setWorkflowRuns(runsData);
      }
    } catch (error) {
      toast.error('An error occurred while fetching details');
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const validateJSON = (jsonStr: string): string | null => {
    try {
      const parsed = JSON.parse(jsonStr);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return 'Must be a JSON object';
      }
      return null;
    } catch (e) {
      return 'Invalid JSON syntax';
    }
  };

  const handleOpenCreate = () => {
    setEditingWorkflow(null);
    setValidationErrors({});
    setFormData({
      id: '',
      name: '',
      version: '1.0.0',
      description: '',
      initialStep: '',
      stepsStr: '{\n  "start": {\n    "id": "start",\n    "type": "task",\n    "agentId": "agent-id",\n    "inputMapping": {},\n    "nextStep": "end"\n  }\n}'
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (workflow: WorkflowDefinition) => {
    setEditingWorkflow(workflow);
    setValidationErrors({});
    setFormData({
      id: workflow.id,
      name: workflow.name,
      version: workflow.version,
      description: workflow.description,
      initialStep: workflow.initialStep,
      stepsStr: JSON.stringify(workflow.steps, null, 2)
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.id || !formData.name || !formData.version || !formData.initialStep) {
      toast.error('Please fill in all required fields');
      return;
    }

    const stepsErr = validateJSON(formData.stepsStr || '{}');
    if (stepsErr) {
      setValidationErrors({ steps: stepsErr });
      toast.error('Please fix validation errors');
      return;
    }

    let parsedSteps = {};
    try {
      parsedSteps = JSON.parse(formData.stepsStr || '{}');
    } catch (e) {
      toast.error('Invalid JSON in steps');
      return;
    }

    const payload = {
      ...formData,
      steps: parsedSteps
    };
    delete payload.stepsStr;

    setIsSaving(true);
    try {
      const url = editingWorkflow ? `/api/v1/workflows/${editingWorkflow.id}` : '/api/v1/workflows';
      const method = editingWorkflow ? 'PATCH' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        toast.success(editingWorkflow ? 'Workflow updated' : 'Workflow created');
        setIsModalOpen(false);
        fetchWorkflows();
        if (selectedWorkflowId === formData.id) {
          fetchWorkflowDetails(formData.id!);
        }
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || 'Failed to save workflow');
      }
    } catch (error) {
      toast.error('An error occurred while saving');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this workflow?')) return;
    
    try {
      const res = await fetch(`/api/v1/workflows/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Workflow deleted');
        if (selectedWorkflowId === id) setSelectedWorkflowId(null);
        fetchWorkflows();
      } else {
        toast.error('Failed to delete workflow');
      }
    } catch (error) {
      toast.error('An error occurred while deleting');
    }
  };

  const handleRunWorkflow = async (id: string) => {
    toast.info('Starting workflow run...');
    try {
      const res = await fetch('/api/v1/workflow-runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflowId: id, inputs: {} })
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(`Workflow run started: ${data.id}`);
        if (selectedWorkflowId) {
          fetchWorkflowDetails(selectedWorkflowId);
        }
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || 'Failed to start workflow run');
      }
    } catch (error) {
      toast.error('An error occurred while starting run');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-slate-100">Workflow Management</h2>
          <p className="text-sm text-slate-400">Design and manage multi-step agent workflows.</p>
        </div>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleOpenCreate} className="bg-indigo-600 hover:bg-indigo-700">
              <Plus className="mr-2 h-4 w-4" />
              Create Workflow
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[700px] bg-slate-900 border-slate-800 text-slate-200 max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingWorkflow ? 'Edit Workflow' : 'Create Workflow'}</DialogTitle>
            </DialogHeader>
            <Tabs defaultValue="general" className="w-full mt-2">
              <TabsList className="grid w-full grid-cols-2 bg-slate-800 border border-slate-700">
                <TabsTrigger value="general" className="data-[state=active]:bg-slate-700">General</TabsTrigger>
                <TabsTrigger value="steps" className="data-[state=active]:bg-slate-700">
                  <GitBranch className="mr-2 h-4 w-4" />
                  Steps (JSON)
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="general" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="id" className="text-slate-300">Workflow ID *</Label>
                    <Input
                      id="id"
                      placeholder="e.g., data-processing"
                      value={formData.id}
                      onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                      disabled={!!editingWorkflow}
                      className="bg-slate-950 border-slate-700 text-slate-200"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="version" className="text-slate-300">Version *</Label>
                    <Input
                      id="version"
                      placeholder="e.g., 1.0.0"
                      value={formData.version}
                      onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                      className="bg-slate-950 border-slate-700 text-slate-200"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-slate-300">Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Data Processing Pipeline"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="bg-slate-950 border-slate-700 text-slate-200"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description" className="text-slate-300">Description</Label>
                  <Input
                    id="description"
                    placeholder="What does this workflow do?"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="bg-slate-950 border-slate-700 text-slate-200"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="initialStep" className="text-slate-300">Initial Step ID *</Label>
                  <Input
                    id="initialStep"
                    placeholder="e.g., start"
                    value={formData.initialStep}
                    onChange={(e) => setFormData({ ...formData, initialStep: e.target.value })}
                    className="bg-slate-950 border-slate-700 text-slate-200"
                  />
                </div>
              </TabsContent>

              <TabsContent value="steps" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-slate-300">Steps Definition (JSON)</Label>
                    {validationErrors.steps && (
                      <span className="text-[10px] font-medium text-red-400">
                        {validationErrors.steps}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">Define the steps, transitions, and logic of the workflow.</p>
                  <Textarea 
                    value={formData.stepsStr}
                    onChange={(e) => {
                      setFormData({ ...formData, stepsStr: e.target.value });
                      if (validationErrors.steps) setValidationErrors({});
                    }}
                    className={`bg-slate-950 border-slate-700 text-slate-200 font-mono text-xs h-[400px] ${
                      validationErrors.steps ? 'border-red-500/50 ring-1 ring-red-500/20' : ''
                    }`}
                  />
                </div>
              </TabsContent>
            </Tabs>
            
            <DialogFooter className="mt-6">
              <Button variant="outline" onClick={() => setIsModalOpen(false)} className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700">
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700">
                {isSaving ? 'Saving...' : 'Save Workflow'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className={`${selectedWorkflowId ? 'lg:col-span-7' : 'lg:col-span-12'} transition-all duration-300`}>
          <div className="rounded-md border border-slate-800 bg-slate-900/50 backdrop-blur-sm overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-800/50">
                <TableRow className="border-slate-800 hover:bg-transparent">
                  <TableHead className="text-slate-400">Workflow</TableHead>
                  <TableHead className="text-slate-400">Version</TableHead>
                  <TableHead className="text-slate-400">Initial Step</TableHead>
                  <TableHead className="text-slate-400 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workflows.length === 0 ? (
                  <TableRow className="border-slate-800 hover:bg-slate-800/20">
                    <TableCell colSpan={4} className="text-center text-slate-500 py-8">
                      No workflows found. Create one to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  workflows.map((workflow) => (
                    <TableRow 
                      key={workflow.id} 
                      onClick={() => setSelectedWorkflowId(workflow.id)}
                      className={`border-slate-800 cursor-pointer transition-colors ${
                        selectedWorkflowId === workflow.id ? 'bg-indigo-500/10 hover:bg-indigo-500/20' : 'hover:bg-slate-800/20'
                      }`}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-400">
                            <GitBranch className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-medium text-slate-200">{workflow.name}</div>
                            <div className="text-xs text-slate-500">{workflow.id}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-mono bg-slate-800 px-2 py-1 rounded text-slate-400 border border-slate-700">
                          v{workflow.version}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-slate-400 font-mono">{workflow.initialStep}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRunWorkflow(workflow.id);
                            }}
                            className="text-slate-400 hover:text-green-400 hover:bg-green-400/10"
                            title="Run Workflow"
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEdit(workflow);
                            }}
                            className="text-slate-400 hover:text-indigo-400 hover:bg-indigo-400/10"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(workflow.id);
                            }}
                            className="text-slate-400 hover:text-red-400 hover:bg-red-400/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {selectedWorkflowId && (
          <div className="lg:col-span-5 animate-in fade-in slide-in-from-right-4 duration-300">
            <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-sm h-full flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
                    <GitBranch className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-semibold text-white">
                      {selectedWorkflowDetails?.name || 'Workflow Details'}
                    </CardTitle>
                    <div className="text-xs text-slate-500 font-mono">{selectedWorkflowId}</div>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setSelectedWorkflowId(null)}
                  className="text-slate-500 hover:text-slate-300"
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto pt-6 space-y-6">
                {isLoadingDetails ? (
                  <div className="flex flex-col items-center justify-center h-64 space-y-4">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent"></div>
                    <p className="text-sm text-slate-500">Fetching workflow details...</p>
                  </div>
                ) : selectedWorkflowDetails ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Version</span>
                        <div className="text-sm text-slate-300">v{selectedWorkflowDetails.version}</div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Initial Step</span>
                        <div className="text-sm text-slate-300 font-mono">{selectedWorkflowDetails.initialStep}</div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Description</span>
                      <div className="text-sm text-slate-300 italic">
                        {selectedWorkflowDetails.description || 'No description provided.'}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Steps Definition</span>
                        <span className="text-[10px] text-slate-600 font-mono">
                          {Object.keys(selectedWorkflowDetails.steps).length} STEPS
                        </span>
                      </div>
                      <div className="rounded-lg bg-slate-950 p-4 border border-slate-800">
                        <pre className="text-xs text-indigo-300 font-mono overflow-x-auto">
                          {JSON.stringify(selectedWorkflowDetails.steps, null, 2)}
                        </pre>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-800">
                      <Button 
                        onClick={() => handleRunWorkflow(selectedWorkflowDetails.id)}
                        className="w-full bg-indigo-600 hover:bg-indigo-700"
                      >
                        <Play className="mr-2 h-4 w-4" />
                        Execute Workflow
                      </Button>
                    </div>

                    <div className="pt-6 border-t border-slate-800">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                          <History className="h-4 w-4 text-slate-400" />
                          Recent Runs
                        </h3>
                        <span className="text-xs text-slate-500 font-mono">{workflowRuns.length} TOTAL</span>
                      </div>
                      
                      <div className="rounded-md border border-slate-800 overflow-hidden">
                        <Table>
                          <TableHeader className="bg-slate-800/50">
                            <TableRow className="border-slate-800 hover:bg-transparent">
                              <TableHead className="text-slate-400 text-xs">Run ID</TableHead>
                              <TableHead className="text-slate-400 text-xs">Status</TableHead>
                              <TableHead className="text-slate-400 text-xs">Start Time</TableHead>
                              <TableHead className="text-slate-400 text-xs text-right">Duration</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {workflowRuns.length === 0 ? (
                              <TableRow className="border-slate-800 hover:bg-slate-800/20">
                                <TableCell colSpan={4} className="text-center py-6 text-sm text-slate-500 italic">
                                  No runs recorded yet.
                                </TableCell>
                              </TableRow>
                            ) : (
                              workflowRuns.map(run => (
                                <TableRow key={run.id} className="border-slate-800 hover:bg-slate-800/20">
                                  <TableCell className="font-mono text-xs text-slate-400">
                                    {run.id.split('-')[0]}...
                                  </TableCell>
                                  <TableCell>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                      run.status === 'completed' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                                      run.status === 'failed' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                                      run.status === 'running' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                                      'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                                    }`}>
                                      {run.status.toUpperCase()}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-xs text-slate-400">
                                    {new Date(run.createdAt).toLocaleString()}
                                  </TableCell>
                                  <TableCell className="text-xs text-slate-400 text-right">
                                    {run.updatedAt > run.createdAt ? `${((run.updatedAt - run.createdAt) / 1000).toFixed(1)}s` : '-'}
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 text-slate-600 italic">
                    Select a workflow to view details.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
