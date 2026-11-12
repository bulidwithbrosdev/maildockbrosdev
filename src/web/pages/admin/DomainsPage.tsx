import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  Check,
  CircleCheck,
  CircleDashed,
  CircleX,
  Ellipsis,
  ExternalLink,
  Globe,
  ImageUp,
  Layers,
  ListChecks,
  LoaderCircle,
  Lock,
  Plus,
  RefreshCw,
  RotateCw,
  Trash2,
  TriangleAlert,
  Wrench,
  X,
} from 'lucide-react';
import { del, get, patch, post, put, errorText } from '../../lib/api';
import { timeAgo } from '../../lib/format';
import { useAction, useInvalidate } from '../../lib/hooks';
import { cn } from '../../lib/utils';
import { PROVIDER_INFO } from '../../../shared/constants';
import type {
  DomainInfo,
  DomainSetupStep,
  MailboxAdmin,
  ProviderInfo,
  SenderLogo,
  SubdomainProvisionStatus,
  ZoneInspection,
} from '../../lib/types';
import { Button, IconButton } from '../../components/ui/button';
import { Checkbox, Field, Input, Select } from '../../components/ui/form';
import { Alert, Badge, Card, EmptyState, IconTile, PageHeader, PageSpinner, StatusPill } from '../../components/ui/misc';
import { ConfirmDialog, Dialog, Menu, MenuItem } from '../../components/ui/overlay';

export function DomainsPage() {
  const domains = useQuery({ queryKey: ['admin', 'domains'], queryFn: () => get<DomainInfo[]>('/admin/domains') });
  const mailboxes = useQuery({ queryKey: ['admin', 'mailboxes'], queryFn: () => get<MailboxAdmin[]>('/admin/mailboxes') });
  const providers = useQuery({ queryKey: ['admin', 'providers'], queryFn: () => get<ProviderInfo[]>('/admin/providers') });
  const [adding, setAdding] = useState(false);
  const [creatingSubdomain, setCreatingSubdomain] = useState(false);
  const [provisioningDomainId, setProvisioningDomainId] = useState<number | null>(null);
  const [domainFilter, setDomainFilter] = useState<'all' | 'root' | 'subdomain'>('all');

  const invalidate = useInvalidate();
  const refresh = () => invalidate(['admin', 'domains'], ['admin', 'overview'], ['admin', 'providers']);
  if (domains.isLoading) return <PageSpinner />;

  const allDomains = domains.data ?? [];
  const rootDomains = allDomains.filter((d) => d.kind !== 'subdomain');
  const subdomains = allDomains.filter((d) => d.kind === 'subdomain');
  const filtered = domainFilter === 'root' ? rootDomains : domainFilter === 'subdomain' ? subdomains : allDomains;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Domains"
        description="Root domains and subdomains in your Cloudflare account configured for Maildock email receiving, sending, and routing."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              icon={<Plus className="h-[15px] w-[15px]" />}
              onClick={() => setCreatingSubdomain(true)}
              disabled={rootDomains.length === 0}
            >
              Create Subdomain
            </Button>
            <Button variant="primary" icon={<Plus className="h-[15px] w-[15px]" />} onClick={() => setAdding(true)}>
              Add a domain
            </Button>
          </div>
        }
      />

      {allDomains.length > 0 && (
        <div className="flex items-center gap-1.5 border-b border-border pb-2">
          <button
            type="button"
            onClick={() => setDomainFilter('all')}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              domainFilter === 'all'
                ? 'bg-primary-soft font-semibold text-primary-text'
                : 'text-muted hover:bg-surface-2 hover:text-fg',
            )}
          >
            All domains ({allDomains.length})
          </button>
          <button
            type="button"
            onClick={() => setDomainFilter('root')}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              domainFilter === 'root'
                ? 'bg-primary-soft font-semibold text-primary-text'
                : 'text-muted hover:bg-surface-2 hover:text-fg',
            )}
          >
            Root domains ({rootDomains.length})
          </button>
          <button
            type="button"
            onClick={() => setDomainFilter('subdomain')}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              domainFilter === 'subdomain'
                ? 'bg-primary-soft font-semibold text-primary-text'
                : 'text-muted hover:bg-surface-2 hover:text-fg',
            )}
          >
            Subdomains ({subdomains.length})
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Globe />}
            title={allDomains.length === 0 ? 'No domains yet' : `No ${domainFilter === 'subdomain' ? 'subdomains' : 'root domains'} found`}
            action={
              allDomains.length === 0 ? (
                <Button variant="primary" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setAdding(true)}>
                  Add a domain
                </Button>
              ) : domainFilter === 'subdomain' && rootDomains.length > 0 ? (
                <Button variant="primary" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setCreatingSubdomain(true)}>
                  Create Subdomain
                </Button>
              ) : undefined
            }
          >
            {allDomains.length === 0
              ? 'Add a domain from your Cloudflare account to start receiving mail.'
              : domainFilter === 'subdomain'
                ? 'Create a subdomain under any of your verified root domains.'
                : 'No root domains match the filter.'}
          </EmptyState>
        </Card>
      ) : (
        filtered.map((d) => (
          <DomainCard
            key={d.id}
            domain={d}
            mailboxes={mailboxes.data ?? []}
            providers={providers.data ?? []}
            onChanged={refresh}
            onOpenProvisioning={(id) => setProvisioningDomainId(id)}
          />
        ))
      )}

      {adding && (
        <AddDomainDialog
          onClose={() => setAdding(false)}
          onAdded={() => {
            setAdding(false);
            refresh();
          }}
        />
      )}

      {creatingSubdomain && (
        <CreateSubdomainDialog
          domains={allDomains}
          onClose={() => setCreatingSubdomain(false)}
          onCreated={(newDomainId) => {
            setCreatingSubdomain(false);
            setProvisioningDomainId(newDomainId);
            refresh();
          }}
        />
      )}

      {provisioningDomainId !== null && (
        <SubdomainProvisioningDialog
          domainId={provisioningDomainId}
          onClose={() => setProvisioningDomainId(null)}
          onChanged={refresh}
        />
      )}
    </div>
  );
}

