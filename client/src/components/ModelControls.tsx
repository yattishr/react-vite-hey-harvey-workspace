import { useSyncExternalStore } from "react";
import { Brain } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import {
  getReasoningEffort,
  setReasoningEffort,
  subscribeReasoning,
} from "@/lib/model-settings";

export function ModelControls() {
  const effort = useSyncExternalStore(
    subscribeReasoning,
    getReasoningEffort,
    () => "none"
  );
  const settings = trpc.modelSettings.useQuery(undefined, { staleTime: 60000 });
  const enabled = settings.data?.reasoningToggleSupported ?? false;
  return (
    <section
      aria-label="AI model settings"
      className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3"
    >
      <div className="flex items-center gap-2 text-sm">
        <Brain className="h-4 w-4 text-primary" />
        <span className="font-semibold">
          {settings.data?.model ?? "Loading model…"}
        </span>
        {settings.data && settings.data.agentsModel !== settings.data.model && (
          <span className="text-xs text-muted-foreground">
            Agents: {settings.data.agentsModel}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <div>
          <label
            htmlFor="reasoning-toggle"
            className="cursor-pointer text-sm font-medium"
          >
            Reasoning {effort === "medium" ? "on" : "off"}
          </label>
          <p className="text-xs text-muted-foreground">
            {settings.error
              ? "Model settings unavailable"
              : !enabled && settings.data
                ? "Toggle requires GPT-6 Luna for both runtimes"
                : "On = medium effort · Applies to new requests"}
          </p>
        </div>
        <Switch
          id="reasoning-toggle"
          checked={effort === "medium"}
          disabled={!enabled}
          onCheckedChange={checked => {
            try {
              setReasoningEffort(checked ? "medium" : "none");
            } catch {
              toast.error(
                "Unable to save reasoning preference in this browser."
              );
            }
          }}
        />
      </div>
    </section>
  );
}
