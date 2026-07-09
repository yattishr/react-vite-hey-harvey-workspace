import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Agents from "./pages/Agents";
import Tasks from "./pages/Tasks";
import TaskFactory from "./pages/TaskFactory";
import TaskDetail from "./pages/TaskDetail";
import Conversations from "./pages/Conversations";
import Workflows from "./pages/Workflows";
import WorkflowDetail from "./pages/WorkflowDetail";
import DashboardLayout from "./components/DashboardLayout";
import { useAuth } from "./_core/hooks/useAuth";
import { DashboardLayoutSkeleton } from "./components/DashboardLayoutSkeleton";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!isAuthenticated) {
    return <Home />;
  }

  return <Component />;
}

function Router() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  return (
    <Switch>
      <Route path={"/"} component={Home} />
      {isAuthenticated && (
        <>
          <Route path={"/dashboard"}>
            {() => (
              <DashboardLayout>
                <Dashboard />
              </DashboardLayout>
            )}
          </Route>
          <Route path={"/agents"}>
            {() => (
              <DashboardLayout>
                <Agents />
              </DashboardLayout>
            )}
          </Route>
          <Route path={"/tasks"}>
            {() => (
              <DashboardLayout>
                <Tasks />
              </DashboardLayout>
            )}
          </Route>
          <Route path={"/build-team"}>
            {() => (
              <DashboardLayout>
                <TaskFactory />
              </DashboardLayout>
            )}
          </Route>
          <Route path={"/tasks/:id"}>
            {() => (
              <DashboardLayout>
                <TaskDetail />
              </DashboardLayout>
            )}
          </Route>
          <Route path={"/conversations"}>
            {() => (
              <DashboardLayout>
                <Conversations />
              </DashboardLayout>
            )}
          </Route>
          <Route path={"/workflows"}>
            {() => (
              <DashboardLayout>
                <Workflows />
              </DashboardLayout>
            )}
          </Route>
          <Route path={"/workflows/:id"}>
            {() => (
              <DashboardLayout>
                <WorkflowDetail />
              </DashboardLayout>
            )}
          </Route>
        </>
      )}
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
