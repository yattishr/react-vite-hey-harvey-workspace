import { useAuth } from "@/_core/hooks/useAuth";
import { AuthDialog } from "@/components/AuthDialog";
import { useLocation } from "wouter";
import { useEffect, useRef, useState } from "react";
import homepagePreview from "./HomePreview.html?raw";

const AUTH_ACTIONS = new Set([
  "sign in",
  "sign in to workspace",
  "build my team",
]);

function getPreviewParts() {
  const document = new DOMParser().parseFromString(homepagePreview, "text/html");
  const css = document.querySelector("style")?.textContent ?? "";

  return {
    // The preview styles target a document root and body. Inside the shadow root,
    // the host is the page boundary for those same styles.
    css: css
      .replace(/:root/g, ":host")
      .replace(/body\s*\{/g, ":host { display: block;"),
    markup: document.body.innerHTML,
  };
}

const preview = getPreviewParts();

export default function Home() {
  const { isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();
  const previewHostRef = useRef<HTMLDivElement>(null);
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    if (isAuthenticated && !loading) {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, loading, setLocation]);

  useEffect(() => {
    const host = previewHostRef.current;
    if (!host) return;

    const root = host.shadowRoot ?? host.attachShadow({ mode: "open" });
    root.innerHTML = `<style>${preview.css}</style>${preview.markup}`;

    const handleClick = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const link = target.closest("a");
      const label = link?.textContent?.trim().replace(/\s+/g, " ").toLowerCase();
      if (!link || !label || !AUTH_ACTIONS.has(label.replace(/\s*→$/, ""))) return;

      event.preventDefault();
      setAuthOpen(true);
    };

    root.addEventListener("click", handleClick);
    return () => root.removeEventListener("click", handleClick);
  }, [loading]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f8fc]">
        <div
          className="h-8 w-8 animate-spin rounded-full border-4 border-[#dce9ff] border-t-[#2563eb]"
          aria-label="Loading"
        />
      </div>
    );
  }

  return (
    <>
      <div ref={previewHostRef} />
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
    </>
  );
}
