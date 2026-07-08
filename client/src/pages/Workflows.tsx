import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Play, Eye } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";

export default function Workflows() {
  const { user } = useAuth();
  const [isCreating, setIsCreating] = useState(false);
  const [newWorkflow, setNewWorkflow] = useState({
    name: "",
    description: "",
    executionType: "sequential" as const,
    steps: [{ stepNumber: 1, agentIds: [], taskDescription: "" }],
  });

  const workflowsQuery = trpc.workflows.list.useQuery(undefined, { enabled: !!user });
  const createWorkflowMutation = trpc.workflows.create.useMutation({
    onSuccess: () => {
      toast.success("Workflow created successfully!");
      setNewWorkflow({
        name: "",
        description: "",
        executionType: "sequential",
        steps: [{ stepNumber: 1, agentIds: [], taskDescription: "" }],
      });
      setIsCreating(false);
      workflowsQuery.refetch();
    },
    onError: (error) => {
      toast.error(`Failed to create workflow: ${error.message}`);
    },
  });

  const handleCreateWorkflow = async () => {
    if (!newWorkflow.name.trim()) {
      toast.error("Please enter a workflow name");
      return;
    }

    if (newWorkflow.steps.some((s) => !s.taskDescription.trim() || s.agentIds.length === 0)) {
      toast.error("All steps must have a description and at least one agent");
      return;
    }

    await createWorkflowMutation.mutateAsync({
      name: newWorkflow.name,
      description: newWorkflow.description || undefined,
      executionType: newWorkflow.executionType,
      steps: newWorkflow.steps.map((s) => ({
        stepNumber: s.stepNumber,
        agentIds: s.agentIds,
        taskDescription: s.taskDescription,
      })),
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft":
        return "bg-gray-100 text-gray-800";
      case "active":
        return "bg-green-100 text-green-800";
      case "archived":
        return "bg-gray-200 text-gray-700";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getExecutionTypeLabel = (type: string) => {
    switch (type) {
      case "sequential":
        return "Sequential";
      case "parallel":
        return "Parallel";
      case "conditional":
        return "Conditional";
      default:
        return type;
    }
  };

  if (workflowsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="animate-spin w-8 h-8 text-primary" />
      </div>
    );
  }

  const workflows = workflowsQuery.data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Workflows</h1>
          <p className="text-muted-foreground mt-2">
            Create and manage multi-agent collaboration workflows
          </p>
        </div>
        <Dialog open={isCreating} onOpenChange={setIsCreating}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              New Workflow
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Workflow</DialogTitle>
              <DialogDescription>
                Define a multi-agent workflow with sequential, parallel, or conditional execution
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="workflow-name">Workflow Name</Label>
                <Input
                  id="workflow-name"
                  placeholder="e.g., Market Research Workflow"
                  value={newWorkflow.name}
                  onChange={(e) => setNewWorkflow({ ...newWorkflow, name: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="workflow-description">Description (Optional)</Label>
                <Textarea
                  id="workflow-description"
                  placeholder="Describe what this workflow does..."
                  value={newWorkflow.description}
                  onChange={(e) => setNewWorkflow({ ...newWorkflow, description: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="execution-type">Execution Type</Label>
                <Select
                  value={newWorkflow.executionType}
                  onValueChange={(value: any) =>
                    setNewWorkflow({ ...newWorkflow, executionType: value })
                  }
                >
                  <SelectTrigger id="execution-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sequential">Sequential (steps run one after another)</SelectItem>
                    <SelectItem value="parallel">Parallel (steps run simultaneously)</SelectItem>
                    <SelectItem value="conditional">Conditional (steps based on conditions)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label>Workflow Steps</Label>
                {newWorkflow.steps.map((step, idx) => (
                  <Card key={idx} className="p-4">
                    <div className="space-y-3">
                      <div>
                        <Label className="text-sm">Step {step.stepNumber}: Task Description</Label>
                        <Textarea
                          placeholder="Describe the task for this step..."
                          value={step.taskDescription}
                          onChange={(e) => {
                            const updated = [...newWorkflow.steps];
                            updated[idx].taskDescription = e.target.value;
                            setNewWorkflow({ ...newWorkflow, steps: updated });
                          }}
                          className="text-sm"
                        />
                      </div>
                    </div>
                  </Card>
                ))}

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    const newStep = {
                      stepNumber: newWorkflow.steps.length + 1,
                      agentIds: [],
                      taskDescription: "",
                    };
                    setNewWorkflow({
                      ...newWorkflow,
                      steps: [...newWorkflow.steps, newStep],
                    });
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Step
                </Button>
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <Button variant="outline" onClick={() => setIsCreating(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateWorkflow}
                  disabled={createWorkflowMutation.isPending}
                >
                  {createWorkflowMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Workflow"
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {workflows.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">No workflows yet</p>
            <p className="text-sm text-muted-foreground mb-6">
              Create your first multi-agent workflow to get started
            </p>
            <Dialog open={isCreating} onOpenChange={setIsCreating}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Workflow
                </Button>
              </DialogTrigger>
            </Dialog>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {workflows.map((workflow: any) => (
            <Card key={workflow.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-xl">{workflow.name}</CardTitle>
                    {workflow.description && (
                      <CardDescription className="mt-1">{workflow.description}</CardDescription>
                    )}
                  </div>
                  <Badge className={getStatusColor(workflow.status)}>
                    {workflow.status.charAt(0).toUpperCase() + workflow.status.slice(1)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>
                      Execution Type:{" "}
                      <span className="font-medium text-foreground">
                        {getExecutionTypeLabel(workflow.executionType)}
                      </span>
                    </span>
                    <span>
                      Created:{" "}
                      <span className="font-medium text-foreground">
                        {new Date(workflow.createdAt).toLocaleDateString()}
                      </span>
                    </span>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Link href={`/workflows/${workflow.id}`}>
                      <Button variant="outline" size="sm" className="gap-2">
                        <Eye className="w-4 h-4" />
                        View Details
                      </Button>
                    </Link>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Play className="w-4 h-4" />
                      Execute
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