function StepList({ steps, running }: { steps: DomainSetupStep[]; running?: boolean }) {
  const active = steps.findIndex((s) => s.status !== 'done' && s.status !== 'skipped');
  return (
    <div className="flex flex-col">
      {steps.map((s, i) => {
        const state = s.status === 'done' || s.status === 'skipped' ? 'done' : s.status === 'error' ? 'err' : running && i === active ? 'run' : 'wait';
        const tile = { done: 'bg-success-soft text-success', err: 'bg-danger-soft text-danger', run: 'bg-primary-soft text-primary-text', wait: 'bg-surface-2 text-faint' }[state];
        return (
          <div key={s.id} className="relative flex gap-3 pb-3.5 last:pb-0">
            {i < steps.length - 1 && <span className="absolute top-[24px] bottom-0.5 left-[10.5px] w-px bg-border" />}
            <span className={cn('relative grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full [&>svg]:h-[13px] [&>svg]:w-[13px]', tile)}>
              {state === 'done' ? <Check /> : state === 'err' ? <X /> : state === 'run' ? <LoaderCircle className="animate-spin" /> : <CircleDashed />}
            </span>
            <div className="min-w-0 flex-1 pt-px leading-snug">
              <div className={cn('text-[13px]', state === 'run' || state === 'err' ? 'font-semibold' : 'font-[450]', state === 'wait' && 'text-faint')}>{s.label}</div>
              {s.message && <div className={cn('mt-0.5 text-xs break-words', state === 'err' ? 'text-danger' : 'text-muted')}>{s.message}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

async function runSteps(domainId: number, onSteps: (s: DomainSetupStep[]) => void, reset = false): Promise<{ done: boolean; error?: string; step?: string }> {
  for (let i = 0; i < 6; i++) {
    const r = await post<{ steps: DomainSetupStep[]; done: boolean }>(`/admin/domains/${domainId}/setup${i === 0 && reset ? '?reset=1' : ''}`);
    onSteps(r.steps);
    if (r.done) return { done: true };
    const failed = r.steps.find((s) => s.status === 'error');
    if (failed) return { done: false, error: failed.message, step: failed.label };
  }
  return { done: false };
}

function Status({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="flex items-center gap-[5px] whitespace-nowrap [&>svg]:h-[13px] [&>svg]:w-[13px]">
      {icon}
      {children}
    </span>
  );
}

function DomainCard({
  domain: d,
  mailboxes,
  providers,
  onChanged,
  onOpenProvisioning,
}: {
  domain: DomainInfo;
  mailboxes: MailboxAdmin[];
  providers: ProviderInfo[];
  onChanged: () => void;
  onOpenProvisioning?: (domainId: number) => void;
}) {
  const { run, busy } = useAction();
  const [steps, setSteps] = useState<DomainSetupStep[] | null>(null);
  const [running, setRunning] = useState(false);
  const [appDomain, setAppDomain] = useState(false);
  const [logoOpen, setLogoOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [showHealth, setShowHealth] = useState(false);
  const health = d.health;
  const shownSteps = steps ?? d.setup.steps;

  const finish = async () => {
    setRunning(true);
    try {
      await runSteps(d.id, setSteps);
    } finally {
      setRunning(false);
      onChanged();
    }
  };

  // Sending is verified per provider; the domain sends once any provider has verified it, or once a
  // provider that has no domain API (Cloudflare, SMTP) is connected.
  const sending = providers.flatMap((p) => p.domains.filter((x) => x.domainId === d.id));
  const noDomainApi = providers.some((p) => !PROVIDER_INFO[p.type].hasDomainApi);
  const sendState = sending.some((x) => x.status === 'verified') ? 'ok' : sending.some((x) => x.status === 'pending') ? 'pending' : noDomainApi ? 'ok' : 'off';
  const issues = health?.items.filter((h) => h.status !== 'ok') ?? [];
  const errors = issues.filter((h) => h.status === 'error');
  const tone = d.status === 'error' || errors.length ? 'danger' : !d.setup.done || d.status === 'pending' || issues.length ? 'warning' : d.status === 'active' ? 'success' : 'neutral';

  const isSubdomain = d.kind === 'subdomain';

  return (
    <Card className={cn(tone === 'warning' && 'border-[color-mix(in_oklch,var(--warning)_35%,var(--border))]', tone === 'danger' && 'border-[color-mix(in_oklch,var(--danger)_35%,var(--border))]')}>
      <div className="flex flex-wrap items-center gap-3.5 px-5 py-[18px]">
        <IconTile tone={tone} size={36}>
          {isSubdomain ? <Layers /> : <Globe />}
        </IconTile>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-[15px] font-semibold">{d.name}</span>
            {isSubdomain ? (
              <Badge tone="primary" pill>
                Subdomain
              </Badge>
            ) : (
              <Badge tone="neutral" pill>
                Root domain
              </Badge>
            )}
            {isSubdomain && d.parentDomainName && (
              <span className="text-xs text-muted">of {d.parentDomainName}</span>
            )}
            {isSubdomain && d.provisioningStatus && (
              <StatusPill
                tone={
                  d.provisioningStatus === 'completed'
                    ? 'success'
                    : d.provisioningStatus === 'in_progress'
                      ? 'primary'
                      : d.provisioningStatus === 'failed'
                        ? 'danger'
                        : 'warning'
                }
              >
                {d.provisioningStatus === 'completed'
                  ? 'Provisioned'
                  : d.provisioningStatus === 'in_progress'
                    ? 'Provisioning...'
                    : d.provisioningStatus === 'failed'
                      ? 'Provisioning Failed'
                      : 'Action Required'}
              </StatusPill>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-3.5 gap-y-1 text-[12px] text-muted">
            <Status icon={d.status === 'active' || d.receivingStatus === 'ready' ? <CircleCheck className="text-success" /> : d.status === 'error' || d.receivingStatus === 'error' ? <CircleX className="text-danger" /> : <CircleDashed className="text-warning" />}>
              Receiving: {d.status === 'active' || d.receivingStatus === 'ready' ? 'Ready' : d.status === 'error' || d.receivingStatus === 'error' ? 'Not receiving' : d.status === 'disabled' ? 'Disabled' : 'Pending'}
            </Status>
            <Status icon={sendState === 'ok' || d.sendingStatus === 'ready' ? <CircleCheck className="text-success" /> : sendState === 'pending' || d.sendingStatus === 'pending' ? <CircleDashed className="text-warning" /> : <CircleX className="text-faint" />}>
              Sending: {sendState === 'ok' || d.sendingStatus === 'ready' ? 'Ready' : sendState === 'pending' || d.sendingStatus === 'pending' ? 'Pending' : 'Off'}
            </Status>
            <Status icon={d.dnsStatus === 'verified' || !issues.length ? <CircleCheck className="text-success" /> : errors.length || d.dnsStatus === 'error' ? <CircleX className="text-danger" /> : <TriangleAlert className="text-warning" />}>
              DNS: {d.dnsStatus === 'verified' || !issues.length ? 'Verified' : errors.length || d.dnsStatus === 'error' ? 'Issues' : 'Pending'}
            </Status>
            {d.spfStatus && d.spfStatus !== 'pending' && (
              <Status icon={d.spfStatus === 'pass' ? <CircleCheck className="text-success" /> : d.spfStatus === 'fail' ? <CircleX className="text-danger" /> : <CircleDashed className="text-warning" />}>
                SPF: {d.spfStatus.toUpperCase()}
              </Status>
            )}
            {d.dkimStatus && d.dkimStatus !== 'pending' && (
              <Status icon={d.dkimStatus === 'pass' ? <CircleCheck className="text-success" /> : d.dkimStatus === 'fail' ? <CircleX className="text-danger" /> : <CircleDashed className="text-warning" />}>
                DKIM: {d.dkimStatus.toUpperCase()}
              </Status>
            )}
            {d.dmarcStatus && d.dmarcStatus !== 'pending' && (
              <Status icon={d.dmarcStatus === 'pass' ? <CircleCheck className="text-success" /> : d.dmarcStatus === 'fail' ? <CircleX className="text-danger" /> : <CircleDashed className="text-warning" />}>
                DMARC: {d.dmarcStatus.toUpperCase()}
              </Status>
            )}
            <span>
              {d.addresses} address{d.addresses === 1 ? '' : 'es'}
              {d.healthCheckedAt ? ` · checked ${timeAgo(d.healthCheckedAt)}` : ''}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {isSubdomain && (
            <Button size="xs" variant="secondary" icon={<Activity />} onClick={() => onOpenProvisioning?.(d.id)}>
              Provisioning
            </Button>
          )}
          <Button size="xs" icon={<ListChecks />} onClick={() => setShowHealth((s) => !s)} className={cn(showHealth && 'bg-surface-2')}>
            DNS records
          </Button>
          <Button size="xs" icon={<Wrench />} loading={busy === 'repair'} onClick={() => run('repair', () => post(`/admin/domains/${d.id}/repair`).then(onChanged), 'Repair finished')}>
            Repair
          </Button>
          <Menu trigger={({ onClick }) => <IconButton label="More" onClick={onClick} icon={<Ellipsis />} />}>
            {isSubdomain && (
              <MenuItem icon={<Activity />} onClick={() => onOpenProvisioning?.(d.id)}>
                Provisioning dashboard
              </MenuItem>
            )}
            <MenuItem icon={<RefreshCw />} onClick={() => run('check', () => post(`/admin/domains/${d.id}/check`).then(onChanged), 'Checked')}>
              Check health now
            </MenuItem>
            <MenuItem icon={<Trash2 />} danger disabled={d.addresses > 0} onClick={() => setRemoving(true)}>
              {d.addresses > 0 ? 'Remove (delete its inboxes first)' : 'Remove domain'}
            </MenuItem>
          </Menu>
        </div>
      </div>

      {isSubdomain && d.provisioningStatus === 'in_progress' && (
        <div className="mx-5 mb-[18px] flex items-center justify-between gap-3 rounded-lg bg-primary-soft px-3.5 py-2.5 text-[12.5px] text-primary-text">
          <div className="flex items-center gap-2">
            <LoaderCircle className="h-4 w-4 shrink-0 animate-spin" />
            <span>Automatic provisioning in progress...</span>
          </div>
          <Button size="xs" variant="secondary" onClick={() => onOpenProvisioning?.(d.id)}>
            Track Progress
          </Button>
        </div>
      )}

      {isSubdomain && d.provisioningStatus === 'failed' && (
        <div className="mx-5 mb-[18px] flex items-center justify-between gap-3 rounded-lg bg-danger-soft px-3.5 py-2.5 text-[12.5px] text-danger">
          <div className="flex items-center gap-2">
            <CircleX className="h-4 w-4 shrink-0" />
            <span>Provisioning encountered errors.</span>
          </div>
          <Button size="xs" variant="secondary" onClick={() => onOpenProvisioning?.(d.id)}>
            View Dashboard & Retry
          </Button>
        </div>
      )}

      {!d.setup.done && (
        <div className="mx-5 mb-[18px] flex flex-col gap-3 rounded-lg bg-warning-soft px-3.5 py-3">
          <div className="flex items-start gap-2.5 text-[12.5px]">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
            <span className="flex-1">
              <b className="font-semibold">Setup isn't finished.</b> You can re-run or repair setup from this page at any time.
            </span>
            <Button size="xs" variant="primary" icon={<RotateCw />} loading={running} onClick={finish}>
              Re-run setup
            </Button>
          </div>
          <div className="rounded-lg bg-surface px-3.5 py-3">
            <StepList steps={shownSteps} running={running} />
          </div>
        </div>
      )}

      {showHealth && (
        <div className="mx-5 mb-[18px] overflow-hidden rounded-lg border border-border">
          {health?.items?.length ? (
            health.items.map((h) => (
              <div key={h.key} className="flex gap-2.5 border-b border-border px-3.5 py-2.5 last:border-b-0">
                {h.status === 'ok' ? <CircleCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" /> : h.status === 'warn' ? <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" /> : <CircleX className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" />}
                <div className="min-w-0">
                  <div className="text-[13px] font-medium">{h.label}</div>
                  <div className="text-xs break-words text-muted">{h.detail}</div>
                </div>
              </div>
            ))
          ) : (
            <div className="flex items-center justify-between gap-3 px-3.5 py-3 text-[13px] text-muted">
              Not checked yet.
              <Button size="xs" loading={busy === 'check'} onClick={() => run('check', () => post(`/admin/domains/${d.id}/check`).then(onChanged))}>
                Check now
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-x-6 gap-y-[18px] border-t border-border px-5 pt-[18px] pb-5 md:grid-cols-2">
        <Field label="Send through" hint="Others are used as fallbacks when it reaches its limit.">
          <Select value={d.providerId ?? ''} onChange={(e) => run('provider', () => patch(`/admin/domains/${d.id}`, { providerId: e.target.value ? Number(e.target.value) : null }).then(onChanged), 'Saved')}>
            <option value="">The default provider</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Catch-all" hint="Mail to addresses that don't exist goes here instead of being rejected. Catch-alls attract spam.">
          <Select
            value={d.catchAllMailboxId ?? ''}
            onChange={(e) => run('catchall', () => patch(`/admin/domains/${d.id}`, { catchAllMailboxId: e.target.value ? Number(e.target.value) : null }).then(onChanged), 'Catch-all updated')}
          >
            <option value="">Off: reject unknown addresses</option>
            {mailboxes.map((m) => (
              <option key={m.id} value={m.id}>
                Deliver to {m.address}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Use your own address for the web app" hint="Cloudflare creates the DNS record and certificate. The workers.dev address keeps working.">
          {d.appHostname ? (
            <div className="flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-[13px]">
              <a href={`https://${d.appHostname}`} target="_blank" rel="noreferrer" className="flex min-w-0 flex-1 items-center gap-1.5 truncate hover:underline">
                {d.appHostname}
                <ExternalLink className="h-3 w-3 shrink-0 text-faint" />
              </a>
              <span className="flex items-center gap-[5px] text-xs font-medium text-success">
                <Lock className="h-3 w-3" />
                Active
              </span>
            </div>
          ) : (
            <div>
              <Button size="sm" onClick={() => setAppDomain(true)}>
                Use mail.{d.name}
              </Button>
            </div>
          )}
        </Field>
        <Field label="Sender logo" hint="Shown next to your mail in mail apps that support BIMI.">
          <div className="flex items-center gap-2.5">
            {d.logoUpdatedAt && <img src={`/api/bimi/${d.name}/logo-${d.logoUpdatedAt}.svg`} alt="" className="h-9 w-9 rounded-md border border-border bg-white object-contain" />}
            <Button size="sm" icon={d.logoUpdatedAt ? undefined : <ImageUp />} onClick={() => setLogoOpen(true)}>
              {d.logoUpdatedAt ? 'Change' : 'Add a logo'}
            </Button>
          </div>
        </Field>
        <Field label="Addresses that bypass Maildock" hint="Mail to these keeps going to its existing Email Routing rule.">
          {health?.conflicts?.length ? (
            <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-lg border border-border px-2 py-[5px]">
              {health.conflicts.map((c) => (
                <span key={c.address} title={`${c.address} → ${c.action}`} className="inline-flex h-6 items-center gap-[5px] rounded-md bg-surface-2 pr-1 pl-2 text-[12.5px]">
                  {c.address}
                  <button
                    type="button"
                    aria-label={`Send ${c.address} to Maildock`}
                    title="Disable this rule so mail comes to Maildock"
                    className="grid h-4 w-4 place-items-center rounded text-faint hover:text-fg"
                    onClick={() => run('rule', () => post(`/admin/domains/${d.id}/disable-rule`, { address: c.address }).then(() => post(`/admin/domains/${d.id}/check`)).then(onChanged), 'Rule disabled')}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <div className="flex h-9 items-center rounded-lg border border-dashed border-border px-3 text-[13px] text-faint">None</div>
          )}
        </Field>
      </div>
      {logoOpen && (
        <SenderLogoDialog
          domain={d}
          onClose={() => {
            setLogoOpen(false);
            onChanged();
          }}
        />
      )}
      {appDomain && (
        <AppDomainDialog
          domain={d}
          onClose={() => setAppDomain(false)}
          onDone={() => {
            setAppDomain(false);
            onChanged();
          }}
        />
      )}
      <ConfirmDialog
        open={removing}
        danger
        icon={<Trash2 />}
        onClose={() => setRemoving(false)}
        title={`Remove ${d.name}?`}
        confirmLabel="Remove domain"
        loading={busy === 'remove'}
        onConfirm={() =>
          run(
            'remove',
            () =>
              del(`/admin/domains/${d.id}`).then(() => {
                setRemoving(false);
                onChanged();
              }),
            'Domain removed',
          )
        }
      >
        Maildock turns off its catch-all rule for this domain. Email Routing and DNS records stay as they are.
      </ConfirmDialog>
    </Card>
  );
}

const readFile = (f: File) => f.text();

// BIMI: the domain's logo, its optional mark certificate, and what still keeps mail apps from
// showing it.
function SenderLogoDialog({ domain, onClose }: { domain: DomainInfo; onClose: () => void }) {
  const status = useQuery({ queryKey: ['admin', 'logo', domain.id], queryFn: () => get<SenderLogo>(`/admin/domains/${domain.id}/logo`) });
  const [svg, setSvg] = useState<{ name: string; text: string; preview: string } | null>(null);
  // undefined keeps the stored certificate, null removes it.
  const [cert, setCert] = useState<{ name: string; text: string } | null | undefined>(undefined);
  const [error, setError] = useState('');
  const svgInput = useRef<HTMLInputElement>(null);
  const certInput = useRef<HTMLInputElement>(null);
  const { run, busy } = useAction();
  const invalidate = useInvalidate();
  const [enforcing, setEnforcing] = useState(false);
  const s = status.data;
  const preview = svg?.preview ?? s?.logo?.url;
  const refresh = () => invalidate(['admin', 'logo', domain.id]);
  // One click for each problem the checks find. The record is written again as Save does.
  const rewriteRecord = () => put(`/admin/domains/${domain.id}/logo`, {});
  const enforceDmarc = () =>
    run(
      'dmarc',
      async () => {
        await post(`/admin/domains/${domain.id}/dmarc/enforce`);
        setEnforcing(false);
        await refresh();
      },
      'DMARC enforced',
    );
  // Only when this page itself is served over HTTPS: that address is known to work.
  const httpsOrigin = location.protocol === 'https:' ? location.origin : null;
  const switchToHttps = () =>
    run(
      'https',
      async () => {
        await patch('/admin/settings', { appUrl: httpsOrigin });
        if (s?.logo) await rewriteRecord();
        await refresh();
      },
      `App address set to ${httpsOrigin}`,
    );
  const hasCert = cert === undefined ? !!s?.logo?.certificateUrl : !!cert;

  useEffect(() => () => (svg ? URL.revokeObjectURL(svg.preview) : undefined), [svg]);

  const takeSvg = (name: string, text: string) => setSvg({ name, text, preview: URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' })) });
  const pickSvg = async (f: File | undefined) => {
    if (f) takeSvg(f.name, await readFile(f));
  };
  // A logo at an address: the server fetches and checks it; Save then stores it like a file.
  const [logoUrl, setLogoUrl] = useState('');
  const loadUrl = () =>
    run('url', async () => {
      setError('');
      try {
        const r = await post<{ svg: string }>(`/admin/domains/${domain.id}/logo/fetch`, { url: logoUrl.trim() });
        takeSvg(logoUrl.trim(), r.svg);
        setLogoUrl('');
      } catch (e) {
        setError(errorText(e));
      }
    });
  const save = () =>
    run('save', async () => {
      setError('');
      try {
        await put(`/admin/domains/${domain.id}/logo`, { ...(svg ? { svg: svg.text } : {}), ...(cert !== undefined ? { certificate: cert?.text ?? null } : {}) });
        onClose();
      } catch (e) {
        setError(errorText(e));
      }
    });

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Sender logo for ${domain.name}`}
      description="Mail apps that support BIMI, such as Yahoo Mail, show this logo next to your mail once they trust your domain's sending. Gmail and Apple Mail also require a mark certificate (VMC or CMC) from a certificate authority."
      footerStart={
        s?.logo ? (
          <Button variant="ghost" icon={<Trash2 />} loading={busy === 'remove'} onClick={() => run('remove', () => del(`/admin/domains/${domain.id}/logo`).then(onClose), 'Logo removed')}>
            Remove
          </Button>
        ) : undefined
      }
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={busy === 'save'} disabled={!svg && cert === undefined} onClick={save}>
            Save
          </Button>
        </>
      }
    >
      {status.isLoading ? (
        <PageSpinner />
      ) : (
        <div className="flex flex-col gap-4">
          {status.error ? <Alert tone="danger">{errorText(status.error)}</Alert> : null}
          {error && <Alert tone="danger">{error}</Alert>}
          <div className="flex items-center gap-3.5">
            <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-white">
              {preview ? <img src={preview} alt="Logo preview" className="h-full w-full object-contain" /> : <ImageUp className="h-5 w-5 text-faint" />}
            </div>
            <div className="min-w-0 flex-1 text-[12.5px] text-muted">
              A square SVG in the <b className="font-medium text-fg">SVG Tiny PS</b> profile, under 32 KB, with a title. Most design tools export plain SVG; convert it with a BIMI SVG converter first.
              {svg && <div className="mt-1 truncate text-fg">{svg.name}</div>}
            </div>
            <Button size="sm" onClick={() => svgInput.current?.click()}>
              {preview ? 'Replace' : 'Choose SVG'}
            </Button>
            <input ref={svgInput} type="file" accept=".svg,image/svg+xml" className="hidden" onChange={(e) => pickSvg(e.target.files?.[0])} />
          </div>
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (logoUrl.trim()) loadUrl();
            }}
          >
            <Input type="url" aria-label="Logo address" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="Or load it from an address: https://example.com/logo.svg" className="flex-1" />
            <Button size="sm" type="submit" loading={busy === 'url'} disabled={!logoUrl.trim()}>
              Load
            </Button>
          </form>
          <div className="flex items-center gap-3 rounded-lg border border-border px-3.5 py-2.5 text-[12.5px]">
            <span className="min-w-0 flex-1 text-muted">
              <b className="font-medium text-fg">Mark certificate</b> (optional): the .pem file of your VMC or CMC.
              {hasCert && <span className="ml-1 text-fg">{cert ? cert.name : 'On file.'}</span>}
            </span>
            {hasCert && (
              <Button size="xs" variant="ghost" onClick={() => setCert(null)}>
                Remove
              </Button>
            )}
            <Button size="xs" onClick={() => certInput.current?.click()}>
              {hasCert ? 'Replace' : 'Add'}
            </Button>
            <input
              ref={certInput}
              type="file"
              accept=".pem,.crt,application/x-pem-file"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) setCert({ name: f.name, text: await readFile(f) });
              }}
            />
          </div>
          {s && (
            <div className="overflow-hidden rounded-lg border border-border">
              <LogoCheck
                ok={s.dmarc.enforced}
                label={s.dmarc.enforced ? 'DMARC is enforced' : "DMARC isn't enforced"}
                action={
                  !s.dmarc.enforced &&
                  !enforcing && (
                    <Button size="xs" icon={<Wrench />} onClick={() => setEnforcing(true)}>
                      Fix
                    </Button>
                  )
                }
              >
                {s.dmarc.enforced
                  ? s.dmarc.record
                  : `Mail apps show the logo only under p=quarantine or p=reject. ${s.dmarc.record ? `It is ${s.dmarc.record}.` : 'There is no DMARC record.'}`}
                {enforcing && s.dmarc.fix && (
                  <div className="mt-2 flex flex-col gap-2 rounded-md border border-border bg-surface-2 p-2.5">
                    <div>
                      _dmarc.{domain.name} becomes <span className="font-mono text-fg">{s.dmarc.fix}</span>
                    </div>
                    <div>
                      Mail that fails DMARC then goes to spam. First check that everything sending as {domain.name} passes it: Maildock&apos;s providers and any other service, such as a newsletter tool.
                      {s.dmarc.record && /rua=/i.test(s.dmarc.record) ? ' The DMARC reports your record already asks for show which mail passes.' : ''}
                    </div>
                    <div className="flex gap-2">
                      <Button size="xs" variant="primary" loading={busy === 'dmarc'} onClick={enforceDmarc}>
                        Enforce DMARC
                      </Button>
                      <Button size="xs" variant="ghost" onClick={() => setEnforcing(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </LogoCheck>
              <LogoCheck
                ok={s.https}
                label={s.https ? 'Served over HTTPS' : 'Not served over HTTPS'}
                action={
                  !s.https &&
                  httpsOrigin && (
                    <Button size="xs" icon={<Wrench />} loading={busy === 'https'} onClick={switchToHttps}>
                      Fix
                    </Button>
                  )
                }
              >
                {s.https
                  ? (s.logo?.url ?? 'From this app’s address.')
                  : httpsOrigin
                    ? `Mail apps fetch logos over HTTPS only. Fix sets the app’s address to ${httpsOrigin}.`
                    : 'Mail apps fetch logos over HTTPS only. Set the app’s https address in Admin → Settings.'}
              </LogoCheck>
              {s.logo && (
                <LogoCheck
                  ok={s.record.current === s.record.expected}
                  label={s.record.current === s.record.expected ? `${s.record.name} is in place` : `${s.record.name} doesn't match`}
                  action={
                    s.record.current !== s.record.expected && (
                      <Button size="xs" icon={<Wrench />} loading={busy === 'record'} onClick={() => run('record', () => rewriteRecord().then(refresh), `${s.record.name} rewritten`)}>
                        Fix
                      </Button>
                    )
                  }
                >
                  {s.record.current === s.record.expected ? s.record.current : `Expected ${s.record.expected}, found ${s.record.current ?? 'none'}.`}
                </LogoCheck>
              )}
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}

function LogoCheck({ ok, label, action, children }: { ok: boolean; label: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex gap-2.5 border-b border-border px-3.5 py-2.5 last:border-b-0">
      {ok ? <CircleCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" /> : <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />}
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium">{label}</div>
        <div className="text-xs break-words text-muted">{children}</div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

function AppDomainDialog({ domain, onClose, onDone }: { domain: DomainInfo; onClose: () => void; onDone: () => void }) {
  const [sub, setSub] = useState('mail');
  const [result, setResult] = useState<string | null>(null);
  const { run, busy } = useAction();
  return (
    <Dialog
      open
      onClose={result ? onDone : onClose}
      title="Use your own address for the web app"
      description="Cloudflare creates the DNS record and certificate. The workers.dev address keeps working."
      footer={
        result ? (
          <Button variant="primary" onClick={onDone}>
            Done
          </Button>
        ) : (
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" loading={!!busy} onClick={() => run('attach', async () => setResult((await post<{ url: string }>(`/admin/domains/${domain.id}/app-domain`, { subdomain: sub })).url))}>
              Attach
            </Button>
          </>
        )
      }
    >
      {result ? (
        <Alert tone="success" title="Attached">
          Maildock will answer at{' '}
          <a href={result} className="font-medium underline" target="_blank" rel="noreferrer">
            {result}
          </a>{' '}
          within a minute or two, once Cloudflare issues the certificate. Sign in again there (sessions are per address).
        </Alert>
      ) : (
        <Field label="Address">
          <div className="flex h-9 overflow-hidden rounded-lg border border-border text-[13px] focus-within:border-primary focus-within:ring-3 focus-within:ring-[var(--ring)]">
            <input className="min-w-0 flex-1 bg-surface px-3 outline-none" value={sub} onChange={(e) => setSub(e.target.value.trim())} aria-label="Subdomain" />
            <span className="flex items-center border-l border-border bg-surface-2 px-3 text-muted">.{domain.name}</span>
          </div>
        </Field>
      )}
    </Dialog>
  );
}

function AddDomainDialog({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const zones = useQuery({ queryKey: ['admin', 'zones'], queryFn: () => get<{ id: string; name: string; status: string; connected: boolean; usable: boolean | null }[]>('/admin/zones') });
  const all = zones.data ?? [];
  const available = all.filter((z) => !z.connected && z.usable !== false);
  const [zoneId, setZoneId] = useState('');
  const [replaceMx, setReplaceMx] = useState(false);
  const [domainId, setDomainId] = useState<number | null>(null);
  const [steps, setSteps] = useState<DomainSetupStep[] | null>(null);
  const [error, setError] = useState<{ message: string; step?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!zoneId && available[0]) setZoneId(available[0].id);
  }, [available, zoneId]);
  const inspection = useQuery({ queryKey: ['admin', 'zone', zoneId], queryFn: () => get<ZoneInspection>(`/admin/zones/${zoneId}`), enabled: !!zoneId && !steps });
  const mx = inspection.data;
  const zone = all.find((z) => z.id === zoneId);

  const setup = async (id: number) => {
    setBusy(true);
    setError(null);
    try {
      const r = await runSteps(id, setSteps);
      if (r.done) setDone(true);
      else if (r.error) setError({ message: r.error, step: r.step });
    } catch (e) {
      setError({ message: errorText(e) });
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    setBusy(true);
    setError(null);
    try {
      const { id } = await post<{ id: number }>('/admin/domains', { zoneId, replaceMx });
      setDomainId(id);
      await setup(id);
    } catch (e) {
      setError({ message: errorText(e) });
      setBusy(false);
    }
  };

  if (steps)
    return (
      <Dialog
        open
        onClose={onAdded}
        title={done ? `${zone?.name ?? 'The domain'} is ready` : `Setting up ${zone?.name ?? 'the domain'}`}
        description={done ? 'Mail for this domain now arrives in Maildock. Create inboxes for it on the Inboxes page.' : 'Keep this open. It takes about 30 seconds.'}
        footer={
          <Button variant="primary" onClick={onAdded} disabled={busy}>
            {done ? 'Done' : 'Close'}
          </Button>
        }
      >
        <StepList steps={steps} running={busy} />
        {error && (
          <div className="mt-4 flex items-center gap-2.5 rounded-lg bg-danger-soft px-3 py-2.5 text-[12.5px]">
            <CircleX className="h-[15px] w-[15px] shrink-0 text-danger" />
            <span className="min-w-0 flex-1">
              <b className="font-semibold">Setup stopped</b>
              {error.step ? ` at “${error.step}”` : ''}. {error.message}
            </span>
            {domainId && (
              <Button size="xs" icon={<RotateCw />} onClick={() => setup(domainId)}>
                Retry
              </Button>
            )}
          </div>
        )}
      </Dialog>
    );

  return (
    <Dialog
      open
      onClose={onClose}
      title="Add a domain"
      description="Pick one of the zones on your Cloudflare account. Maildock turns on Email Routing, routes its mail here and adds DMARC if it's missing."
      footer={
        available.length ? (
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" loading={busy} disabled={!zoneId || (mx?.mxState === 'other' && !replaceMx)} onClick={add}>
              Set up {zone?.name ?? 'domain'}
            </Button>
          </>
        ) : (
          <Button onClick={onClose}>Close</Button>
        )
      }
    >
      {zones.isLoading ? (
        <PageSpinner />
      ) : available.length === 0 ? (
        <EmptyState icon={<Globe />} tone="warning" title="No more domains">
          {all.some((z) => !z.connected)
            ? `The Cloudflare token can't manage ${all.filter((z) => !z.connected).map((z) => z.name).join(', ')}. Add ${all.filter((z) => !z.connected).length === 1 ? 'it' : 'them'} to the token's zone resources in Cloudflare, then come back.`
            : 'Every zone on this Cloudflare account is already connected. Add a new domain to Cloudflare first, then come back.'}
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-2">
          {error && <Alert tone="danger">{error.message}</Alert>}
          {all.map((z) => {
            const on = z.id === zoneId;
            const desc = z.connected ? 'Already set up' : z.usable === false ? "The Cloudflare token can't manage this domain. Add it to the token's zone resources." : on ? (inspection.isLoading ? 'Checking mail records…' : mx?.mxState === 'none' ? 'This domain does not receive mail yet.' : mx?.mxState === 'cloudflare' ? 'Email Routing is already on for this domain.' : mx?.mxState === 'other' ? `MX points to ${mx.mx[0]?.host}` : '') : '';
            return (
              <button
                key={z.id}
                type="button"
                disabled={z.connected || z.usable === false}
                onClick={() => {
                  setZoneId(z.id);
                  setReplaceMx(false);
                }}
                className={cn('flex items-center gap-3 rounded-[10px] border px-3.5 py-3 text-left transition-colors disabled:opacity-50', on ? 'border-primary bg-primary-soft' : 'border-border enabled:hover:bg-surface-2')}
              >
                <span className={cn('h-4 w-4 shrink-0 rounded-full', on ? 'border-[5px] border-primary' : 'border-[1.5px] border-border-strong')} />
                <span className="min-w-0 flex-1 leading-snug">
                  <span className="block text-[13.5px] font-medium">{z.name}</span>
                  {desc && <span className="block truncate text-xs text-muted">{desc}</span>}
                </span>
                {on && mx?.mxState === 'other' && <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[11.5px] font-medium text-warning">MX elsewhere</span>}
              </button>
            );
          })}
          {mx?.mxState === 'other' && (
            <div className="mt-2 flex flex-col gap-3 rounded-[10px] border border-[color-mix(in_oklch,var(--warning)_35%,var(--border))] p-3.5">
              <div className="text-[13px]">
                <b className="font-semibold text-warning">This domain receives mail elsewhere.</b> <span className="text-muted">Mail keeps going there until you replace these MX records.</span>
              </div>
              <div className="overflow-hidden rounded-lg border border-border font-mono text-[12.5px]">
                <div className="grid grid-cols-[60px_70px_1fr] bg-surface-2 px-3 py-2 font-sans text-xs font-medium text-faint">
                  <span>Type</span>
                  <span>Priority</span>
                  <span>Value</span>
                </div>
                {mx.mx.map((r) => (
                  <div key={r.host} className="grid grid-cols-[60px_70px_1fr] border-t border-border px-3 py-2">
                    <span>MX</span>
                    <span>{r.priority ?? '–'}</span>
                    <span className="truncate">{r.host}</span>
                  </div>
                ))}
              </div>
              <Checkbox checked={replaceMx} onChange={setReplaceMx} label="Replace them and move this domain's mail to Maildock" />
            </div>
          )}
          {!!mx?.conflicts.length && <Alert tone="neutral">{mx.conflicts.map((c) => c.address).join(', ')} have their own routing rules and will bypass Maildock until disabled.</Alert>}
          <p className="mt-1 text-xs text-faint">You can re-run or repair setup from this page at any time.</p>
        </div>
      )}
    </Dialog>
  );
}

function CreateSubdomainDialog({
  domains,
  onClose,
  onCreated,
}: {
  domains: DomainInfo[];
  onClose: () => void;
  onCreated: (domainId: number) => void;
}) {
  const rootDomains = domains.filter((d) => d.kind !== 'subdomain');
  const [parentDomainId, setParentDomainId] = useState<number>(rootDomains[0]?.id ?? 0);
  const [subdomain, setSubdomain] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parentDomain = rootDomains.find((d) => d.id === parentDomainId) ?? rootDomains[0];
  const cleanSub = subdomain.trim().toLowerCase();
  const fqdn = parentDomain && cleanSub ? `${cleanSub}.${parentDomain.name.toLowerCase()}` : '';

  // Validation
  const isValidFormat = !cleanSub || /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/i.test(cleanSub);
  const alreadyExists = fqdn ? domains.some((d) => d.name.toLowerCase() === fqdn) : false;

  let validationMsg: string | null = null;
  let isValid = false;
  if (!cleanSub) {
    validationMsg = 'Enter a subdomain name (e.g. mail, support, team).';
  } else if (!isValidFormat) {
    validationMsg = 'Only letters, numbers, and dashes are allowed. Cannot start or end with a dash.';
  } else if (alreadyExists) {
    validationMsg = `Domain "${fqdn}" is already registered.`;
  } else if (!parentDomain) {
    validationMsg = 'Please select a parent domain.';
  } else {
    isValid = true;
  }

  const handleCreate = async () => {
    if (!isValid || !parentDomain) return;
    setBusy(true);
    setError(null);
    try {
      const res = await post<{ domainId: number; name: string; status: SubdomainProvisionStatus }>(
        '/admin/domains/subdomain',
        {
          parentDomainId: parentDomain.id,
          subdomain: cleanSub,
        },
      );
      onCreated(res.domainId);
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Create Subdomain"
      description="Create a dedicated subdomain under an authorized root domain. Maildock automatically provisions Cloudflare DNS, Email Routing, and Worker bindings."
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} disabled={!isValid || busy} onClick={handleCreate}>
            Create Subdomain
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <Alert tone="danger">{error}</Alert>}

        <Field label="Parent Domain" hint="Select the verified root domain to attach this subdomain to.">
          <Select
            value={parentDomainId}
            onChange={(e) => setParentDomainId(Number(e.target.value))}
            disabled={busy || rootDomains.length === 0}
          >
            {rootDomains.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} {d.status === 'active' ? '(Active)' : `(${d.status})`}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Subdomain Name" hint="Subdomain prefix without trailing dots (e.g. mail, support, team).">
          <div className="flex h-9 overflow-hidden rounded-lg border border-border text-[13px] focus-within:border-primary focus-within:ring-3 focus-within:ring-[var(--ring)]">
            <input
              className="min-w-0 flex-1 bg-surface px-3 outline-none"
              placeholder="mail"
              value={subdomain}
              onChange={(e) => setSubdomain(e.target.value)}
              disabled={busy}
              autoFocus
            />
            <span className="flex items-center border-l border-border bg-surface-2 px-3 text-muted">
              .{parentDomain?.name ?? 'domain'}
            </span>
          </div>
        </Field>

        {/* Live hostname preview & availability */}
        <div className="rounded-lg border border-border bg-surface-2 p-3 text-[13px]">
          <div className="text-xs font-medium text-faint">Generated Hostname</div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="font-mono font-semibold text-fg">
              {fqdn || `[subdomain].${parentDomain?.name ?? 'example.com'}`}
            </span>
            {cleanSub && (
              <span
                className={cn(
                  'flex items-center gap-1 text-xs font-medium',
                  isValid ? 'text-success' : 'text-danger',
                )}
              >
                {isValid ? <CircleCheck className="h-3.5 w-3.5" /> : <CircleX className="h-3.5 w-3.5" />}
                {isValid ? 'Available' : 'Unavailable'}
              </span>
            )}
          </div>
          {validationMsg && (
            <div className={cn('mt-1.5 text-xs', isValid ? 'text-muted' : 'text-danger')}>
              {validationMsg}
            </div>
          )}
        </div>

        {/* Configuration Preview */}
        <div className="rounded-lg border border-border p-3.5 text-[12.5px]">
          <div className="font-medium text-fg">Cloudflare Automated Configuration Preview:</div>
          <div className="mt-2.5 flex flex-col gap-2 text-muted">
            <div className="flex items-start gap-2">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
              <span>
                <b className="text-fg">Cloudflare Zone:</b> {parentDomain?.name} (Zone ID: {parentDomain?.zoneId})
              </span>
            </div>
            <div className="flex items-start gap-2">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
              <span>
                <b className="text-fg">Worker Custom Hostname:</b> {fqdn || `subdomain.${parentDomain?.name}`}
              </span>
            </div>
            <div className="flex items-start gap-2">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
              <span>
                <b className="text-fg">Inbound Email Routing:</b> Configures zone Email Routing catch-all to Maildock Worker
              </span>
            </div>
            <div className="flex items-start gap-2">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
              <span>
                <b className="text-fg">DNS MX Records:</b> route1/2/3.mx.cloudflare.net (Priorities: 47, 58, 80)
              </span>
            </div>
            <div className="flex items-start gap-2">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
              <span>
                <b className="text-fg">SPF & DMARC:</b> v=spf1 include:_spf.mx.cloudflare.net ~all & v=DMARC1; p=none
              </span>
            </div>
            <div className="flex items-start gap-2">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
              <span>
                <b className="text-fg">Outbound Sending:</b> Outbound provider domain registration & DKIM alignment
              </span>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

const PROVISIONING_STAGES: { id: string; label: string; desc: string }[] = [
  { id: 'cloudflare_access', label: 'Cloudflare Account & Zone Access', desc: 'Validates API credentials and parent zone ownership.' },
  { id: 'worker_hostname', label: 'Worker Custom Hostname', desc: 'Binds subdomain hostname to the Maildock receiving Worker.' },
  { id: 'email_routing', label: 'Cloudflare Email Routing', desc: 'Enables Email Routing service for the subdomain zone.' },
  { id: 'inbound_worker', label: 'Inbound Worker Catch-All', desc: 'Directs all incoming email to Maildock Worker.' },
  { id: 'dns_records', label: 'DNS Configuration (MX, SPF, DMARC)', desc: 'Creates required MX, SPF, and DMARC DNS records.' },
  { id: 'outbound_sending', label: 'Outbound Sending Provider', desc: 'Registers subdomain with connected outbound email provider.' },
  { id: 'verify_records', label: 'SPF, DKIM & DMARC Verification', desc: 'Performs live DNS and email deliverability checks.' },
  { id: 'final_verification', label: 'Final Verification & Activation', desc: 'Finalizes subdomain status and enables mailboxes.' },
];

function SubdomainProvisioningDialog({
  domainId,
  onClose,
  onChanged,
}: {
  domainId: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const query = useQuery({
    queryKey: ['admin', 'subdomain', 'provision', domainId],
    queryFn: () => get<SubdomainProvisionStatus>(`/admin/domains/${domainId}/provision`),
    refetchInterval: (q) => (q.state.data?.provisioningStatus === 'in_progress' ? 1500 : false),
  });

  const { run, busy } = useAction();
  const [activeTab, setActiveTab] = useState<'steps' | 'logs'>('steps');

  const status = query.data;
  const inProgress = status?.provisioningStatus === 'in_progress';
  const isCompleted = status?.provisioningStatus === 'completed';
  const isFailed = status?.provisioningStatus === 'failed';
  const isRequiresAction = status?.provisioningStatus === 'requires_action';

  const retry = () =>
    run('retry', async () => {
      await post(`/admin/domains/${domainId}/provision`);
      await query.refetch();
      onChanged();
    });

  const getStageState = (stageId: string, index: number) => {
    if (!status) return 'wait';
    const stageLogs = status.logs.filter((l) => l.stage === stageId);
    if (stageLogs.some((l) => !l.ok)) return 'err';
    if (stageLogs.length > 0) {
      if (inProgress && index === getActiveStageIndex()) return 'run';
      return 'done';
    }
    if (isCompleted) return 'done';
    if (inProgress && index === getActiveStageIndex()) return 'run';
    return 'wait';
  };

  const getActiveStageIndex = () => {
    if (!status || !inProgress) return -1;
    if (status.logs.length === 0) return 0;
    const latestStage = status.logs[status.logs.length - 1].stage;
    const idx = PROVISIONING_STAGES.findIndex((s) => s.id === latestStage);
    return idx >= 0 ? Math.min(idx + 1, PROVISIONING_STAGES.length - 1) : 0;
  };

  return (
    <Dialog
      open
      onClose={() => {
        onClose();
        onChanged();
      }}
      title={`Subdomain Provisioning: ${status?.name ?? 'Loading...'}`}
      description="Live automated provisioning of Cloudflare DNS, Email Routing, and Worker infrastructure."
      footer={
        <div className="flex w-full items-center justify-between">
          <div>
            {(isFailed || isRequiresAction) && (
              <Button
                variant="secondary"
                icon={<RotateCw className="h-3.5 w-3.5" />}
                loading={busy === 'retry'}
                onClick={retry}
              >
                Retry Provisioning
              </Button>
            )}
          </div>
          <Button
            variant="primary"
            onClick={() => {
              onClose();
              onChanged();
            }}
          >
            {isCompleted ? 'Done' : 'Close'}
          </Button>
        </div>
      }
    >
      {query.isLoading ? (
        <PageSpinner />
      ) : !status ? (
        <Alert tone="danger">Failed to load provisioning status.</Alert>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Status banner */}
          {isCompleted && (
            <Alert tone="success" title="Provisioning Completed">
              Subdomain <b>{status.name}</b> is active! Inbound email routing to Maildock and outbound sending are configured and verified.
            </Alert>
          )}
          {inProgress && (
            <Alert tone="primary" title="Provisioning in Progress">
              Maildock is automatically configuring Cloudflare DNS, Email Routing, and Worker bindings. This usually takes 15–30 seconds.
            </Alert>
          )}
          {isFailed && (
            <Alert tone="danger" title="Provisioning Failed">
              An error occurred during automated provisioning. Review the configuration logs below and click Retry.
            </Alert>
          )}
          {isRequiresAction && (
            <Alert tone="warning" title="Action Required">
              Manual DNS action or Cloudflare permission grant is required to complete provisioning.
            </Alert>
          )}

          {/* Verification Results Cards */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg border border-border bg-surface p-2.5 text-center">
              <div className="text-[11px] font-medium text-faint">Inbound Receiving</div>
              <div className="mt-1 flex items-center justify-center gap-1.5 text-xs font-semibold">
                {status.receivingStatus === 'ready' ? (
                  <span className="flex items-center gap-1 text-success"><CircleCheck className="h-3.5 w-3.5" /> Ready</span>
                ) : status.receivingStatus === 'error' ? (
                  <span className="flex items-center gap-1 text-danger"><CircleX className="h-3.5 w-3.5" /> Error</span>
                ) : (
                  <span className="flex items-center gap-1 text-warning"><CircleDashed className="h-3.5 w-3.5" /> Pending</span>
                )}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-surface p-2.5 text-center">
              <div className="text-[11px] font-medium text-faint">Outbound Sending</div>
              <div className="mt-1 flex items-center justify-center gap-1.5 text-xs font-semibold">
                {status.sendingStatus === 'ready' ? (
                  <span className="flex items-center gap-1 text-success"><CircleCheck className="h-3.5 w-3.5" /> Ready</span>
                ) : status.sendingStatus === 'error' ? (
                  <span className="flex items-center gap-1 text-danger"><CircleX className="h-3.5 w-3.5" /> Error</span>
                ) : (
                  <span className="flex items-center gap-1 text-warning"><CircleDashed className="h-3.5 w-3.5" /> Pending</span>
                )}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-surface p-2.5 text-center">
              <div className="text-[11px] font-medium text-faint">DNS Records</div>
              <div className="mt-1 flex items-center justify-center gap-1.5 text-xs font-semibold">
                {status.dnsStatus === 'verified' ? (
                  <span className="flex items-center gap-1 text-success"><CircleCheck className="h-3.5 w-3.5" /> Verified</span>
                ) : status.dnsStatus === 'error' ? (
                  <span className="flex items-center gap-1 text-danger"><CircleX className="h-3.5 w-3.5" /> Issues</span>
                ) : (
                  <span className="flex items-center gap-1 text-warning"><CircleDashed className="h-3.5 w-3.5" /> Pending</span>
                )}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-surface p-2.5 text-center">
              <div className="text-[11px] font-medium text-faint">Worker Hostname</div>
              <div className="mt-1 flex items-center justify-center gap-1.5 text-xs font-semibold">
                {status.workerConfigured ? (
                  <span className="flex items-center gap-1 text-success"><CircleCheck className="h-3.5 w-3.5" /> Attached</span>
                ) : (
                  <span className="flex items-center gap-1 text-muted"><CircleDashed className="h-3.5 w-3.5" /> Standard</span>
                )}
              </div>
            </div>
          </div>

          {/* Sub-tabs: Step Checklist vs Raw Logs */}
          <div className="flex border-b border-border">
            <button
              type="button"
              onClick={() => setActiveTab('steps')}
              className={cn(
                'border-b-2 px-3 py-2 text-xs font-medium transition-colors',
                activeTab === 'steps' ? 'border-primary font-semibold text-primary-text' : 'border-transparent text-muted hover:text-fg',
              )}
            >
              Provisioning Stages ({PROVISIONING_STAGES.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('logs')}
              className={cn(
                'border-b-2 px-3 py-2 text-xs font-medium transition-colors',
                activeTab === 'logs' ? 'border-primary font-semibold text-primary-text' : 'border-transparent text-muted hover:text-fg',
              )}
            >
              Configuration Logs ({status.logs.length})
            </button>
          </div>

          {activeTab === 'steps' ? (
            <div className="flex flex-col gap-2 rounded-lg border border-border p-3.5">
              {PROVISIONING_STAGES.map((st, i) => {
                const state = getStageState(st.id, i);
                const tile = {
                  done: 'bg-success-soft text-success',
                  err: 'bg-danger-soft text-danger',
                  run: 'bg-primary-soft text-primary-text',
                  wait: 'bg-surface-2 text-faint',
                }[state];
                return (
                  <div key={st.id} className="relative flex gap-3 pb-3 last:pb-0">
                    {i < PROVISIONING_STAGES.length - 1 && (
                      <span className="absolute top-[22px] bottom-0.5 left-[10px] w-px bg-border" />
                    )}
                    <span
                      className={cn(
                        'relative grid h-5 w-5 shrink-0 place-items-center rounded-full [&>svg]:h-3 [&>svg]:w-3',
                        tile,
                      )}
                    >
                      {state === 'done' ? (
                        <Check />
                      ) : state === 'err' ? (
                        <X />
                      ) : state === 'run' ? (
                        <LoaderCircle className="animate-spin" />
                      ) : (
                        <CircleDashed />
                      )}
                    </span>
                    <div className="min-w-0 flex-1 leading-tight">
                      <div
                        className={cn(
                          'text-[13px]',
                          state === 'run' || state === 'err' ? 'font-semibold' : 'font-medium',
                          state === 'wait' && 'text-faint',
                        )}
                      >
                        {st.label}
                      </div>
                      <div className="text-xs text-muted">{st.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface-2 p-3 font-mono text-[11.5px]">
              {status.logs.length === 0 ? (
                <div className="text-muted">No logs recorded yet.</div>
              ) : (
                <div className="max-h-60 overflow-y-auto">
                  {status.logs.map((l, idx) => (
                    <div key={idx} className="flex gap-2 py-0.5 leading-snug">
                      <span className="shrink-0 text-faint">
                        {new Date(l.at).toLocaleTimeString()}
                      </span>
                      <span
                        className={cn(
                          'shrink-0 font-medium',
                          l.ok ? 'text-success' : 'text-danger',
                        )}
                      >
                        [{l.stage}]
                      </span>
                      <span className="break-words text-fg">{l.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}
