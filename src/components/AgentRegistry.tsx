import React, { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Plus, Edit2, Trash2, Bot, CheckCircle2, XCircle, Wrench, FileJson } from 'lucide-react';
import { toast } from 'sonner';
import { AgentDefinition } from '../types/agent';

export const AgentRegistry = () => {
  const [agents, setAgents] = useState<AgentDefinition[]>([]);
  const [providers, setProviders] = useState<{ id: string; name: string }[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [selectedAgentDetails, setSelectedAgentDetails] = useState<AgentDefinition | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AgentDefinition | null>(null);
  const [formData, setFormData] = useState<Partial<AgentDefinition> & { tools?: any[], inputSchemaStr?: string, outputSchemaStr?: string }>({
    id: '',
    name: '',
    role: '',
    description: '',
    provider: '',
    model: '',
    enabled: true,
    tools: [],
    inputSchemaStr: '{\n  "type": "object",\n  "properties": {}\n}',
    outputSchemaStr: '{\n  "type": "object",\n  "properties": {}\n}'
  });
  const [isSaving, setIsSaving] = useState(false);
  const [toolValidationErrors, setToolValidationErrors] = useState<Record<number, string>>({});
  const [modalValidationErrors, setModalValidationErrors] = useState<{ input?: string, output?: string }>({});

  // Detail Panel State (for the selected agent)
  const [detailData, setDetailData] = useState<{ inputSchemaStr: string, outputSchemaStr: string, tools: any[] }>({
    inputSchemaStr: '',
    outputSchemaStr: '',
    tools: []
  });
  const [validationErrors, setValidationErrors] = useState<{ input?: string, output?: string }>({});
  const [detailToolValidationErrors, setDetailToolValidationErrors] = useState<Record<number, string>>({});

  useEffect(() => {
    const fetchAgentDetails = async () => {
      if (!selectedAgentId) {
        setSelectedAgentDetails(null);
        return;
      }
      setIsLoadingDetails(true);
      try {
        const res = await fetch(`/api/v1/agents/${selectedAgentId}`);
        if (res.ok) {
          const data = await res.json();
          setSelectedAgentDetails(data);
        } else {
          toast.error('Failed to fetch agent details');
          setSelectedAgentDetails(null);
        }
      } catch (error) {
        console.error('Failed to fetch agent details:', error);
        toast.error('Failed to fetch agent details');
        setSelectedAgentDetails(null);
      } finally {
        setIsLoadingDetails(false);
      }
    };

    fetchAgentDetails();
  }, [selectedAgentId]);

  useEffect(() => {
    if (selectedAgentDetails) {
      setDetailData({
        inputSchemaStr: JSON.stringify(selectedAgentDetails.inputSchema || { type: 'object', properties: {} }, null, 2),
        outputSchemaStr: JSON.stringify(selectedAgentDetails.outputSchema || { type: 'object', properties: {} }, null, 2),
        tools: (selectedAgentDetails.tools || []).map(t => ({
          ...t,
          parameters: typeof t.parameters === 'object' ? JSON.stringify(t.parameters, null, 2) : t.parameters
        }))
      });
      setValidationErrors({});
      setDetailToolValidationErrors({});
    }
  }, [selectedAgentDetails]);

  const fetchAgents = async () => {
    try {
      const res = await fetch('/api/v1/agents');
      if (res.ok) {
        const data = await res.json();
        setAgents(data);
      }
    } catch (error) {
      console.error('Failed to fetch agents:', error);
    }
  };

  const fetchProviders = async () => {
    try {
      const res = await fetch('/api/v1/providers');
      if (res.ok) {
        const data = await res.json();
        setProviders(data);
      }
    } catch (error) {
      console.error('Failed to fetch providers:', error);
    }
  };

  useEffect(() => {
    fetchAgents();
    fetchProviders();
  }, []);

  const handleOpenCreate = () => {
    setEditingAgent(null);
    setToolValidationErrors({});
    setModalValidationErrors({});
    setFormData({
      id: '',
      name: '',
      role: '',
      description: '',
      provider: providers[0]?.id || '',
      model: '',
      enabled: true,
      tools: [],
      inputSchemaStr: '{\n  "type": "object",\n  "properties": {}\n}',
      outputSchemaStr: '{\n  "type": "object",\n  "properties": {}\n}'
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (agent: AgentDefinition) => {
    setEditingAgent(agent);
    setToolValidationErrors({});
    setModalValidationErrors({});
    setFormData({
      id: agent.id,
      name: agent.name,
      role: agent.role,
      description: agent.description,
      provider: agent.provider,
      model: agent.model,
      enabled: agent.enabled,
      tools: (agent.tools || []).map(t => ({
        ...t,
        parameters: typeof t.parameters === 'object' ? JSON.stringify(t.parameters, null, 2) : t.parameters
      })),
      inputSchemaStr: Object.keys(agent.inputSchema || {}).length > 0 ? JSON.stringify(agent.inputSchema, null, 2) : '{\n  "type": "object",\n  "properties": {}\n}',
      outputSchemaStr: Object.keys(agent.outputSchema || {}).length > 0 ? JSON.stringify(agent.outputSchema, null, 2) : '{\n  "type": "object",\n  "properties": {}\n}'
    });
    setIsModalOpen(true);
  };

  const handleAddTool = () => {
    setFormData(prev => ({
      ...prev,
      tools: [...(prev.tools || []), { name: '', description: '', parameters: '{\n  "type": "object",\n  "properties": {}\n}' }]
    }));
  };

  const handleUpdateTool = (index: number, field: string, value: string) => {
    setFormData(prev => {
      const newTools = [...(prev.tools || [])];
      newTools[index] = { ...newTools[index], [field]: value };
      return { ...prev, tools: newTools };
    });
    if (field === 'parameters' && toolValidationErrors[index]) {
      setToolValidationErrors(prev => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
    }
  };

  const handleRemoveTool = (index: number) => {
    setFormData(prev => {
      const newTools = [...(prev.tools || [])];
      newTools.splice(index, 1);
      return { ...prev, tools: newTools };
    });
    setToolValidationErrors(prev => {
      const next = { ...prev };
      delete next[index];
      // Shift errors down
      const shifted: Record<number, string> = {};
      Object.entries(next).forEach(([key, val]) => {
        const k = parseInt(key);
        if (k > index) shifted[k - 1] = val as string;
        else shifted[k] = val as string;
      });
      return shifted;
    });
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/agents/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        toast.success('Agent deleted successfully');
        fetchAgents();
      } else {
        toast.error('Failed to delete agent');
      }
    } catch (error) {
      toast.error('An error occurred while deleting');
    }
  };

  const handleSave = async () => {
    if (!formData.id || !formData.name || !formData.role || !formData.provider) {
      toast.error('Please fill in all required fields');
      return;
    }

    let parsedTools = [];
    let parsedInputSchema = {};
    let parsedOutputSchema = {};
    
    const newToolErrors: Record<number, string> = {};
    let hasToolErrors = false;

    const inputErr = validateSchema(formData.inputSchemaStr);
    const outputErr = validateSchema(formData.outputSchemaStr);

    if (inputErr || outputErr) {
      setModalValidationErrors({ input: inputErr || undefined, output: outputErr || undefined });
    } else {
      setModalValidationErrors({});
    }

    try {
      parsedTools = (formData.tools || []).map((t, idx) => {
        const err = validateSchema(t.parameters);
        if (err) {
          newToolErrors[idx] = err;
          hasToolErrors = true;
        }
        return {
          ...t,
          parameters: typeof t.parameters === 'string' ? JSON.parse(t.parameters) : t.parameters
        };
      });

      if (hasToolErrors || inputErr || outputErr) {
        if (hasToolErrors) setToolValidationErrors(newToolErrors);
        toast.error('Please fix validation errors');
        return;
      }

      parsedInputSchema = JSON.parse(formData.inputSchemaStr || '{}');
      parsedOutputSchema = JSON.parse(formData.outputSchemaStr || '{}');
    } catch (e) {
      toast.error('Invalid JSON in tools or schemas');
      return;
    }

    const payload = {
      ...formData,
      tools: parsedTools,
      inputSchema: parsedInputSchema,
      outputSchema: parsedOutputSchema
    };
    delete payload.inputSchemaStr;
    delete payload.outputSchemaStr;

    setIsSaving(true);
    try {
      const url = editingAgent ? `/api/v1/agents/${editingAgent.id}` : '/api/v1/agents';
      const method = editingAgent ? 'PATCH' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        toast.success(`Agent ${editingAgent ? 'updated' : 'created'} successfully`);
        setIsModalOpen(false);
        fetchAgents();
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || 'Failed to save agent');
      }
    } catch (error) {
      toast.error('An error occurred while saving');
    } finally {
      setIsSaving(false);
    }
  };

  const validateSchema = (jsonStr: string): string | null => {
    try {
      const parsed = JSON.parse(jsonStr);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return 'Schema must be a JSON object';
      }
      if (!parsed.type) {
        return 'Schema must have a "type" property (e.g., "object")';
      }
      return null;
    } catch (e) {
      return 'Invalid JSON syntax';
    }
  };

  const handleSaveDetail = async () => {
    if (!selectedAgentDetails) return;
    
    const inputErr = validateSchema(detailData.inputSchemaStr);
    const outputErr = validateSchema(detailData.outputSchemaStr);

    let hasToolErrors = false;
    const newToolErrors: Record<number, string> = {};
    let parsedTools: any[] = [];

    try {
      parsedTools = detailData.tools.map((t, idx) => {
        const err = validateSchema(t.parameters);
        if (err) {
          newToolErrors[idx] = err;
          hasToolErrors = true;
        }
        return {
          ...t,
          parameters: typeof t.parameters === 'string' ? JSON.parse(t.parameters) : t.parameters
        };
      });
    } catch (e) {
      toast.error('Invalid JSON in tools');
      return;
    }

    if (inputErr || outputErr || hasToolErrors) {
      setValidationErrors({ input: inputErr || undefined, output: outputErr || undefined });
      setDetailToolValidationErrors(newToolErrors);
      toast.error('Please fix validation errors');
      return;
    }

    setValidationErrors({});
    setDetailToolValidationErrors({});
    
    try {
      const payload = {
        inputSchema: JSON.parse(detailData.inputSchemaStr),
        outputSchema: JSON.parse(detailData.outputSchemaStr),
        tools: parsedTools
      };

      setIsSaving(true);
      const res = await fetch(`/api/v1/agents/${selectedAgentDetails.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        toast.success('Agent schemas and tools updated');
        fetchAgents();
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || 'Failed to update agent');
      }
    } catch (e) {
      toast.error('An unexpected error occurred while parsing JSON');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddDetailTool = () => {
    setDetailData(prev => ({
      ...prev,
      tools: [...prev.tools, { name: '', description: '', parameters: '{\n  "type": "object",\n  "properties": {}\n}' }]
    }));
  };

  const handleUpdateDetailTool = (index: number, field: string, value: string) => {
    setDetailData(prev => {
      const newTools = [...prev.tools];
      newTools[index] = { ...newTools[index], [field]: value };
      return { ...prev, tools: newTools };
    });
    if (field === 'parameters' && detailToolValidationErrors[index]) {
      setDetailToolValidationErrors(prev => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
    }
  };

  const handleRemoveDetailTool = (index: number) => {
    setDetailData(prev => {
      const newTools = [...prev.tools];
      newTools.splice(index, 1);
      return { ...prev, tools: newTools };
    });
    setDetailToolValidationErrors(prev => {
      const next = { ...prev };
      delete next[index];
      const shifted: Record<number, string> = {};
      Object.entries(next).forEach(([key, val]) => {
        const k = parseInt(key);
        if (k > index) shifted[k - 1] = val as string;
        else shifted[k] = val as string;
      });
      return shifted;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-slate-100">Agent Registry</h2>
          <p className="text-sm text-slate-400">Manage available agents and their configurations.</p>
        </div>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger render={<Button onClick={handleOpenCreate} className="bg-indigo-600 hover:bg-indigo-700" />}>
            <Plus className="mr-2 h-4 w-4" />
            Add Agent
          </DialogTrigger>
          <DialogContent className="sm:max-w-[700px] bg-slate-900 border-slate-800 text-slate-200 max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingAgent ? 'Edit Agent' : 'Create Agent'}</DialogTitle>
            </DialogHeader>
            <Tabs defaultValue="general" className="w-full mt-2">
              <TabsList className="grid w-full grid-cols-3 bg-slate-800 border border-slate-700">
                <TabsTrigger value="general" className="data-[state=active]:bg-slate-700">General</TabsTrigger>
                <TabsTrigger value="tools" className="data-[state=active]:bg-slate-700">
                  <Wrench className="mr-2 h-4 w-4" />
                  Tools ({formData.tools?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="schemas" className="data-[state=active]:bg-slate-700">
                  <FileJson className="mr-2 h-4 w-4" />
                  I/O Schemas
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="general" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="id" className="text-slate-300">Agent ID *</Label>
                    <Input
                      id="id"
                      placeholder="e.g., code-reviewer"
                      value={formData.id}
                      onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                      disabled={!!editingAgent}
                      className="bg-slate-950 border-slate-700 text-slate-200"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-slate-300">Name *</Label>
                    <Input
                      id="name"
                      placeholder="e.g., Code Reviewer"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="bg-slate-950 border-slate-700 text-slate-200"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="provider" className="text-slate-300">Provider *</Label>
                    <Select 
                      value={formData.provider} 
                      onValueChange={(value) => setFormData({ ...formData, provider: value })}
                    >
                      <SelectTrigger className="bg-slate-950 border-slate-700 text-slate-200">
                        <SelectValue placeholder="Select a provider" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                        {providers.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="model" className="text-slate-300">Model Override</Label>
                    <Input
                      id="model"
                      placeholder="Leave empty for default"
                      value={formData.model}
                      onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                      className="bg-slate-950 border-slate-700 text-slate-200"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role" className="text-slate-300">System Role *</Label>
                  <Textarea
                    id="role"
                    placeholder="You are an expert..."
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="bg-slate-950 border-slate-700 text-slate-200 h-24"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description" className="text-slate-300">Description</Label>
                  <Input
                    id="description"
                    placeholder="Brief description of the agent's purpose"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="bg-slate-950 border-slate-700 text-slate-200"
                  />
                </div>
                
                <div className="flex items-center space-x-2 mt-2">
                  <input
                    type="checkbox"
                    id="enabled"
                    checked={formData.enabled}
                    onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                    className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500"
                  />
                  <Label htmlFor="enabled" className="text-slate-300">Agent Enabled</Label>
                </div>
              </TabsContent>

              <TabsContent value="tools" className="space-y-4 mt-4">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-slate-400">Define tools this agent can use.</p>
                  <Button onClick={handleAddTool} size="sm" variant="outline" className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Tool
                  </Button>
                </div>
                
                {formData.tools?.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 border border-dashed border-slate-800 rounded-lg">
                    No tools defined.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {formData.tools?.map((tool, index) => (
                      <div key={index} className="p-4 border border-slate-800 rounded-lg bg-slate-900/50 space-y-4">
                        <div className="flex justify-between items-start">
                          <h4 className="text-sm font-medium text-slate-300">Tool {index + 1}</h4>
                          <Button 
                            variant="ghost" 
                            size="icon-sm" 
                            onClick={() => handleRemoveTool(index)}
                            className="text-slate-500 hover:text-red-400 hover:bg-red-400/10 -mt-2 -mr-2"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-slate-400 text-xs">Tool Name</Label>
                            <Input 
                              placeholder="e.g., get_weather" 
                              value={tool.name}
                              onChange={(e) => handleUpdateTool(index, 'name', e.target.value)}
                              className="bg-slate-950 border-slate-700 text-slate-200 h-8 text-sm"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-slate-400 text-xs">Description</Label>
                            <Input 
                              placeholder="What does this tool do?" 
                              value={tool.description}
                              onChange={(e) => handleUpdateTool(index, 'description', e.target.value)}
                              className="bg-slate-950 border-slate-700 text-slate-200 h-8 text-sm"
                            />
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-slate-400 text-xs">Parameters (JSON Schema)</Label>
                            {toolValidationErrors[index] && (
                              <span className="text-[10px] font-medium text-red-400">
                                {toolValidationErrors[index]}
                              </span>
                            )}
                          </div>
                          <Textarea 
                            value={tool.parameters}
                            onChange={(e) => handleUpdateTool(index, 'parameters', e.target.value)}
                            className={`bg-slate-950 border-slate-700 text-slate-200 font-mono text-xs h-32 ${
                              toolValidationErrors[index] ? 'border-red-500/50 ring-1 ring-red-500/20' : ''
                            }`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="schemas" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-slate-300">Input Schema (JSON)</Label>
                    {modalValidationErrors.input && (
                      <span className="text-[10px] font-medium text-red-400 animate-in fade-in slide-in-from-right-1">
                        {modalValidationErrors.input}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">Define the structure of data this agent expects to receive.</p>
                  <Textarea 
                    value={formData.inputSchemaStr}
                    onChange={(e) => {
                      setFormData({ ...formData, inputSchemaStr: e.target.value });
                      if (modalValidationErrors.input) setModalValidationErrors(prev => ({ ...prev, input: undefined }));
                    }}
                    className={`bg-slate-950 border-slate-700 text-slate-200 font-mono text-xs h-40 ${
                      modalValidationErrors.input ? 'border-red-500/50 ring-1 ring-red-500/20' : ''
                    }`}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-slate-300">Output Schema (JSON)</Label>
                    {modalValidationErrors.output && (
                      <span className="text-[10px] font-medium text-red-400 animate-in fade-in slide-in-from-right-1">
                        {modalValidationErrors.output}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">Define the structure of data this agent must return.</p>
                  <Textarea 
                    value={formData.outputSchemaStr}
                    onChange={(e) => {
                      setFormData({ ...formData, outputSchemaStr: e.target.value });
                      if (modalValidationErrors.output) setModalValidationErrors(prev => ({ ...prev, output: undefined }));
                    }}
                    className={`bg-slate-950 border-slate-700 text-slate-200 font-mono text-xs h-40 ${
                      modalValidationErrors.output ? 'border-red-500/50 ring-1 ring-red-500/20' : ''
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
                {isSaving ? 'Saving...' : 'Save Agent'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className={`${selectedAgentId ? 'lg:col-span-7' : 'lg:col-span-12'} transition-all duration-300`}>
          <div className="rounded-md border border-slate-800 bg-slate-900/50 backdrop-blur-sm overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-800/50">
                <TableRow className="border-slate-800 hover:bg-transparent">
                  <TableHead className="text-slate-400">Agent</TableHead>
                  <TableHead className="text-slate-400">Provider</TableHead>
                  <TableHead className="text-slate-400">Status</TableHead>
                  <TableHead className="text-slate-400 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents.length === 0 ? (
                  <TableRow className="border-slate-800 hover:bg-slate-800/20">
                    <TableCell colSpan={4} className="text-center text-slate-500 py-8">
                      No agents found. Create one to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  agents.map((agent) => (
                    <TableRow 
                      key={agent.id} 
                      onClick={() => setSelectedAgentId(agent.id)}
                      className={`border-slate-800 cursor-pointer transition-colors ${
                        selectedAgentId === agent.id ? 'bg-indigo-500/10 hover:bg-indigo-500/20' : 'hover:bg-slate-800/20'
                      }`}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-400">
                            <Bot className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-medium text-slate-200">{agent.name}</div>
                            <div className="text-xs text-slate-500">{agent.id}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm text-slate-300">{providers.find(p => p.id === agent.provider)?.name || agent.provider}</span>
                          {agent.model && <span className="text-xs text-slate-500">{agent.model}</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        {agent.enabled ? (
                          <div className="flex items-center gap-1.5 text-xs text-green-400">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Active
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs text-slate-500">
                            <XCircle className="h-3.5 w-3.5" />
                            Disabled
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEdit(agent);
                            }}
                            className="text-slate-400 hover:text-indigo-400 hover:bg-indigo-400/10"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(agent.id);
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

        {selectedAgentId && (
          <div className="lg:col-span-5 animate-in fade-in slide-in-from-right-4 duration-300">
            <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-sm h-full flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
                    <Bot className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-semibold text-white">
                      {isLoadingDetails ? 'Loading...' : selectedAgentDetails?.name || 'Loading...'}
                    </CardTitle>
                    <p className="text-xs text-slate-500 font-mono">
                      {selectedAgentId}
                    </p>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon-sm" 
                  onClick={() => setSelectedAgentId(null)}
                  className="text-slate-500 hover:text-slate-300"
                >
                  <XCircle className="h-5 w-5" />
                </Button>
              </CardHeader>
              
              {isLoadingDetails ? (
                <CardContent className="flex-1 flex items-center justify-center p-6">
                  <div className="text-slate-500 text-sm flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    Fetching agent details...
                  </div>
                </CardContent>
              ) : selectedAgentDetails ? (
                <>
                  <CardContent className="flex-1 overflow-y-auto p-6">
                    <Tabs defaultValue="schemas" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 bg-slate-800 border border-slate-700 mb-4">
                    <TabsTrigger value="schemas" className="data-[state=active]:bg-slate-700">
                      <FileJson className="mr-2 h-4 w-4" />
                      I/O Schemas
                    </TabsTrigger>
                    <TabsTrigger value="tools" className="data-[state=active]:bg-slate-700">
                      <Wrench className="mr-2 h-4 w-4" />
                      Tools ({detailData.tools.length})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="schemas" className="space-y-6">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-slate-300 text-sm">Input Schema</Label>
                        {validationErrors.input && (
                          <span className="text-[10px] font-medium text-red-400 animate-in fade-in slide-in-from-right-1">
                            {validationErrors.input}
                          </span>
                        )}
                      </div>
                      <Textarea 
                        value={detailData.inputSchemaStr}
                        onChange={(e) => {
                          setDetailData({ ...detailData, inputSchemaStr: e.target.value });
                          if (validationErrors.input) setValidationErrors(prev => ({ ...prev, input: undefined }));
                        }}
                        className={`bg-slate-950 border-slate-700 text-slate-200 font-mono text-xs h-48 focus:ring-indigo-500 ${
                          validationErrors.input ? 'border-red-500/50 ring-1 ring-red-500/20' : ''
                        }`}
                        placeholder='{"type": "object", ...}'
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-slate-300 text-sm">Output Schema</Label>
                        {validationErrors.output && (
                          <span className="text-[10px] font-medium text-red-400 animate-in fade-in slide-in-from-right-1">
                            {validationErrors.output}
                          </span>
                        )}
                      </div>
                      <Textarea 
                        value={detailData.outputSchemaStr}
                        onChange={(e) => {
                          setDetailData({ ...detailData, outputSchemaStr: e.target.value });
                          if (validationErrors.output) setValidationErrors(prev => ({ ...prev, output: undefined }));
                        }}
                        className={`bg-slate-950 border-slate-700 text-slate-200 font-mono text-xs h-48 focus:ring-indigo-500 ${
                          validationErrors.output ? 'border-red-500/50 ring-1 ring-red-500/20' : ''
                        }`}
                        placeholder='{"type": "object", ...}'
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="tools" className="space-y-4 mt-0">
                    <div className="flex justify-between items-center">
                      <p className="text-sm text-slate-400">Define tools this agent can use.</p>
                      <Button onClick={handleAddDetailTool} size="sm" variant="outline" className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700">
                        <Plus className="mr-2 h-4 w-4" />
                        Add Tool
                      </Button>
                    </div>
                    
                    {detailData.tools.length === 0 ? (
                      <div className="text-center py-8 text-slate-500 border border-dashed border-slate-800 rounded-lg">
                        No tools defined.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {detailData.tools.map((tool, index) => (
                          <div key={index} className="p-4 border border-slate-800 rounded-lg bg-slate-900/50 space-y-4">
                            <div className="flex justify-between items-start">
                              <h4 className="text-sm font-medium text-slate-300">Tool {index + 1}</h4>
                              <Button 
                                variant="ghost" 
                                size="icon-sm" 
                                onClick={() => handleRemoveDetailTool(index)}
                                className="text-slate-500 hover:text-red-400 hover:bg-red-400/10 -mt-2 -mr-2"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label className="text-slate-400 text-xs">Tool Name</Label>
                                <Input 
                                  placeholder="e.g., get_weather" 
                                  value={tool.name}
                                  onChange={(e) => handleUpdateDetailTool(index, 'name', e.target.value)}
                                  className="bg-slate-950 border-slate-700 text-slate-200 h-8 text-sm"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-slate-400 text-xs">Description</Label>
                                <Input 
                                  placeholder="What does this tool do?" 
                                  value={tool.description}
                                  onChange={(e) => handleUpdateDetailTool(index, 'description', e.target.value)}
                                  className="bg-slate-950 border-slate-700 text-slate-200 h-8 text-sm"
                                />
                              </div>
                            </div>
                            
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Label className="text-slate-400 text-xs">Parameters (JSON Schema)</Label>
                                {detailToolValidationErrors[index] && (
                                  <span className="text-[10px] font-medium text-red-400">
                                    {detailToolValidationErrors[index]}
                                  </span>
                                )}
                              </div>
                              <Textarea 
                                value={tool.parameters}
                                onChange={(e) => handleUpdateDetailTool(index, 'parameters', e.target.value)}
                                className={`bg-slate-950 border-slate-700 text-slate-200 font-mono text-xs h-32 ${
                                  detailToolValidationErrors[index] ? 'border-red-500/50 ring-1 ring-red-500/20' : ''
                                }`}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
              <div className="p-4 border-t border-slate-800 bg-slate-900/80 flex justify-end gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => setSelectedAgentId(null)}
                  className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleSaveDetail} 
                  disabled={isSaving}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  {isSaving ? 'Saving...' : 'Save Schemas & Tools'}
                </Button>
              </div>
              </>
              ) : (
                <CardContent className="flex-1 flex items-center justify-center p-6">
                  <div className="text-slate-500 text-sm">Failed to load agent details.</div>
                </CardContent>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};
