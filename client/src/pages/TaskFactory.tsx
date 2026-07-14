import type { AgentFactoryPreview } from "../../../server/agentFactory";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { ArrowRight, Check, CheckCircle2, Info, Loader2, Play, Sparkles, WandSparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const taskTemplates = [
  {
    id: "market-opportunity",
    title: "Explore a new market opportunity",
    description:
      "Assess a new market opportunity, identify customer segments, competitors, risks, and a practical entry plan.",
  },
  {
    id: "operations-improvement",
    title: "Improve a business process",
    description:
      "Review a business process, find bottlenecks, propose improvements, and define a short implementation roadmap.",
  },
  {
    id: "business-brief-analysis",
    title: "Review a document or brief",
    description:
      "Analyze a supplied business brief, extract key issues, identify gaps, and produce recommended next actions.",
  },
  {
    id: "go-to-market",
    title: "Create a go-to-market plan",
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
      toast.success("Team suggestion ready");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Harvey couldn't suggest a team";
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
      toast.success("Your team has completed the work");
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
          <div className="harvey-section-label mb-3">From goal to done</div>
          <div className="flex items-center gap-2">
            <WandSparkles className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">Build a team around your goal</h1>
          </div>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Describe what you want to accomplish. Harvey will suggest the right team and a plan for getting the work done.
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
          <Card className="p-5 sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">1. What would you like to accomplish?</h2>
            </div>

            <p className="harvey-section-label mb-2">Start with an example</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {taskTemplates.map(template => {
                const isSelected = selectedTemplateId === template.id;
                return (
                  <button
                    key={template.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => handleTemplateSelect(template)}
                    className={`flex min-h-11 items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-all hover:border-[#b8cdf8] hover:bg-[#f7f9ff] ${
                      isSelected
                        ? "border-[#b8cdf8] bg-[#eef4ff] text-[#1749bf] shadow-[0_5px_14px_rgba(37,99,235,0.07)]"
                        : "border-border bg-white/70"
                    }`}
                  >
                    <span className="block text-sm font-semibold">{template.title}</span>
                    {isSelected ? <Check className="h-4 w-4 shrink-0" /> : null}
                  </button>
                );
              })}
            </div>

            <div className="mt-6 space-y-2">
              <label htmlFor="task-factory-description" className="text-sm font-bold">
                Describe the outcome
              </label>
              <Textarea
                id="task-factory-description"
                value={description}
                onChange={event => {
                  setDescription(event.target.value);
                  setPreview(null);
                }}
                placeholder="Tell Harvey what you want to achieve, what the work should cover, and what a useful result would look like."
                rows={9}
                className="min-h-[220px] resize-y text-base leading-7"
              />
              <p className="text-sm leading-6 text-muted-foreground">
                Harvey will use this to recommend the right roles, responsibilities, and next steps.
              </p>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button onClick={handlePlan} disabled={!canPlan || planMutation.isPending} className="gap-2">
                {planMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <WandSparkles className="h-4 w-4" />
                )}
                {preview ? "Update My Team Suggestion" : "Suggest My Team"}
              </Button>
              <div className="flex max-w-md items-start gap-2 text-xs leading-5 text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#2563eb]" />
                <span><strong className="text-foreground">What happens next?</strong> You’ll review Harvey’s suggested team before any work begins.</span>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-lg font-semibold">3. Approve when you’re ready</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Review the suggested roles and plan. When you’re happy with them, approve the team to begin the work.
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
              Approve Team & Start Work
            </Button>
          </Card>
        </div>

        <Card className="min-h-[520px] p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">
              {preview ? "Here is the team Harvey recommends" : "2. Review Harvey’s suggested team"}
            </h2>
            {preview ? <Badge>{preview.agents.length} suggested roles</Badge> : null}
          </div>

          {!preview ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
              <WandSparkles className="mb-4 h-10 w-10 text-muted-foreground" />
              <p className="font-medium">Your suggested team will appear here</p>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                Describe your goal and Harvey will recommend the roles and plan best suited to the outcome.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground">Your goal</p>
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
                      <Badge variant="outline">Role {index + 1}</Badge>
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
                <h3 className="font-semibold">Suggested plan</h3>
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
                            <p className="font-medium">{agent?.name ?? `Team member ${step.agentIndex}`}</p>
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
