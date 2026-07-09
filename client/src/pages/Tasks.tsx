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
import { Pencil, Plus, Play, CheckCircle, AlertCircle, Clock, Zap, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";

export default function Tasks() {
  const [isOpen, setIsOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    agentIds: [] as number[],
  });

  const tasksQuery = trpc.tasks.list.useQuery();
  const agentsQuery = trpc.agents.list.useQuery();
  const createMutation = trpc.tasks.create.useMutation();
  const updateMutation = trpc.tasks.update.useMutation();
  const executeMutation = trpc.tasks.execute.useMutation();
  const utils = trpc.useUtils();

  const tasks = tasksQuery.data || [];
  const agents = agentsQuery.data || [];

  const openCreateDialog = () => {
    setEditingTaskId(null);
    setFormData({ title: "", description: "", agentIds: [] });
    setIsOpen(true);
  };

  const openEditDialog = (task: (typeof tasks)[number]) => {
    setEditingTaskId(task.id);
    setFormData({
      title: task.title,
      description: task.description,
      agentIds: task.agentIds as number[],
    });
    setIsOpen(true);
  };

  const closeDialog = () => {
    setIsOpen(false);
    setEditingTaskId(null);
    setFormData({ title: "", description: "", agentIds: [] });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title || !formData.description || formData.agentIds.length === 0) {
      toast.error("Please fill in all required fields and select at least one agent");
      return;
    }

    try {
      if (editingTaskId) {
        await updateMutation.mutateAsync({
          id: editingTaskId,
          title: formData.title,
          description: formData.description,
          agentIds: formData.agentIds,
        });
        toast.success("Task updated");
      } else {
        await createMutation.mutateAsync({
          title: formData.title,
          description: formData.description,
          agentIds: formData.agentIds,
        });
        toast.success("Task created successfully");
      }
      await utils.tasks.list.invalidate();
      closeDialog();
    } catch (error) {
      toast.error(editingTaskId ? "Failed to update task" : "Failed to create task");
    }
  };

  const handleExecuteTask = async (taskId: number) => {
    try {
      await executeMutation.mutateAsync({ id: taskId });
      toast.success("Task execution started");
      await utils.tasks.list.invalidate();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to execute task";
      toast.error(message);
    }
  };

  const toggleAgent = (agentId: number) => {
    setFormData((prev) => ({
      ...prev,
      agentIds: prev.agentIds.includes(agentId)
        ? prev.agentIds.filter((id) => id !== agentId)
        : [...prev.agentIds, agentId],
    }));
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const taskForm = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Task Title *</Label>
        <Input
          id="title"
          placeholder="e.g., Market Research Report"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Task Description *</Label>
        <Textarea
          id="description"
          placeholder="Describe the task in natural language. What should the agents do?"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={4}
        />
      </div>

      <div className="space-y-2">
        <Label>Assign Agents *</Label>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {agents.length > 0 ? (
            agents.map((agent) => (
              <div key={agent.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={`agent-${agent.id}`}
                  checked={formData.agentIds.includes(agent.id)}
                  onChange={() => toggleAgent(agent.id)}
                  className="rounded border-border"
                />
                <label
                  htmlFor={`agent-${agent.id}`}
                  className="flex-1 cursor-pointer text-sm"
                >
                  <span className="font-medium">{agent.name}</span>
                  <span className="text-muted-foreground ml-2">({agent.role})</span>
                </label>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              No agents available. Create agents first.
            </p>
          )}
        </div>
      </div>

      <div className="flex gap-2 justify-end pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={closeDialog}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving}>
          {editingTaskId ? "Save Changes" : "Create Task"}
        </Button>
      </div>
    </form>
  );

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />;
      case "running":
        return <Zap className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-pulse" />;
      case "failed":
        return <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />;
      case "queued":
        return <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "running":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      case "failed":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      case "queued":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Tasks</h1>
          <p className="text-muted-foreground mt-2">
            Create and manage tasks for your agents to execute.
          </p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={openCreateDialog}>
              <Plus className="w-4 h-4" />
              New Task
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingTaskId ? "Edit Task" : "Create New Task"}</DialogTitle>
            </DialogHeader>
            {taskForm}
          </DialogContent>
        </Dialog>
      </div>

      {/* Tasks List */}
      {tasksQuery.isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-6">
              <Skeleton className="h-6 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2 mb-4" />
              <Skeleton className="h-20 w-full" />
            </Card>
          ))}
        </div>
      ) : tasks.length > 0 ? (
        <div className="space-y-4">
          {tasks.map((task) => (
            <Link key={task.id} href={`/tasks/${task.id}`}>
              <Card className="p-6 card-elevated hover:shadow-elevated cursor-pointer transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(task.status)}
                      <h3 className="text-lg font-semibold text-foreground">{task.title}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                      {task.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(task.status)}>
                      {task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                    </Badge>
                    {task.status === "queued" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        onClick={(e) => {
                          e.preventDefault();
                          handleExecuteTask(task.id);
                        }}
                      >
                        <Play className="w-4 h-4" />
                        Execute
                      </Button>
                    )}
                    {task.status === "failed" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleExecuteTask(task.id);
                        }}
                      >
                        <RotateCcw className="w-4 h-4" />
                        Retry
                      </Button>
                    )}
                    {task.status !== "running" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          openEditDialog(task);
                        }}
                      >
                        <Pencil className="w-4 h-4" />
                        Edit
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {(task.agentIds as number[]).length} agent
                    {(task.agentIds as number[]).length !== 1 ? "s" : ""} assigned
                  </span>
                  <span>{new Date(task.createdAt).toLocaleDateString()}</span>
                </div>

                {task.status === "completed" && task.result && (
                  <div className="mt-4 p-3 bg-accent-subtle rounded-lg">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Result:</p>
                    <p className="text-sm text-foreground line-clamp-3">{task.result}</p>
                  </div>
                )}

                {task.status === "failed" && task.error && (
                  <div className="mt-4 p-3 bg-red-100/20 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-900">
                    <p className="text-xs font-medium text-red-800 dark:text-red-400 mb-1">Error:</p>
                    <p className="text-sm text-red-700 dark:text-red-300 line-clamp-3">{task.error}</p>
                  </div>
                )}
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center card-subtle">
          <Zap className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">No tasks yet. Create your first task to get started.</p>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog}>Create Your First Task</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{editingTaskId ? "Edit Task" : "Create New Task"}</DialogTitle>
              </DialogHeader>
              {taskForm}
            </DialogContent>
          </Dialog>
        </Card>
      )}
    </div>
  );
}
