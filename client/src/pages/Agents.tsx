import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { Plus, Trash2, Edit2, Zap } from "lucide-react";
import { toast } from "sonner";

export default function Agents() {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    role: "",
    goal: "",
    backstory: "",
  });

  const agentsQuery = trpc.agents.list.useQuery();
  const createMutation = trpc.agents.create.useMutation();
  const updateMutation = trpc.agents.update.useMutation();
  const deleteMutation = trpc.agents.delete.useMutation();
  const utils = trpc.useUtils();

  const agents = agentsQuery.data || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.role || !formData.goal) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      if (editingId) {
        await updateMutation.mutateAsync({
          id: editingId,
          ...formData,
        });
        toast.success("Agent updated successfully");
      } else {
        await createMutation.mutateAsync({
          ...formData,
          tools: [],
        });
        toast.success("Agent created successfully");
      }

      await utils.agents.list.invalidate();
      setIsOpen(false);
      setEditingId(null);
      setFormData({ name: "", role: "", goal: "", backstory: "" });
    } catch (error) {
      toast.error("Failed to save agent");
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this agent?")) {
      try {
        await deleteMutation.mutateAsync({ id });
        await utils.agents.list.invalidate();
        toast.success("Agent deleted successfully");
      } catch (error) {
        toast.error("Failed to delete agent");
      }
    }
  };

  const handleEdit = (agent: any) => {
    setEditingId(agent.id);
    setFormData({
      name: agent.name,
      role: agent.role,
      goal: agent.goal,
      backstory: agent.backstory || "",
    });
    setIsOpen(true);
  };

  const handleOpenDialog = () => {
    setEditingId(null);
    setFormData({ name: "", role: "", goal: "", backstory: "" });
    setIsOpen(true);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Agents</h1>
          <p className="text-muted-foreground mt-2">
            Create and manage your AI agents. Each agent has a specific role and goal.
          </p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleOpenDialog} className="gap-2">
              <Plus className="w-4 h-4" />
              New Agent
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Agent" : "Create New Agent"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Agent Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Research Analyst"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role *</Label>
                <Input
                  id="role"
                  placeholder="e.g., Senior Research Analyst"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="goal">Goal *</Label>
                <Textarea
                  id="goal"
                  placeholder="What is this agent's primary objective?"
                  value={formData.goal}
                  onChange={(e) => setFormData({ ...formData, goal: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="backstory">Backstory</Label>
                <Textarea
                  id="backstory"
                  placeholder="Describe the agent's background and personality..."
                  value={formData.backstory}
                  onChange={(e) => setFormData({ ...formData, backstory: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingId ? "Update" : "Create"} Agent
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Agents Grid */}
      {agentsQuery.isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-6">
              <Skeleton className="h-6 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2 mb-4" />
              <Skeleton className="h-20 w-full mb-4" />
              <Skeleton className="h-10 w-full" />
            </Card>
          ))}
        </div>
      ) : agents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {agents.map((agent) => (
            <Card key={agent.id} className="p-6 card-elevated hover:shadow-elevated transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg text-foreground">{agent.name}</h3>
                  <p className="text-sm text-muted-foreground">{agent.role}</p>
                </div>
                <Badge variant={agent.isActive ? "default" : "secondary"}>
                  {agent.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>

              <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{agent.goal}</p>

              {agent.backstory && (
                <p className="text-xs text-muted-foreground mb-4 line-clamp-2">{agent.backstory}</p>
              )}

              {agent.tools && (() => {
                const toolsArray = typeof agent.tools === 'string' ? JSON.parse(agent.tools) : agent.tools;
                return Array.isArray(toolsArray) && toolsArray.length > 0 ? (
                  <div className="mb-4">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Tools:</p>
                    <div className="flex flex-wrap gap-1">
                      {toolsArray.map((tool: string) => (
                        <Badge key={tool} variant="outline" className="text-xs">
                          {tool}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}

              <div className="flex gap-2 pt-4 border-t border-border">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={() => handleEdit(agent)}
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 gap-2 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(agent.id)}
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center card-subtle">
          <Zap className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">No agents yet. Create your first agent to get started.</p>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleOpenDialog}>Create Your First Agent</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Agent</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Agent Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Research Analyst"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Role *</Label>
                  <Input
                    id="role"
                    placeholder="e.g., Senior Research Analyst"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="goal">Goal *</Label>
                  <Textarea
                    id="goal"
                    placeholder="What is this agent's primary objective?"
                    value={formData.goal}
                    onChange={(e) => setFormData({ ...formData, goal: e.target.value })}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="backstory">Backstory</Label>
                  <Textarea
                    id="backstory"
                    placeholder="Describe the agent's background and personality..."
                    value={formData.backstory}
                    onChange={(e) => setFormData({ ...formData, backstory: e.target.value })}
                    rows={3}
                  />
                </div>

                <div className="flex gap-2 justify-end pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    Create Agent
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </Card>
      )}
    </div>
  );
}
