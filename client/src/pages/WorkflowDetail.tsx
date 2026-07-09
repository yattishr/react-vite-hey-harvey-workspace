import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, CheckSquare, GitBranch, Play } from "lucide-react";
import { Link, useParams } from "wouter";

type WorkflowConfig = {
  source?: string;
  taskId?: number;
  steps?: Array<{
    stepNumber: number;
    agentIds: number[];
    taskDescription: string;
  }>;
};

function parseWorkflowConfig(config: string | null | undefined): WorkflowConfig {
  if (!config) return {};
  try {
    const parsed = JSON.parse(config);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export default function WorkflowDetail() {
  const { id } = useParams<{ id: string }>();
  const workflowId = id ? Number.parseInt(id, 10) : null;
  const { user, organization } = useAuth();
  const queriesEnabled = Boolean(user && organization && workflowId);

  const workflowQuery = trpc.workflows.get.useQuery(
    { id: workflowId! },
    { enabled: queriesEnabled }
  );
  const agentsQuery = trpc.agents.list.useQuery(undefined, { enabled: queriesEnabled });
  const executionsQuery = trpc.workflows.listExecutions.useQuery(
    { workflowId: workflowId! },
    { enabled: queriesEnabled }
  );

  if (!workflowId) {
    return (
      <div className="space-y-6">
        <p className="text-muted-foreground">Invalid workflow ID</p>
        <Link href="/workflows">
          <Button variant="outline">Back to Workflows</Button>
        </Link>
      </div>
    );
  }

  if (workflowQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const workflow = workflowQuery.data;
  if (!workflow) {
    return (
      <div className="space-y-6">
        <p className="text-muted-foreground">Workflow not found</p>
        <Link href="/workflows">
          <Button variant="outline">Back to Workflows</Button>
        </Link>
      </div>
    );
  }

  const config = parseWorkflowConfig(workflow.config);
  const steps = config.steps ?? [];
  const executions = executionsQuery.data ?? [];
  const agentsById = new Map((agentsQuery.data ?? []).map(agent => [agent.id, agent]));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/workflows">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <GitBranch className="h-5 w-5 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">{workflow.name}</h1>
          </div>
          {workflow.description ? (
            <p className="mt-2 text-muted-foreground">{workflow.description}</p>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Workflow Overview</CardTitle>
          <CardDescription>
            Sequential workflow generated for a task-first agent team.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Status</p>
            <Badge className="mt-2 capitalize">{workflow.status}</Badge>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Execution Type</p>
            <p className="mt-2 font-semibold capitalize">{workflow.executionType}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Steps</p>
            <p className="mt-2 font-semibold">{steps.length}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Created</p>
            <p className="mt-2 font-semibold">{new Date(workflow.createdAt).toLocaleDateString()}</p>
          </div>
        </CardContent>
      </Card>

      {config.taskId ? (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <CheckSquare className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Generated task output</p>
                <p className="text-sm text-muted-foreground">
                  Open the related task to inspect the execution timeline and final result.
                </p>
              </div>
            </div>
            <Link href={`/tasks/${config.taskId}`}>
              <Button variant="outline">Open Task Output</Button>
            </Link>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Workflow Steps</CardTitle>
          <CardDescription>Agents execute these responsibilities in order.</CardDescription>
        </CardHeader>
        <CardContent>
          {steps.length > 0 ? (
            <div className="space-y-4">
              {steps.map((step, index) => (
                <div key={`${step.stepNumber}-${index}`} className="flex gap-3 rounded-lg border p-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                    {step.stepNumber}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap gap-2">
                      {(step.agentIds ?? []).map(agentId => (
                        <Badge key={agentId} variant="outline">
                          {agentsById.get(agentId)?.name ?? `Agent #${agentId}`}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-sm leading-6">{step.taskDescription}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No workflow steps found.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Workflow Executions</CardTitle>
          <CardDescription>
            V1 factory runs execute the related task immediately; explicit workflow executions appear here when run from the workflow surface.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {executions.length > 0 ? (
            <div className="space-y-3">
              {executions.map(execution => (
                <div key={execution.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-medium">Execution #{execution.id}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(execution.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <Badge className="capitalize">{execution.status}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Play className="h-4 w-4" />
              No workflow executions yet.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
