import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { Plus, Zap, CheckCircle, AlertCircle, Clock } from "lucide-react";

export default function Dashboard() {
  const { user, organization } = useAuth();
  const queriesEnabled = Boolean(user && organization);
  const agentsQuery = trpc.agents.list.useQuery(undefined, { enabled: queriesEnabled });
  const tasksQuery = trpc.tasks.list.useQuery(undefined, { enabled: queriesEnabled });

  const agents = agentsQuery.data || [];
  const tasks = tasksQuery.data || [];

  // Calculate stats
  const activeAgents = agents.filter((a) => a.isActive).length;
  const completedTasks = tasks.filter((t) => t.status === "completed").length;
  const runningTasks = tasks.filter((t) => t.status === "running").length;
  const recentTasks = tasks.slice(0, 5);

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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-4 h-4" />;
      case "running":
        return <Zap className="w-4 h-4 animate-pulse" />;
      case "failed":
        return <AlertCircle className="w-4 h-4" />;
      case "queued":
        return <Clock className="w-4 h-4" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Welcome back, {user?.name || "User"}. Manage your AI agents and tasks.
          </p>
        </div>
        <Link href="/agents">
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            New Agent
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Active Agents Card */}
        <Card className="p-6 card-elevated">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Active Agents</p>
              <p className="text-3xl font-bold mt-2">{activeAgents}</p>
              <p className="text-xs text-muted-foreground mt-2">
                {agents.length} total agents
              </p>
            </div>
            <div className="p-3 bg-accent/10 rounded-lg">
              <Zap className="w-6 h-6 text-accent" />
            </div>
          </div>
        </Card>

        {/* Completed Tasks Card */}
        <Card className="p-6 card-elevated">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Completed Tasks</p>
              <p className="text-3xl font-bold mt-2">{completedTasks}</p>
              <p className="text-xs text-muted-foreground mt-2">
                {tasks.length} total tasks
              </p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </Card>

        {/* Running Tasks Card */}
        <Card className="p-6 card-elevated">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Running Tasks</p>
              <p className="text-3xl font-bold mt-2">{runningTasks}</p>
              <p className="text-xs text-muted-foreground mt-2">
                In progress now
              </p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Zap className="w-6 h-6 text-blue-600 dark:text-blue-400 animate-pulse" />
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Tasks Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight">Recent Tasks</h2>
          <Link href="/tasks">
            <Button variant="outline">View All</Button>
          </Link>
        </div>

        {tasksQuery.isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-4">
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </Card>
            ))}
          </div>
        ) : recentTasks.length > 0 ? (
          <div className="space-y-3">
            {recentTasks.map((task) => (
              <Link key={task.id} href={`/tasks/${task.id}`}>
                <Card className="p-4 card-elevated hover:shadow-elevated cursor-pointer transition-all">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">{task.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {task.description}
                      </p>
                      <div className="flex items-center gap-2 mt-3">
                        <Badge className={`${getStatusColor(task.status)}`}>
                          <span className="flex items-center gap-1">
                            {getStatusIcon(task.status)}
                            {task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                          </span>
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(task.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card className="p-8 text-center card-subtle">
            <p className="text-muted-foreground">No tasks yet. Create your first task to get started.</p>
            <Link href="/tasks">
              <Button className="mt-4">Create Task</Button>
            </Link>
          </Card>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6 card-elevated">
          <h3 className="font-semibold mb-4">Quick Actions</h3>
          <div className="space-y-2">
            <Link href="/agents">
              <Button variant="outline" className="w-full justify-start">
                Manage Agents
              </Button>
            </Link>
            <Link href="/tasks">
              <Button variant="outline" className="w-full justify-start">
                Manage Tasks
              </Button>
            </Link>
            <Link href="/agents">
              <Button variant="outline" className="w-full justify-start">
                Configure Agents
              </Button>
            </Link>
          </div>
        </Card>

        <Card className="p-6 card-elevated">
          <h3 className="font-semibold mb-4">System Status</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">API Status</span>
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                Operational
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">LLM Service</span>
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                Ready
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Database</span>
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                Connected
              </Badge>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
