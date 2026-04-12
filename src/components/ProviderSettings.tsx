import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Settings, Save, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface Provider {
  id: string;
  name: string;
  enabled: boolean;
  configured: boolean;
  config: {
    api_key?: string;
    model?: string;
  };
}

export const ProviderSettings = () => {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ api_key: '', model: '' });
  const [isSaving, setIsSaving] = useState(false);

  const fetchProviders = async () => {
    try {
      const res = await fetch('/api/v1/providers');
      if (res.ok) {
        const data = await res.json();
        setProviders(data);
        if (!selectedProviderId && data.length > 0) {
          setSelectedProviderId(data[0].id);
          setFormData({
            api_key: data[0].config?.api_key || '',
            model: data[0].config?.model || ''
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch providers:', error);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchProviders();
    }
  }, [isOpen]);

  const handleProviderSelect = (provider: Provider) => {
    setSelectedProviderId(provider.id);
    setFormData({
      api_key: provider.config?.api_key || '',
      model: provider.config?.model || ''
    });
  };

  const handleSave = async () => {
    if (!selectedProviderId) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/v1/providers/${selectedProviderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: {
            api_key: formData.api_key,
            model: formData.model
          }
        })
      });
      if (res.ok) {
        toast.success('Provider settings saved');
        fetchProviders();
      } else {
        toast.error('Failed to save settings');
      }
    } catch (error) {
      toast.error('An error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const selectedProvider = providers.find(p => p.id === selectedProviderId);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700" />}>
        <Settings className="mr-2 h-4 w-4" />
        Settings
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] bg-slate-900 border-slate-800 text-slate-200">
        <DialogHeader>
          <DialogTitle>Provider Configuration</DialogTitle>
        </DialogHeader>
        <div className="flex gap-4 mt-4 h-[300px]">
          {/* Sidebar */}
          <div className="w-1/3 border-r border-slate-800 pr-4 flex flex-col gap-2 overflow-y-auto">
            {providers.map(p => (
              <button
                key={p.id}
                onClick={() => handleProviderSelect(p)}
                className={`text-left px-3 py-2 rounded-md text-sm transition-colors ${
                  selectedProviderId === p.id 
                    ? 'bg-indigo-600 text-white' 
                    : 'hover:bg-slate-800 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>{p.name}</span>
                  {p.configured && <CheckCircle2 className="h-3 w-3 text-green-400" />}
                </div>
              </button>
            ))}
          </div>
          
          {/* Content */}
          <div className="w-2/3 pl-2 flex flex-col gap-4">
            {selectedProvider ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="api_key" className="text-slate-300">API Key</Label>
                  <Input
                    id="api_key"
                    type="password"
                    placeholder="Enter API key..."
                    value={formData.api_key}
                    onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                    className="bg-slate-950 border-slate-700 text-slate-200"
                  />
                  <p className="text-xs text-slate-500">
                    {selectedProvider.configured ? "API key is currently set." : "No API key configured."}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model" className="text-slate-300">Default Model</Label>
                  <Input
                    id="model"
                    placeholder="e.g., claude-3-opus-20240229"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    className="bg-slate-950 border-slate-700 text-slate-200"
                  />
                </div>
                <div className="mt-auto flex justify-end">
                  <Button 
                    onClick={handleSave} 
                    disabled={isSaving}
                    className="bg-indigo-600 hover:bg-indigo-700"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {isSaving ? 'Saving...' : 'Save Settings'}
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500 text-sm">
                Select a provider to configure
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
