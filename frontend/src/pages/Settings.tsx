import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const Settings = () => {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings"
        title="Workspace Configuration"
        subtitle="Manage your workspace, AI engine preferences, and integration endpoints."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card title="Workspace">
            <Field label="Workspace name" defaultValue="Spheremaxxing Intelligence Console" />
            <Field label="Primary contact" defaultValue="avery@spheremaxxing.ai" />
            <Field label="Default region" defaultValue="EU · Germany" />
          </Card>

          <Card title="AI Engine">
            <ToggleRow label="Enable Substitution Engine" desc="AI suggests material alternatives across BOMs" defaultChecked />
            <ToggleRow label="Risk-aware ranking" desc="Weight supplier results by composite risk score" defaultChecked />
            <ToggleRow label="Sustainability boost" desc="Prioritize suppliers with ESG certifications" />
            <ToggleRow label="Auto-flag single-source" desc="Notify when a material has no qualified backup" defaultChecked />
          </Card>

          <Card title="Backend Integration">
            <Field label="API base URL" defaultValue="https://api.spheremaxxing.ai/v1" />
            <Field label="Webhook endpoint" defaultValue="https://hooks.yourcompany.com/spheremax" />
            <p className="text-xs text-muted-foreground pt-2">
              Frontend is structured to consume REST endpoints. Mock data layer in <code className="text-primary font-mono">src/lib/api.ts</code> can be swapped with live calls.
            </p>
          </Card>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 to-card p-5 shadow-card">
            <div className="text-[11px] uppercase tracking-[0.18em] text-primary mb-2">Current Plan</div>
            <div className="font-display text-2xl font-semibold">Enterprise</div>
            <div className="text-xs text-muted-foreground mt-1">Unlimited BOMs · Priority AI inference · SSO</div>
            <Button variant="outline" className="w-full mt-4 border-primary/30 bg-primary/5">Manage plan</Button>
          </div>
          <Card title="Danger Zone">
            <Button variant="destructive" className="w-full">Reset workspace data</Button>
          </Card>
        </div>
      </div>
    </div>
  );
};

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-5 shadow-card">
      <h3 className="font-display font-semibold mb-4">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, defaultValue }: { label: string; defaultValue: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      <Input defaultValue={defaultValue} className="bg-secondary/40 border-border/60" />
    </div>
  );
}

function ToggleRow({ label, desc, defaultChecked }: { label: string; desc: string; defaultChecked?: boolean }) {
  return (
    <div className="flex items-start justify-between py-2 border-t border-border/40 first:border-t-0 first:pt-0">
      <div className="pr-4">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
      </div>
      <Switch defaultChecked={defaultChecked} />
    </div>
  );
}

export default Settings;
