import { useAuth } from "@/_core/hooks/useAuth";
import { AuthDialog } from "@/components/AuthDialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { Zap, Users, Cpu, MessageSquare, BarChart3, Sparkles } from "lucide-react";

export default function Home() {
  const { isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [authOpen, setAuthOpen] = useState(false);

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (isAuthenticated && !loading) {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, loading, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin mb-4">
            <Zap className="w-8 h-8 mx-auto text-accent" />
          </div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border bg-card sticky top-0 z-50">
        <div className="container flex items-center justify-between py-4">
          <div className="flex items-center gap-2">
            <Zap className="w-6 h-6 text-accent" />
            <span className="text-xl font-bold">CrewAI Platform</span>
          </div>
          <Button onClick={() => setAuthOpen(true)}>Sign In</Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container py-20 md:py-32">
        <div className="text-center space-y-6 mb-16">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
            Orchestrate Intelligent Agents
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Create, configure, and collaborate with AI agents powered by advanced LLM reasoning. Execute complex tasks with elegance and precision.
          </p>
          <div className="flex gap-4 justify-center pt-4">
            <Button size="lg" className="gap-2" onClick={() => setAuthOpen(true)}>
              <Sparkles className="w-5 h-5" />
              Get Started
            </Button>
            <Button size="lg" variant="outline">
              Learn More
            </Button>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-16">
          {/* Agent Management */}
          <Card className="p-6 card-elevated hover:shadow-elevated transition-all">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-accent/10 rounded-lg">
                <Users className="w-6 h-6 text-accent" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">Agent Management</h3>
                <p className="text-sm text-muted-foreground">
                  Create and configure AI agents with custom roles, goals, and backstories.
                </p>
              </div>
            </div>
          </Card>

          {/* Task Assignment */}
          <Card className="p-6 card-elevated hover:shadow-elevated transition-all">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Cpu className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">Task Assignment</h3>
                <p className="text-sm text-muted-foreground">
                  Assign tasks in natural language to one or more agents for execution.
                </p>
              </div>
            </div>
          </Card>

          {/* Real-time Tracking */}
          <Card className="p-6 card-elevated hover:shadow-elevated transition-all">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <BarChart3 className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">Real-time Tracking</h3>
                <p className="text-sm text-muted-foreground">
                  Monitor task execution with live status updates and detailed progress logs.
                </p>
              </div>
            </div>
          </Card>

          {/* Chat Interface */}
          <Card className="p-6 card-elevated hover:shadow-elevated transition-all">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <MessageSquare className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">Chat Interface</h3>
                <p className="text-sm text-muted-foreground">
                  Interact with agents via threaded conversations for task refinement and follow-ups.
                </p>
              </div>
            </div>
          </Card>

          {/* Tool Integration */}
          <Card className="p-6 card-elevated hover:shadow-elevated transition-all">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <Zap className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">Tool Integration</h3>
                <p className="text-sm text-muted-foreground">
                  Configure agents with built-in tools like web search and data lookup.
                </p>
              </div>
            </div>
          </Card>

          {/* Task History */}
          <Card className="p-6 card-elevated hover:shadow-elevated transition-all">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                <BarChart3 className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">Task History</h3>
                <p className="text-sm text-muted-foreground">
                  Maintain a persistent log of all tasks with full output and timestamps.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-accent/5 border-t border-b border-border py-16">
        <div className="container text-center space-y-6">
          <h2 className="text-3xl font-bold tracking-tight">Ready to Build?</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Start creating intelligent agents and executing complex tasks with our elegant platform.
          </p>
          <Button size="lg" className="gap-2" onClick={() => setAuthOpen(true)}>
            <Sparkles className="w-5 h-5" />
            Sign In to Get Started
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-8">
        <div className="container text-center text-sm text-muted-foreground">
          <p>© 2026 CrewAI Platform. Built with elegance and precision.</p>
        </div>
      </footer>

      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
    </div>
  );
}
