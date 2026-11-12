<div align="center">

<img src="src/web/public/icon-512.png" width="96" alt="Maildock" />

# Maildock

### Free, unlimited business email on your own domains

Unlimited users, mailboxes, aliases and domains, hosted entirely in your own free Cloudflare account.<br>
No per-seat fees, no servers to run, no vendor holding your mail.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/bulidwithbrosdev/maildock)

[![License: MIT](https://img.shields.io/badge/license-MIT-FC0004.svg)](LICENSE)
![Runs on Cloudflare Workers](https://img.shields.io/badge/runs%20on-Cloudflare%20Workers-f38020?logo=cloudflare&logoColor=white)
![Status: beta](https://img.shields.io/badge/status-beta-yellow.svg)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#contributing)

[Features](#features) · [How it works](#how-it-works) · [Deploy](#deploy) · [Free-tier limits](#free-tier-limits) · [Roadmap](#roadmap) · [Contributing](#contributing)

</div>

> [!WARNING]
> **Maildock is in beta.** It may have bugs and needs extensive testing. Try it on a spare domain before you rely on it for important mail. See [Project status](#project-status).

## Contents

- [Why Maildock](#why-maildock)
- [Who it's for](#who-its-for)
- [Features](#features)
- [How it works](#how-it-works)
- [Deploy](#deploy)
- [Free-tier limits](#free-tier-limits)
- [Use it responsibly](#use-it-responsibly)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)
- [Project status](#project-status)
- [Contributing](#contributing)
- [License](#license)

## Why Maildock

Business email usually costs a few dollars per user per month, every month. Maildock gives you the same thing for free: one Cloudflare Worker and one D1 database, deployed into **your** Cloudflare account with a single click. You own the data and the domains, and adding the tenth or the hundredth user costs nothing.

| | Typical hosted email | Maildock |
| --- | --- | --- |
| **Price** | Per user, per month | Free on Cloudflare's free plan |
| **Users and mailboxes** | Paid seats | Unlimited |
| **Domains and aliases** | Often capped | Unlimited |
| **Where your mail lives** | The vendor's servers | Your own Cloudflare account |
| **Subdomain provisioning** | Manual DNS setup | Automatic via Cloudflare API |
| **Source code** | Closed | Open source (MIT) |

## Who it's for

| Who | What Maildock gives them |
| --- | --- |
| **Solo and indie developers** | `you@yourproduct.com` for every side project, without paying for each one |
| **Small businesses and startups** | Shared `support@`, `sales@` and `billing@` for a growing team, with no per-seat bill |
| **Freelancers, agencies and consultants** | Mail for several brands or client domains, managed from one place |
| **Open-source projects, nonprofits and communities** | Role addresses and shared inboxes on a zero budget |
| **Families and personal domains** | A mailbox for everyone on `yourname.com` |
| **Privacy-minded people and self-hosters** | Mail in your own account, running code you can read |

Maildock is built for everyday conversations. It is not a bulk or marketing sender (see [Use it responsibly](#use-it-responsibly)).

## Features

**Mail**
- Receive on any domain in your Cloudflare account — Email Routing is configured for you automatically.
- Send through **Resend**, **Brevo**, **Mailjet**, **Cloudflare Email Sending** or any **SMTP** server. When one provider hits its free limit, mail falls back to the next one.
- Threads, All Mail, full search (`from:` `has:attachment` `before:` and more), labels, filters, snooze, scheduled send and undo send.
- Command palette and keyboard shortcuts, dark mode, fully responsive mobile layout.

**Teams**
- Unlimited users, with personal and shared inboxes.
- Invite users by email with a secure single-use activation link — no plain-text passwords ever sent.
- Aliases, `you+tag@` addressing and catch-all.

**Domains & Subdomains**
- **Automatic subdomain provisioning** — enter a subdomain, click Create, and Maildock configures DNS, Email Routing, SPF, DKIM and DMARC via the Cloudflare API. No manual DNS editing.
- Domain health checks with one-click repair for broken DNS records.
- Live provisioning dashboard shows each step: DNS → Email Routing → SPF/DKIM → verification.

**Admin**
- Dashboard with traffic, free-tier usage, delivery logs and audit logs.
- Full user management: create, disable, resend invitations, track invitation status (Pending / Sent / Accepted / Expired).
- Send Credentials button on user creation, user table and user detail pages.
- Domain management: root domains and subdomains with per-domain DNS, receiving and sending status.
- A sender logo per domain ([BIMI](https://bimigroup.org/)): upload a square SVG and Maildock hosts it and writes the `default._bimi` record.

**Security**
- HTML mail is sanitized and sandboxed; remote images are blocked until you allow them.
- Mail that fails SPF, DKIM or DMARC goes to Spam.
- Optional two-factor sign-in (TOTP). Stored credentials are encrypted at rest.
- Invitation tokens are cryptographically secure, single-use, hashed in the database, and expire after 24 hours.
- Recovery key for owner lockout — shown once at setup, never stored in plain text.

## How it works

Everything runs inside your own Cloudflare account. There is no Maildock server in between.

| Part | What it does |
| --- | --- |
| **Cloudflare Email Routing** | Receives mail for your domains and hands it to the Worker |
| **One Worker** | Runs the web app, the API, inbound mail handling and scheduled jobs |
| **One D1 database** | Stores mailboxes, messages, users, domains and settings |
| **A sending provider** | Delivers outgoing mail (Resend, Brevo, Mailjet, Cloudflare or SMTP), with automatic fallback |
| **R2 (optional)** | Keeps large attachments out of D1 |

```
              ┌─────────────────────────────────┐
              │      Your Cloudflare Account     │
              │                                 │
 Incoming ───►│  Email Routing ──► Worker ──► D1│
 mail         │                      │          │
              │                      ▼          │
 Outgoing ◄───│         Resend / Brevo / SMTP   │
 mail         └─────────────────────────────────┘
```

## Deploy

### Requirements

- A free Cloudflare account with a domain on Cloudflare's nameservers.
- A GitHub account (to fork the repo and use Workers Builds).
- A free account with at least one sending provider — only needed to **send** mail; receiving works without one.

### Steps

**1. Click the Deploy to Cloudflare button** at the top of this page, then click **Deploy**. The form asks for nothing else — keep the default names or change them.

**2. Open the Worker's `workers.dev` URL.** The Setup page asks for a Cloudflare API token, which Maildock uses to configure Email Routing and DNS on your behalf. Click **Create token** — Cloudflare opens with every required permission pre-filled. Click **Continue to summary → Create Token**, then paste it back into the Setup page. It is stored encrypted, never in plain text.

> [!TIP]
> If your Worker shows no `workers.dev` URL, enable it in the Worker's **Settings → Domains & Routes**.

> [!IMPORTANT]
> Connecting the token generates your **recovery key** and shows it **once**. Save it in a password manager immediately. It is the only way back into the owner account if you lose your password.

**3. Follow the Setup page.** It checks the token's permissions, creates your admin account and connects your first domain.

**4. Connect a sending provider** in **Admin → Integrations** to enable outbound mail.

**5. (Optional) Provision subdomains** in **Admin → Domains → + Create Subdomain**. Enter a subdomain name, select the parent domain, and Maildock auto-configures everything via the Cloudflare API.

<details>
<summary>The token's permissions (pre-filled by Cloudflare when you click Create token)</summary>

| Scope | Permission | Access | |
| --- | --- | --- | --- |
| Zone | Zone | Read | required — list your domains |
| Zone | DNS | Edit | required — write MX, SPF, DKIM, DMARC |
| Zone | Zone Settings | Edit | required — enable Email Routing |
| Zone | Email Routing Rules | Edit | required — route mail to Maildock |
| Account | Workers Scripts | Edit | required — find this Worker and its database |
| Account | Account Settings | Read | recommended — show your account name |
| Zone | Workers Routes | Edit | optional — serve app on `mail.yourdomain.com` |
| Zone | Analytics | Read | optional — delivery logs in admin |
| Account | Email Routing Addresses | Edit | optional — forwarding addresses |
| Account | Email Sending | Edit | optional — send through Cloudflare |
| Account | Account Analytics | Read | optional — usage on the dashboard |
| Account | Workers R2 Storage | Edit | optional — attachments bucket |

</details>

## Free-tier limits

| What | Free limit |
| --- | --- |
| Worker requests | 100,000 / day per account |
| D1 storage | 500 MB — roughly 50,000–100,000 messages |
| Incoming message size | 25 MB |
| Resend sending | 100 / day, 3,000 / month |
| Brevo sending | 300 / day |
| Mailjet sending | 200 / day, 6,000 / month |
| Cloudflare sending | 3,000 / month (Workers Paid plan) |

Mail is stored text-only by default; attachments are kept only on messages under 950 KB. To keep every attachment, enable R2 storage in **Admin → Integrations → Attachments**. R2 has a 10 GB free tier, but Cloudflare requires a payment method on the account first.

## Use it responsibly

> [!CAUTION]
> Maildock is for real conversations with people who expect to hear from you. It is **not** a tool for cold outreach, bulk marketing, purchased lists or spam automation — and must not be used that way.

- **Provider bans.** Resend, Brevo, Mailjet and other providers enforce strict anti-spam and acceptable-use policies. High bounce or complaint rates, unsolicited mail, or working around daily limits can get your sending account **suspended or permanently banned**, and can damage your domain's reputation so that even normal mail lands in spam.
- **Cloudflare's terms apply too.** Abusing Email Routing or Workers can restrict your account.
- **Stay within the free tiers.** If you genuinely need more volume, upgrade to a paid plan rather than spreading load across free accounts.
- **Follow anti-spam laws** (CAN-SPAM, GDPR, CASL). Send only to people who opted in, and honour all unsubscribe requests.

You are responsible for the mail you send. The Maildock maintainers accept no liability for suspended accounts, blocked domains or misuse.

## Troubleshooting

| Problem | What to do |
| --- | --- |
| Mail not arriving | Go to **Admin → Domains → Check health** — it shows exactly which DNS or routing record is wrong |
| Mail not sending | Check **Admin → Mail flow** for delivery errors and provider status |
| Subdomain not working | Open **Admin → Domains**, select the subdomain and check each provisioning step — click Retry on any failed step |
| No logo next to my mail | [BIMI](https://bimigroup.org/) logos require `p=quarantine` or `p=reject` DMARC. Gmail and Apple Mail also need a VMC or CMC certificate. **Admin → Domains → Sender logo** shows what is missing. |
| Invitation email not received | Check the alternate email address is correct. Use **Resend Invitation** in the user table. Check **Admin → Mail flow** for delivery errors. |
| Locked out of the owner account | On the sign-in page, choose **Owner locked out?**, enter the owner email and your recovery key |
| "A repository with that name already exists" on the Deploy form | An earlier deploy already created that repo. Change the project name, or update the existing instance instead |

## Roadmap

These are planned or in progress and are **not available yet**:

- [ ] **Inbox API** — a REST API with per-user API keys to list, read, search and send mail from scripts and automations.
- [ ] **AI email writing** using [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/): draft replies, rewrite or shorten text, change tone and summarize threads — using the free daily Workers AI allowance in your own account.
- [ ] **Webhooks** for incoming mail events.
- [ ] **Mobile app** — React Native companion app.

Ideas and pull requests for any of these are welcome.

## Project status

Maildock is young and under active development. **It may have bugs** and needs testing across different domains, providers, mail clients and Cloudflare account setups before you rely on it for critical mail.

- Try it on a spare domain first.
- Keep your recovery key safe — it is shown only once.
- [Open an issue](https://github.com/bulidwithbrosdev/maildock/issues) when something breaks.

The project is open for collaboration. Testers, bug reports, fixes, new sending providers and help with the roadmap are all very welcome.

## Contributing

Contributions of every size are welcome: testing on your own domain, bug reports, documentation fixes, UI polish, new sending providers (each provider is a single adapter file in [`src/worker/providers/`](src/worker/providers/)) or work on the [roadmap](#roadmap).

1. [Open an issue](https://github.com/bulidwithbrosdev/maildock/issues) to report a bug or discuss a larger change before you start.
2. Fork the repo and follow the development setup below.
3. Before opening a pull request, run `npm run lint && npm run typecheck && npm test`.

### Development setup

```sh
# 1. Install dependencies
npm ci

# 2. Create .dev.vars (see below)

# 3. Apply local DB migrations
npm run db:migrate:local

# 4. Terminal 1 — mock Cloudflare and provider APIs on :8790
npm run dev:mock

# 5. Terminal 2 — Vite dev server on http://localhost:5173
npm run dev
```

Local `.dev.vars` — **never put real credentials here**:

```sh
ENCRYPTION_KEY=any-long-random-string-for-local-use
CF_API_TOKEN=dev-token
CF_API_BASE=http://127.0.0.1:8790/cf
RESEND_API_BASE=http://127.0.0.1:8790/resend
BREVO_API_BASE=http://127.0.0.1:8790/brevo
MAILJET_API_BASE=http://127.0.0.1:8790/mailjet
WORKER_NAME=maildock
```

Copy from [`.dev.vars.example`](.dev.vars.example) for a documented template.

### Project structure

```
src/
├── shared/          # Types and constants shared between Worker and web app
├── web/             # React frontend (Vite + React Router + TanStack Query)
│   ├── components/  # Reusable UI components
│   ├── pages/       # Route pages (auth, mail, admin, settings, setup)
│   └── lib/         # API client, hooks, utilities
└── worker/          # Cloudflare Worker (Hono)
    ├── routes/      # API route handlers (admin, auth, mail, setup…)
    ├── services/    # Business logic (inbound, send, users, domains, subdomains…)
    ├── providers/   # Outbound email adapters (resend, brevo, mailjet, smtp…)
    ├── cloudflare/  # Cloudflare API helpers (DNS, Email Routing, Workers)
    └── db/          # D1 database layer + SQL migrations (0001–0011)
```

### Security

Report security issues privately via GitHub **Security → Report a vulnerability** — not in a public issue.

## License

[MIT](LICENSE)

---

<div align="center">
  <sub>Built with ❤️ on Cloudflare Workers · <a href="https://github.com/bulidwithbrosdev/maildock">github.com/bulidwithbrosdev/maildock</a></sub>
</div>

