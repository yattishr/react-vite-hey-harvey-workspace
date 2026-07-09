import type { AgentFactoryPreview } from "../../../server/agentFactory";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { ArrowRight, CheckCircle2, Loader2, Play, RefreshCw, Sparkles, WandSparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const taskTemplates = [
  {
    id: "market-opportunity",
    title: "Research a market opportunity",
    description:
      "Assess a new market opportunity, identify customer segments, competitors, risks, and a practical entry plan.",
  },
  {
    id: "operations-improvement",
    title: "Create an operations improvement plan",
    description:
      "Review a business process, find bottlenecks, propose improvements, and define a short implementation roadmap.",
  },
  {
    id: "business-brief-analysis",
    title: "Analyze a business document or brief",
    description:
      "Analyze a supplied business brief, extract key issues, identify gaps, and produce recommended next actions.",
  },
  {
    id: "go-to-market",
    title: "Draft a go-to-market plan",
    description:
      "Create a go-to-market plan with positioning, audience, channels, launch sequence, and success metrics.",
  },
];

export default function TaskFactory() {
  const [, setLocation] = useLocation();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [preview, setPreview] = useState<AgentFactoryPreview | null>(null);

  const utils = trpc.useUtils();
  const planMutation = trpc.agentFactory.plan.useMutation();
  const approveAndRunMutation = trpc.agentFactory.approveAndRun.useMutation();

  const selectedTemplate = taskTemplates.find(template => template.id === selectedTemplateId);
  const canPlan = description.trim().length >= 10;

  const handleTemplateSelect = (template: (typeof taskTemplates)[number]) => {
    setSelectedTemplateId(template.id);
    setDescription(template.description);
    setPreview(null);
  };

  const handlePlan = async () => {
    if (!canPlan) {
      toast.error("Describe the outcome in at least 10 characters");
      return;
    }

    try {
      const plan = await planMutation.mutateAsync({
        description: description.trim(),
        templateId: selectedTemplateId ?? undefined,
      });
      setPreview(plan);
      toast.success("Team generated");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to generate team";
      toast.error(message);
    }
  };

  const handleApproveAndRun = async () => {
    if (!preview) return;

    try {
      const result = await approveAndRunMutation.mutateAsync({
        description: description.trim(),
        preview,
      });
      await Promise.all([
        utils.agents.list.invalidate(),
        utils.tasks.list.invalidate(),
        utils.workflows.list.invalidate(),
      ]);
      toast.success("Team created and task completed");
      setLocation(`/tasks/${result.task.id}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to approve and run task";
      toast.error(message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <WandSparkles className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">Build My Team</h1>
          </div>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Describe the outcome. Harvey builds the agents, workflow, and first task run.
          </p>
        </div>
        {preview ? (
          <Badge variant="outline" className="w-fit gap-2 px-3 py-1">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Team ready for approval
          </Badge>
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="space-y-4">
          <Card className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">1. Describe the outcome</h2>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {taskTemplates.map(template => {
                const isSelected = selectedTemplateId === template.id;
                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => handleTemplateSelect(template)}
                    className={`rounded-lg border p-3 text-left transition-colors hover:border-primary/60 hover:bg-accent/40 ${
                      isSelected ? "border-primary bg-accent/60" : "border-border"
                    }`}
                  >
                    <span className="block text-sm font-medium">{template.title}</span>
                    <span className="mt-1 line-clamp-2 block text-xs text-muted-foreground">
                      {template.description}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 space-y-2">
              <label htmlFor="task-factory-description" className="text-sm font-medium">
                Task description
              </label>
              <Textarea
                id="task-factory-description"
                value={description}
                onChange={event => {
                  setDescription(event.target.value);
                  setPreview(null);
                }}
                placeholder="Describe the business outcome you want Harvey to produce..."
                rows={8}
              />
              {selectedTemplate ? (
                <p className="text-xs text-muted-foreground">
                  Starter selected: {selectedTemplate.title}
                </p>
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={handlePlan} disabled={!canPlan || planMutation.isPending} className="gap-2">
                {planMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <WandSparkles className="h-4 w-4" />
                )}
                {preview ? "Regenerate Team" : "Generate Team"}
              </Button>
              {preview ? (
                <Button
                  variant="outline"
                  onClick={handlePlan}
                  disabled={!canPlan || planMutation.isPending}
                  className="gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Regenerate
                </Button>
              ) : null}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-lg font-semibold">3. Approve and run</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Approval creates the agents, saves a sequential workflow, starts the task, and opens the task detail page.
            </p>
            <Button
              className="mt-4 gap-2"
              disabled={!preview || approveAndRunMutation.isPending}
              onClick={handleApproveAndRun}
            >
              {approveAndRunMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Approve & Run
            </Button>
          </Card>
        </div>

        <Card className="min-h-[520px] p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">2. Review the generated team</h2>
            {preview ? <Badge>{preview.agents.length} agents</Badge> : null}
          </div>

          {!preview ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
              <WandSparkles className="mb-4 h-10 w-10 text-muted-foreground" />
              <p className="font-medium">No team generated yet</p>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                Choose a starter task or write your own description, then generate a team preview.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground">Task</p>
                <h3 className="mt-1 text-xl font-semibold">{preview.taskTitle}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{preview.taskSummary}</p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {preview.agents.map((agent, index) => (
                  <div key={`${agent.name}-${index}`} className="rounded-lg border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">{agent.name}</h3>
                        <p className="text-sm text-muted-foreground">{agent.role}</p>
                      </div>
                      <Badge variant="outline">Agent {index + 1}</Badge>
                    </div>
                    <p className="mt-3 text-sm leading-6">{agent.goal}</p>
                    <p className="mt-3 text-xs leading-5 text-muted-foreground">{agent.backstory}</p>
                    <div className="mt-3 rounded-md bg-accent/50 p-3 text-xs leading-5">
                      {agent.responsibility}
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border p-4">
                <h3 className="font-semibold">Workflow</h3>
                <div className="mt-4 space-y-3">
                  {preview.workflowSteps.map((step, index) => {
                    const agent = preview.agents[step.agentIndex - 1];
                    return (
                      <div key={step.stepNumber} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                            {step.stepNumber}
                          </div>
                          {index < preview.workflowSteps.length - 1 ? (
                            <div className="mt-2 h-full min-h-8 w-px bg-border" />
                          ) : null}
                        </div>
                        <div className="pb-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{agent?.name ?? `Agent ${step.agentIndex}`}</p>
                            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">Step {step.stepNumber}</p>
                          </div>
                          <p className="mt-1 text-sm leading-6">{step.taskDescription}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
