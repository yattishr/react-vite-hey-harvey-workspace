import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Home, Zap } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  const handleGoHome = () => {
    setLocation("/");
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[radial-gradient(circle_at_15%_0%,rgba(37,99,235,0.12),transparent_32%),radial-gradient(circle_at_90%_10%,rgba(124,58,237,0.1),transparent_28%),#f7f8fc]">
      <Card className="w-full max-w-lg mx-4 border-white/80 bg-white/85 shadow-[0_24px_70px_rgba(31,52,108,0.16)] backdrop-blur-sm">
        <CardContent className="pt-8 pb-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="harvey-brand-mark h-16 w-16 rounded-[20px]">
              <Zap className="h-7 w-7 fill-current" />
            </div>
          </div>

          <div className="harvey-section-label mb-3">Lost in the workspace</div>
          <h1 className="text-5xl font-bold text-[#10131a] mb-2 tracking-[-0.055em]">404</h1>

          <h2 className="text-xl font-semibold text-[#202633] mb-4">
            Page Not Found
          </h2>

          <p className="text-muted-foreground mb-8 leading-relaxed">
            Sorry, the page you are looking for doesn't exist.
            <br />
            It may have been moved or deleted.
          </p>

          <div
            id="not-found-button-group"
            className="flex flex-col sm:flex-row gap-3 justify-center"
          >
            <Button
              onClick={handleGoHome}
              className="px-6"
            >
              <Home className="w-4 h-4 mr-2" />
              Go Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
