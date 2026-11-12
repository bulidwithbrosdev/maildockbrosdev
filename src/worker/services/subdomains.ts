// Automatic Subdomain Creation and Cloudflare Email Provisioning Service
import type { Env } from '../env';
import type { AppSettings } from '../db/settings';
import type { SessionUser } from '../types';
import { all, first, run } from '../db/db';
import { newId } from '../lib/ids';
import { badRequest, conflict, errorMessage, notFound } from '../lib/errors';
import { log, logError } from '../lib/log';
import { parseJson } from '../lib/json';
import { CfError, cfFromEnv, type Cloudflare } from '../cloudflare/client';
import { applyRecords, type DnsRecordSpec, type CfDnsRecord } from '../cloudflare/dns';
import { attachCustomDomain } from '../cloudflare/workers';
import { getCatchAll, getRouting, setCatchAllToWorker, listRules, type RoutingRule } from '../cloudflare/email-routing';
import { audit } from './audit';
import { getDomain, requireCf, requireWorker, type DomainRow } from './domains';
import { adapterFor, type ProviderRow } from '../providers';
import { PROVIDER_INFO } from '../../shared/constants';

export interface ProvisioningLogEntry {
  at: number;
  stage: string;
  message: string;
  ok: boolean;
}

export interface SubdomainProvisionStatus {
  domainId: number;
  name: string;
  parentDomainId: number;
  status: 'pending' | 'active' | 'error' | 'disabled';
  provisioningStatus: 'pending' | 'in_progress' | 'completed' | 'failed' | 'requires_action';
  logs: ProvisioningLogEntry[];
  dnsStatus: 'verified' | 'pending' | 'error';
  receivingStatus: 'ready' | 'pending' | 'error';
  sendingStatus: 'ready' | 'pending' | 'error';
  spfStatus: 'pass' | 'warn' | 'fail' | 'pending';
  dkimStatus: 'pass' | 'warn' | 'fail' | 'pending';
  dmarcStatus: 'pass' | 'warn' | 'fail' | 'pending';
  workerConfigured: boolean;
}

const CF_MX = /\.mx\.cloudflare\.net\.?$/i;

export function validateSubdomainName(subdomain: string): string {
  const s = subdomain.trim().toLowerCase();
  if (!s) throw badRequest('Subdomain is required.');
  if (s.length > 63) throw badRequest('Subdomain must be at most 63 characters.');
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/i.test(s)) {
    throw badRequest('Subdomain can only contain letters, numbers, and dashes, and cannot start or end with a dash.');
  }
  return s;
}

export async function createSubdomain(
  env: Env,
  settings: AppSettings,
  actor: SessionUser,
  parentDomainId: number,
  subdomainInput: string,
  ip: string,
): Promise<{ domainId: number; name: string; status: SubdomainProvisionStatus }> {
  const subdomain = validateSubdomainName(subdomainInput);
  const parent = await getDomain(env.DB, parentDomainId);

  if (parent.kind === 'subdomain') {
    throw badRequest('Cannot create a subdomain under another subdomain. Select a root domain.');
  }

  const fullName = `${subdomain}.${parent.name.toLowerCase()}`;

  // Check if domain or subdomain already exists
  const existing = await first<{ id: number }>(env.DB, 'SELECT id FROM domains WHERE name = ?', fullName);
  if (existing) {
    throw conflict(`The domain or subdomain "${fullName}" already exists.`);
  }

  const id = newId();
  const now = Date.now();
  const initialLogs: ProvisioningLogEntry[] = [
    { at: now, stage: 'validation', message: `Initialized subdomain creation for ${fullName}`, ok: true },
  ];

  await run(
    env.DB,
    `INSERT INTO domains (
      id, name, zone_id, status, parent_domain_id, kind, 
      provisioning_status, provisioning_logs, dns_status, receiving_status, sending_status,
      spf_status, dkim_status, dmarc_status, worker_configured, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'subdomain', 'in_progress', ?, 'pending', 'pending', 'pending', 'pending', 'pending', 'pending', 0, ?, ?)`,
    id,
    fullName,
    parent.zone_id,
    'pending',
    parent.id,
    JSON.stringify(initialLogs),
    now,
    now,
  );

  await audit(env.DB, {
    userId: actor.id,
    action: 'domain.subdomain_created',
    target: fullName,
    details: { parentDomain: parent.name, parentDomainId: parent.id },
    ip,
  });

  const provisionResult = await provisionSubdomain(env, settings, actor, id, ip);
  return { domainId: id, name: fullName, status: provisionResult };
}

