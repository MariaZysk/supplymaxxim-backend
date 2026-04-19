import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, Lock, Mail, Sparkles, ShieldCheck, Network, BrainCircuit } from "lucide-react";

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("avery@spheremaxxing.ai");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate("/app");
  };

  return (
    <div className="min-h-screen w-full grid lg:grid-cols-2 bg-background relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute inset-0 bg-gradient-glow pointer-events-none" />
      <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-primary/20 blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-accent/15 blur-[120px] pointer-events-none" />

      {/* Left — branding panel */}
      <div className="relative hidden lg:flex flex-col justify-between p-10 xl:p-14 border-r border-border/40">
        <Logo />

        <div className="space-y-8 max-w-lg">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] uppercase tracking-[0.16em] text-primary font-medium">
              AI Procurement Intelligence
            </span>
          </div>

          <h1 className="font-display text-4xl xl:text-5xl font-semibold leading-[1.1] tracking-tight">
            Smarter sourcing decisions, <span className="gradient-text">powered by intelligence</span>.
          </h1>

          <p className="text-base text-muted-foreground leading-relaxed">
            Spheremaxxing unifies supplier discovery, BOM-level cost analysis, and substitution logic
            into one decision-support platform — so procurement teams move faster with less risk.
          </p>

          <div className="grid grid-cols-1 gap-3 pt-4">
            {[
              { icon: Network, label: "Supplier Network Visibility", sub: "1,200+ suppliers across 47 regions" },
              { icon: BrainCircuit, label: "AI Recommendation Engine", sub: "9,400+ inferences, 18% avg risk reduction" },
              { icon: ShieldCheck, label: "Risk-Aware Decision Support", sub: "Real-time geopolitical & ESG signals" },
            ].map(({ icon: Icon, label, sub }) => (
              <div key={label} className="flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-card/40">
                <div className="h-9 w-9 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div className="leading-tight">
                  <div className="text-sm font-medium">{label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Spheremaxxing · Enterprise Procurement Intelligence
        </div>
      </div>

      {/* Right — login form */}
      <div className="relative flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8">
            <Logo />
          </div>

          <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl p-7 sm:p-9 shadow-elegant">
            <div className="mb-7">
              <h2 className="font-display text-2xl font-semibold tracking-tight">Welcome back</h2>
              <p className="text-sm text-muted-foreground mt-1.5">
                Sign in to your intelligence console.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Work email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="pl-9 h-11 bg-secondary/50 border-border/60"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Password
                  </Label>
                  <button type="button" className="text-[11px] text-primary hover:underline">
                    Forgot?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••"
                    className="pl-9 h-11 bg-secondary/50 border-border/60"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-gradient-primary text-primary-foreground font-medium shadow-elegant hover:shadow-glow transition-all"
              >
                Sign in to Console
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>

              <div className="relative py-1">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border/60" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-card px-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    or
                  </span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/app")}
                className="w-full h-11 border-primary/30 bg-primary/5 hover:bg-primary/10 text-foreground"
              >
                <Sparkles className="mr-1.5 h-4 w-4 text-primary" />
                Continue to Live Demo
              </Button>
            </form>

            <p className="text-[11px] text-muted-foreground text-center mt-6">
              Enterprise SSO · SOC 2 Type II · ISO 27001
            </p>
          </div>

          <p className="text-xs text-muted-foreground text-center mt-6">
            New to Spheremaxxing? <button className="text-primary hover:underline">Request a workspace</button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
