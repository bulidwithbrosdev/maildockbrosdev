-- Subdomains and automatic Cloudflare email provisioning
ALTER TABLE domains ADD COLUMN parent_domain_id INTEGER;
ALTER TABLE domains ADD COLUMN kind TEXT NOT NULL DEFAULT 'root';
ALTER TABLE domains ADD COLUMN provisioning_status TEXT NOT NULL DEFAULT 'completed';
ALTER TABLE domains ADD COLUMN provisioning_logs TEXT NOT NULL DEFAULT '[]';
ALTER TABLE domains ADD COLUMN dns_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE domains ADD COLUMN receiving_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE domains ADD COLUMN sending_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE domains ADD COLUMN spf_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE domains ADD COLUMN dkim_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE domains ADD COLUMN dmarc_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE domains ADD COLUMN worker_configured INTEGER NOT NULL DEFAULT 0;
ALTER TABLE domains ADD COLUMN updated_at INTEGER;

CREATE INDEX IF NOT EXISTS idx_domains_parent_domain_id ON domains (parent_domain_id);
CREATE INDEX IF NOT EXISTS idx_domains_kind ON domains (kind);

