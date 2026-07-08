import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import { Mail } from "lucide-react";
import { FormEvent, useState } from "react";

type AuthMode = "signin" | "signup" | "magic";

type AuthDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AuthDialog({ open, onOpenChange }: AuthDialogProps) {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resetStatus = () => {
    setMessage(null);
    setError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetStatus();
    setPending(true);

    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        onOpenChange(false);
        return;
      }

      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
          },
        });
        if (error) throw error;
        setMessage("Check your email to confirm your account.");
        return;
      }

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });
      if (error) throw error;
      setMessage("Magic link sent. Check your email to continue.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Authentication failed");
    } finally {
      setPending(false);
    }
  };

  const passwordRequired = mode !== "magic";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sign in to Hey Harvey</DialogTitle>
          <DialogDescription>
            Use your email to access your workspace.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(value) => {
          setMode(value as AuthMode);
          resetStatus();
        }}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="signin">Sign in</TabsTrigger>
            <TabsTrigger value="signup">Sign up</TabsTrigger>
            <TabsTrigger value="magic">Magic link</TabsTrigger>
          </TabsList>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <TabsContent value="signin" className="mt-0 space-y-4" forceMount>
              {mode === "signin" ? <AuthFields passwordRequired={passwordRequired} email={email} password={password} onEmailChange={setEmail} onPasswordChange={setPassword} /> : null}
            </TabsContent>
            <TabsContent value="signup" className="mt-0 space-y-4" forceMount>
              {mode === "signup" ? <AuthFields passwordRequired={passwordRequired} email={email} password={password} onEmailChange={setEmail} onPasswordChange={setPassword} /> : null}
            </TabsContent>
            <TabsContent value="magic" className="mt-0 space-y-4" forceMount>
              {mode === "magic" ? <AuthFields passwordRequired={passwordRequired} email={email} password={password} onEmailChange={setEmail} onPasswordChange={setPassword} /> : null}
            </TabsContent>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

            <Button type="submit" className="w-full gap-2" disabled={pending}>
              <Mail className="h-4 w-4" />
              {pending ? "Working..." : getSubmitLabel(mode)}
            </Button>
          </form>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function AuthFields({
  passwordRequired,
  email,
  password,
  onEmailChange,
  onPasswordChange,
}: {
  passwordRequired: boolean;
  email: string;
  password: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
}) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="auth-email">Email</Label>
        <Input
          id="auth-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => onEmailChange(event.target.value)}
          required
        />
      </div>

      {passwordRequired ? (
        <div className="space-y-2">
          <Label htmlFor="auth-password">Password</Label>
          <Input
            id="auth-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            minLength={6}
            required
          />
        </div>
      ) : null}
    </>
  );
}

function getSubmitLabel(mode: AuthMode) {
  if (mode === "signup") return "Create account";
  if (mode === "magic") return "Send magic link";
  return "Sign in";
}