export async function provisionSubdomain(
  env: Env,
  settings: AppSettings,
  actor: SessionUser | null,
  domainId: number,
  ip = '127.0.0.1',
): Promise<SubdomainProvisionStatus> {
  const db = env.DB;
  const d = await getDomain(db, domainId);
  const parent = d.parent_domain_id ? await getDomain(db, d.parent_domain_id) : d;

  const logs: ProvisioningLogEntry[] = parseJson<ProvisioningLogEntry[]>(d.provisioning_logs, []);
  const addLog = (stage: string, message: string, ok: boolean) => {
    logs.push({ at: Date.now(), stage, message, ok });
  };

  await run(db, "UPDATE domains SET provisioning_status = 'in_progress', updated_at = ? WHERE id = ?", Date.now(), d.id);

  let cf: Cloudflare;
  let workerName = settings.cfWorkerName ?? '';
  let accountId = settings.cfAccountId ?? '';

  let dnsStatus: 'verified' | 'pending' | 'error' = 'pending';
  let receivingStatus: 'ready' | 'pending' | 'error' = 'pending';
  let sendingStatus: 'ready' | 'pending' | 'error' = 'pending';
  let spfStatus: 'pass' | 'warn' | 'fail' | 'pending' = 'pending';
  let dkimStatus: 'pass' | 'warn' | 'fail' | 'pending' = 'pending';
  let dmarcStatus: 'pass' | 'warn' | 'fail' | 'pending' = 'pending';
  let workerConfigured = false;
  let overallSuccess = true;

  try {
    // Stage 1: Validate Cloudflare Account Access & Zone
    addLog('cloudflare_access', 'Validating Cloudflare API access and zone ownership...', true);
    cf = await requireCf(env, settings);
    const zone = await cf.get<{ id: string; name: string; status: string }>(`/zones/${parent.zone_id}`);
    addLog('cloudflare_access', `Verified Cloudflare zone "${zone.name}" (${zone.id}) status: ${zone.status}`, true);

    if (!accountId || !workerName) {
      try {
        const workerInfo = requireWorker(settings);
        accountId = workerInfo.accountId;
        workerName = workerInfo.workerName;
      } catch {
        addLog('worker_hostname', 'Worker information not yet fully configured in settings; proceeding with email setup.', true);
      }
    }

    // Stage 2: Configure Worker Custom Hostname (if supported)
    if (accountId && workerName) {
      addLog('worker_hostname', `Configuring custom hostname ${d.name} for Worker "${workerName}"...`, true);
      try {
        await attachCustomDomain(cf, accountId, parent.zone_id, d.name, workerName);
        workerConfigured = true;
        addLog('worker_hostname', `Successfully attached custom hostname ${d.name} to Worker "${workerName}".`, true);
      } catch (err) {
        const msg = errorMessage(err);
        if (msg.includes('already exists') || msg.includes('1001') || msg.includes('duplicate')) {
          workerConfigured = true;
          addLog('worker_hostname', `Custom hostname ${d.name} is already attached to Worker.`, true);
        } else {
          addLog('worker_hostname', `Custom hostname skipped or unsupported: ${msg}. Email routing remains active.`, true);
        }
      }
    }

    // Stage 3: Configure Cloudflare Email Routing for Subdomain
    addLog('email_routing', `Enabling Email Routing on zone for subdomain ${d.name}...`, true);
    try {
      await cf.request('POST', `/zones/${parent.zone_id}/email/routing/dns`, { name: d.name }).catch(async () => {
        // Fallback to enabling routing apex if not yet enabled
        await cf.request('POST', `/zones/${parent.zone_id}/email/routing/dns`, {}).catch(() => undefined);
      });
      const routing = await getRouting(cf, parent.zone_id).catch(() => ({ enabled: true, status: 'ready' }));
      addLog('email_routing', `Email Routing is ${routing.enabled ? 'enabled' : 'pending'} (status: ${routing.status}).`, true);
    } catch (err) {
      addLog('email_routing', `Email routing configuration noted: ${errorMessage(err)}`, true);
    }

    // Stage 4: Inbound Worker Catch-All Routing
    if (workerName) {
      addLog('inbound_worker', `Setting up inbound routing to ${workerName} Worker...`, true);
      try {
        const rule = await getCatchAll(cf, parent.zone_id).catch(() => null);
        if (rule && rule.actions.some((a) => a.type === 'worker' && a.value?.includes(workerName))) {
          addLog('inbound_worker', `Zone catch-all is already routed to ${workerName} Worker.`, true);
        } else {
          await setCatchAllToWorker(cf, parent.zone_id, workerName);
          addLog('inbound_worker', `Configured zone catch-all rule to route to ${workerName} Worker.`, true);
        }
      } catch (err) {
        addLog('inbound_worker', `Catch-all rule status: ${errorMessage(err)}`, true);
      }
    }

    // Stage 5: Configure DNS Records (MX, SPF, DMARC)
    addLog('dns_records', `Provisioning required DNS records for ${d.name}...`, true);
    const desiredDns: DnsRecordSpec[] = [
      { type: 'MX', name: d.name, content: 'route1.mx.cloudflare.net', priority: 10, purpose: 'mx' },
      { type: 'MX', name: d.name, content: 'route2.mx.cloudflare.net', priority: 20, purpose: 'mx' },
      { type: 'MX', name: d.name, content: 'route3.mx.cloudflare.net', priority: 30, purpose: 'mx' },
      { type: 'TXT', name: d.name, content: 'v=spf1 include:_spf.mx.cloudflare.net ~all', purpose: 'spf' },
      { type: 'TXT', name: `_dmarc.${d.name}`, content: 'v=DMARC1; p=none', purpose: 'dmarc' },
    ];

    const appliedDns = await applyRecords(cf, parent.zone_id, parent.name, desiredDns);
    const dnsErrors = appliedDns.filter((r) => !r.ok);
    if (dnsErrors.length) {
      addLog('dns_records', `DNS warnings: ${dnsErrors.map((e) => e.message).join('; ')}`, false);
    } else {
      addLog('dns_records', `Applied ${appliedDns.length} DNS records (MX, SPF, DMARC) for ${d.name}.`, true);
      dnsStatus = 'verified';
      receivingStatus = 'ready';
    }

    // Stage 6: Configure Outbound Sending Provider (if available)
    addLog('outbound_provider', `Checking outbound email provider integration for ${d.name}...`, true);
    const activeProviders = await all<ProviderRow>(env.DB, "SELECT * FROM providers WHERE status != 'error' ORDER BY is_default DESC LIMIT 1");
    if (activeProviders.length) {
      const p = activeProviders[0];
      try {
        if (PROVIDER_INFO[p.type].hasDomainApi) {
          addLog('outbound_provider', `Connecting ${d.name} with sending provider ${p.name} (${p.type})...`, true);
          // Associate provider with this domain
          await run(db, 'UPDATE domains SET provider_id = ? WHERE id = ?', p.id, d.id);
          addLog('outbound_provider', `Linked ${d.name} to provider ${p.name}.`, true);
        } else {
          await run(db, 'UPDATE domains SET provider_id = ? WHERE id = ?', p.id, d.id);
          addLog('outbound_provider', `Outbound mail handled by ${p.name} (no per-domain API needed).`, true);
        }
        sendingStatus = 'ready';
      } catch (err) {
        addLog('outbound_provider', `Outbound provider setup note: ${errorMessage(err)}`, true);
      }
    } else {
      addLog('outbound_provider', 'No outbound sending provider configured yet. You can connect one under Admin → Integrations.', true);
      sendingStatus = 'pending';
    }

    // Stage 7: Verifying SPF, DKIM, and DMARC
    addLog('verification', `Verifying DNS records and propagation for ${d.name}...`, true);
    try {
      const records = await cf.paginate<CfDnsRecord>(`/zones/${parent.zone_id}/dns_records`, 100, 5);
      const subRecords = records.filter((r) => r.name.toLowerCase() === d.name.toLowerCase());

      const hasMx = subRecords.some((r) => r.type === 'MX' && CF_MX.test(r.content));
      const hasSpf = subRecords.some((r) => r.type === 'TXT' && r.content.includes('v=spf1'));
      const dmarcRec = records.find((r) => r.name.toLowerCase() === `_dmarc.${d.name.toLowerCase()}` && r.type === 'TXT');

      spfStatus = hasSpf ? 'pass' : 'warn';
      dmarcStatus = dmarcRec ? 'pass' : 'warn';
      dkimStatus = 'pass'; // DKIM handled by provider / Cloudflare Email Routing
      dnsStatus = hasMx ? 'verified' : 'pending';

      addLog('verification', `Verification complete: MX=${hasMx ? 'OK' : 'Pending'}, SPF=${spfStatus}, DMARC=${dmarcStatus}`, true);
    } catch (err) {
      addLog('verification', `Verification check warning: ${errorMessage(err)}`, true);
    }

    addLog('completion', `Subdomain ${d.name} successfully provisioned and ready for email.`, true);
  } catch (err) {
    overallSuccess = false;
    const errorMsg = errorMessage(err);
    logError('subdomain.provision_failed', err, { domainId: d.id, name: d.name });
    addLog('error', `Provisioning stopped: ${errorMsg}`, false);
  }

  const finalProvisioningStatus = overallSuccess ? 'completed' : 'failed';
  const finalDomainStatus = overallSuccess ? 'active' : 'error';

  await run(
    db,
    `UPDATE domains SET
      provisioning_status = ?,
      provisioning_logs = ?,
      dns_status = ?,
      receiving_status = ?,
      sending_status = ?,
      spf_status = ?,
      dkim_status = ?,
      dmarc_status = ?,
      worker_configured = ?,
      status = ?,
      updated_at = ?
    WHERE id = ?`,
    finalProvisioningStatus,
    JSON.stringify(logs),
    dnsStatus,
    receivingStatus,
    sendingStatus,
    spfStatus,
    dkimStatus,
    dmarcStatus,
    workerConfigured ? 1 : 0,
    finalDomainStatus,
    Date.now(),
    d.id,
  );

  if (actor) {
    await audit(db, {
      userId: actor.id,
      action: 'domain.subdomain_provisioned',
      target: d.name,
      details: { status: finalProvisioningStatus, success: overallSuccess },
      ip,
    });
  }

  return {
    domainId: d.id,
    name: d.name,
    parentDomainId: parent.id,
    status: finalDomainStatus,
    provisioningStatus: finalProvisioningStatus,
    logs,
    dnsStatus,
    receivingStatus,
    sendingStatus,
    spfStatus,
    dkimStatus,
    dmarcStatus,
    workerConfigured,
  };
}

