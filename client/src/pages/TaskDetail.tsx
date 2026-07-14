import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  Play,
  CheckCircle,
  AlertCircle,
  Clock,
  Zap,
  Download,
  ChevronDown,
  ChevronUp,
  Brain,
  Pencil,
  RotateCcw,
  Square,
} from "lucide-react";
import { Link } from "wouter";
import { Streamdown } from "streamdown";
import { useTaskPolling } from "@/hooks/useTaskPolling";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const taskId = id ? parseInt(id) : null;
  const { user, organization } = useAuth();
  const queriesEnabled = Boolean(user && organization);
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set());
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    agentIds: [] as number[],
  });

  // Use polling hook for real-time updates
  const { task, logs, runHistory, isLoading, isError } = useTaskPolling(
    taskId,
    queriesEnabled
  );
  const agentsQuery = trpc.agents.list.useQuery(undefined, {
    enabled: queriesEnabled,
  });
  const updateMutation = trpc.tasks.update.useMutation();
  const executeMutation = trpc.tasks.execute.useMutation();
  const cancelMutation = trpc.tasks.cancelRun.useMutation();
  const utils = trpc.useUtils();

  const agents = agentsQuery.data || [];

  useEffect(() => {
    if (!task || isEditOpen) return;
    setFormData({
      title: task.title,
      description: task.description,
      agentIds: task.agentIds as number[],
    });
  }, [isEditOpen, task]);

  const toggleAgent = (agentId: number) => {
    setFormData(prev => ({
      ...prev,
      agentIds: prev.agentIds.includes(agentId)
        ? prev.agentIds.filter(id => id !== agentId)
        : [...prev.agentIds, agentId],
    }));
  };

  const handleExecuteTask = async () => {
    if (!taskId) return;

    try {
      await executeMutation.mutateAsync({ id: taskId });
      toast.success("Task execution started");
      await Promise.all([
        utils.tasks.get.invalidate({ id: taskId }),
        utils.tasks.getExecutionLogs.invalidate({ taskId }),
        utils.tasks.list.invalidate(),
      ]);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to execute task";
      toast.error(message);
    }
  };

  const handleCancelRun = async () => {
    const taskRunId = runHistory?.taskRun?.id;
    if (!taskRunId) return;
    try {
      await cancelMutation.mutateAsync({ taskRunId });
      toast.success("Cancellation requested");
      await utils.tasks.getTaskRunHistory.invalidate({ taskId: taskId! });
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to cancel run"
      );
    }
  };

  const handleUpdateTask = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!taskId) return;

    if (
      !formData.title ||
      !formData.description ||
      formData.agentIds.length === 0
    ) {
      toast.error(
        "Please fill in all required fields and select at least one agent"
      );
      return;
    }

    try {
      await updateMutation.mutateAsync({
        id: taskId,
        title: formData.title,
        description: formData.description,
        agentIds: formData.agentIds,
      });
      toast.success("Task updated");
      setIsEditOpen(false);
      await Promise.all([
        utils.tasks.get.invalidate({ id: taskId }),
        utils.tasks.getExecutionLogs.invalidate({ taskId }),
        utils.tasks.list.invalidate(),
      ]);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to update task";
      toast.error(message);
    }
  };

  const toggleLogExpanded = (logId: number) => {
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId);
    } else {
      newExpanded.add(logId);
    }
    setExpandedLogs(newExpanded);
  };

  if (!taskId) {
    return (
      <div className="space-y-8">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Invalid task ID</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-8 w-1/4" />
        <Card className="p-6">
          <Skeleton className="h-6 w-1/2 mb-4" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-3/4" />
        </Card>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="space-y-8">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Task not found</p>
          <Link href="/tasks">
            <Button variant="outline" className="mt-4">
              Back to Tasks
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
        );
      case "running":
        return (
          <Zap className="w-6 h-6 text-blue-600 dark:text-blue-400 animate-pulse" />
        );
      case "failed":
        return (
          <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
        );
      case "queued":
        return (
          <Clock className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
        );
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

  const getActionIcon = (action: string) => {
    switch (action) {
      case "planning":
        return "📋";
      case "reasoning":
        return "🧠";
      case "execution":
        return "⚙️";
      case "result_generation":
        return "✨";
      case "completion":
        return "✅";
      case "error":
        return "❌";
      default:
        return "•";
    }
  };

  const isThinkingStep = (action: string) => {
    return action === "reasoning" || action === "planning";
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-4">
        <Link href="/tasks">
          <Button variant="outline" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="harvey-section-label mb-2">Task workspace</div>
          <div className="flex items-center gap-3 mb-2">
            {getStatusIcon(task.status)}
            <h1 className="text-3xl font-bold tracking-tight">{task.title}</h1>
          </div>
          <Badge className={getStatusColor(task.status)}>
            {task.status.charAt(0).toUpperCase() + task.status.slice(1)}
          </Badge>
        </div>
        {task.status !== "running" && (
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setIsEditOpen(true)}
          >
            <Pencil className="w-4 h-4" />
            Edit
          </Button>
        )}
        {task.status === "running" && runHistory?.taskRun ? (
          <Button
            variant="destructive"
            className="gap-2"
            onClick={handleCancelRun}
            disabled={
              cancelMutation.isPending ||
              runHistory.taskRun.status === "cancel_requested"
            }
          >
            <Square className="w-4 h-4" />
            {runHistory.taskRun.status === "cancel_requested"
              ? "Cancelling..."
              : "Cancel run"}
          </Button>
        ) : null}
      </div>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateTask} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="detail-task-title">Task Title *</Label>
              <Input
                id="detail-task-title"
                value={formData.title}
                onChange={event =>
                  setFormData({ ...formData, title: event.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="detail-task-description">
                Task Description *
              </Label>
              <Textarea
                id="detail-task-description"
                value={formData.description}
                onChange={event =>
                  setFormData({ ...formData, description: event.target.value })
                }
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label>Assign Agents *</Label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {agents.length > 0 ? (
                  agents.map(agent => (
                    <div key={agent.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`detail-agent-${agent.id}`}
                        checked={formData.agentIds.includes(agent.id)}
                        onChange={() => toggleAgent(agent.id)}
                        className="rounded border-border"
                      />
                      <label
                        htmlFor={`detail-agent-${agent.id}`}
                        className="flex-1 cursor-pointer text-sm"
                      >
                        <span className="font-medium">{agent.name}</span>
                        <span className="text-muted-foreground ml-2">
                          ({agent.role})
                        </span>
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
                onClick={() => setIsEditOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                Save Changes
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Task Overview */}
      <Card className="p-6 card-elevated">
        <h2 className="text-lg font-semibold mb-4">Task Overview</h2>
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">
              Description
            </p>
            <p className="text-foreground">{task.description}</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Agents Assigned
              </p>
              <p className="text-lg font-semibold">
                {(task.agentIds as number[]).length}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Created
              </p>
              <p className="text-sm">
                {new Date(task.createdAt).toLocaleDateString()}
              </p>
            </div>
            {task.executionStartedAt && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Started
                </p>
                <p className="text-sm">
                  {new Date(task.executionStartedAt).toLocaleTimeString()}
                </p>
              </div>
            )}
            {task.executionCompletedAt && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Completed
                </p>
                <p className="text-sm">
                  {new Date(task.executionCompletedAt).toLocaleTimeString()}
                </p>
              </div>
            )}
          </div>
        </div>
      </Card>

      {runHistory?.taskRun ? (
        <Card className="p-6 card-elevated">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Run timeline</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Durable step state recovers automatically after refresh.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">
                {runHistory.taskRun.runtime === "openai_agents_sdk"
                  ? "OpenAI Agents SDK"
                  : "Legacy"}
              </Badge>
              <Badge
                className={getStatusColor(
                  runHistory.taskRun.status === "succeeded"
                    ? "completed"
                    : runHistory.taskRun.status
                )}
              >
                {runHistory.taskRun.status.replace(/_/g, " ")}
              </Badge>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {runHistory.members.map(member => {
              const attempts = runHistory.runs.filter(
                run => run.teamMemberId === member.id
              );
              const latestAttempt = attempts.at(-1);
              const status = latestAttempt?.runtimeStatus ?? "pending";
              return (
                <div
                  key={member.id}
                  className="flex gap-3 rounded-lg border p-4"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                    {member.workflowOrder}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">
                        {member.roleKey.replace(/_/g, " ")}
                      </p>
                      <Badge variant="outline">
                        {status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {member.expectedOutput}
                    </p>
                    {latestAttempt ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Attempt {latestAttempt.attempt}
                        {latestAttempt.errorCode
                          ? ` · ${latestAttempt.errorCode}`
                          : ""}
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          {runHistory.taskRun.status === "running" ? (
            <div className="mt-4 flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
              <Zap className="h-4 w-4 animate-pulse" />
              {runHistory.events.at(-1)?.type.replace(/_/g, " ") ??
                "Preparing next step"}
            </div>
          ) : null}
          <p className="mt-4 text-xs text-muted-foreground">
            Correlation ID: {runHistory.taskRun.correlationId}
          </p>
        </Card>
      ) : null}

      {/* Execution Logs with Thought Process */}
      {isLoading ? (
        <Card className="p-6">
          <Skeleton className="h-6 w-1/4 mb-4" />
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </Card>
      ) : logs.length > 0 ? (
        <Card className="p-6 card-elevated">
          <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
            <Brain className="w-5 h-5" />
            Execution Timeline & Thought Process
          </h2>
          <div className="space-y-3">
            {logs.map((log, index) => {
              const isExpanded = expandedLogs.has(log.id);
              const isThinking = isThinkingStep(log.action);

              return (
                <div
                  key={log.id}
                  className="rounded-lg border border-border overflow-hidden transition-all hover:border-accent"
                >
                  <button
                    onClick={() => toggleLogExpanded(log.id)}
                    className="w-full flex gap-4 p-4 bg-background hover:bg-muted/50 transition-colors text-left"
                  >
                    <div className="flex flex-col items-center flex-shrink-0">
                      <span className="text-2xl">
                        {getActionIcon(log.action)}
                      </span>
                      {index < logs.length - 1 && (
                        <div className="w-0.5 h-8 bg-border mt-2" />
                      )}
                    </div>
                    <div className="flex-1 pt-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <h4 className="font-semibold capitalize flex-shrink-0">
                            {log.action.replace(/_/g, " ")}
                          </h4>
                          {isThinking && (
                            <Badge
                              variant="outline"
                              className="text-xs flex-shrink-0"
                            >
                              Thought
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs text-muted-foreground">
                            Step {log.step}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {log.details}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(log.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                  </button>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="border-t border-border bg-muted/30 p-4">
                      <div className="space-y-3">
                        <div>
                          <h5 className="text-sm font-semibold mb-2 flex items-center gap-2">
                            {isThinking ? (
                              <>
                                <Brain className="w-4 h-4" />
                                Agent Thought Process
                              </>
                            ) : (
                              <>
                                <Zap className="w-4 h-4" />
                                Execution Details
                              </>
                            )}
                          </h5>
                          <div className="bg-background rounded p-3 border border-border">
                            <p className="text-sm text-foreground whitespace-pre-wrap font-mono text-xs leading-relaxed">
                              {log.details}
                            </p>
                          </div>
                        </div>

                        {/* Metadata */}
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <p className="text-muted-foreground font-medium">
                              Step Number
                            </p>
                            <p className="text-foreground font-semibold">
                              {log.step}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground font-medium">
                              Timestamp
                            </p>
                            <p className="text-foreground font-semibold">
                              {new Date(log.createdAt).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}

      {/* Result */}
      {task.status === "completed" && task.result && (
        <Card className="p-6 card-elevated bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            Task Result
          </h2>
          <div className="bg-background rounded-lg p-4 border border-border">
            <Streamdown>{task.result}</Streamdown>
          </div>
          <Button variant="outline" className="mt-4 gap-2">
            <Download className="w-4 h-4" />
            Export Result
          </Button>
        </Card>
      )}

      {/* Error */}
      {task.status === "failed" && task.error && (
        <Card className="p-6 card-elevated bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            Task Error
          </h2>
          <div className="bg-background rounded-lg p-4 border border-border">
            <p className="text-sm text-red-700 dark:text-red-300 font-mono">
              {task.error}
            </p>
          </div>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        {task.status === "queued" && (
          <Button
            className="gap-2"
            onClick={handleExecuteTask}
            disabled={executeMutation.isPending}
          >
            <Play className="w-4 h-4" />
            Execute Task
          </Button>
        )}
        {task.status === "failed" && (
          <Button
            className="gap-2"
            onClick={handleExecuteTask}
            disabled={executeMutation.isPending}
          >
            <RotateCcw className="w-4 h-4" />
            Retry Task
          </Button>
        )}
        <Link href="/tasks">
          <Button variant="outline">Back to Tasks</Button>
        </Link>
      </div>
    </div>
  );
}