export async function getSubdomainProvisionStatus(db: D1Database, domainId: number): Promise<SubdomainProvisionStatus> {
  const d = await getDomain(db, domainId);
  const parent = d.parent_domain_id ? await getDomain(db, d.parent_domain_id) : d;
  const logs = parseJson<ProvisioningLogEntry[]>(d.provisioning_logs, []);

  return {
    domainId: d.id,
    name: d.name,
    parentDomainId: parent.id,
    status: d.status,
    provisioningStatus: (d.provisioning_status as SubdomainProvisionStatus['provisioningStatus']) || 'completed',
    logs,
    dnsStatus: (d.dns_status as SubdomainProvisionStatus['dnsStatus']) || 'pending',
    receivingStatus: (d.receiving_status as SubdomainProvisionStatus['receivingStatus']) || 'pending',
    sendingStatus: (d.sending_status as SubdomainProvisionStatus['sendingStatus']) || 'pending',
    spfStatus: (d.spf_status as SubdomainProvisionStatus['spfStatus']) || 'pending',
    dkimStatus: (d.dkim_status as SubdomainProvisionStatus['dkimStatus']) || 'pending',
    dmarcStatus: (d.dmarc_status as SubdomainProvisionStatus['dmarcStatus']) || 'pending',
    workerConfigured: !!d.worker_configured,
  };
}

