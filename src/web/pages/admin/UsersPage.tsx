import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, AtSign, ChevronRight, CircleCheck, Clock, Copy, Crown, KeyRound, Mail, Minus, RefreshCw, Search, ShieldCheck, ShieldOff, UserPlus, UsersRound } from 'lucide-react';
import { del, get, patch, post, put, errorText } from '../../lib/api';
import { timeAgo } from '../../lib/format';
import { useAction, useInvalidate } from '../../lib/hooks';
import { useUser } from '../../lib/session';
import { cn, copyText } from '../../lib/utils';
import type { DomainInfo, MailboxAdmin, UserSummary } from '../../lib/types';
import { Button } from '../../components/ui/button';
import { AddressInput, ChoiceCards, Field, Input, SegmentedControl, Select, Switch, Tick } from '../../components/ui/form';
import { Alert, Avatar, Badge, Card, CardHeader, CopyButton, EmptyState, PageHeader, PageSpinner } from '../../components/ui/misc';
import { ConfirmDialog, Dialog, useToast } from '../../components/ui/overlay';

const grid = 'grid grid-cols-[minmax(0,1fr)_120px] items-center gap-3 px-5 md:grid-cols-[minmax(0,2fr)_85px_95px_120px_minmax(0,1fr)_190px]';

type RoleFilter = 'all' | 'admins' | 'members' | 'disabled';

function useUsers() {
  return useQuery({ queryKey: ['admin', 'users'], queryFn: () => get<UserSummary[]>('/admin/users') });
}
function useRefresh() {
  const invalidate = useInvalidate();
  return () => invalidate(['admin', 'users'], ['admin', 'mailboxes'], ['mailboxes'], ['admin', 'overview']);
}

function RoleChip({ role }: { role: UserSummary['role'] }) {
  return (
    <span className={cn('inline-flex h-[22px] items-center rounded-md px-2 text-xs font-medium capitalize', role === 'owner' ? 'bg-primary-soft text-primary-text' : role === 'admin' ? 'bg-surface-3 text-muted' : 'bg-surface-2 text-muted')}>
      {role}
    </span>
  );
}

function lastSignIn(u: UserSummary): string {
  return u.lastLoginAt ? timeAgo(u.lastLoginAt) : u.mustChangePassword ? 'Not signed in yet' : 'Never signed in';
}

export function UsersPage() {
  const me = useUser();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const users = useUsers();
  const [creating, setCreating] = useState(false);
  const [invitingUser, setInvitingUser] = useState<UserSummary | null>(null);
  const [secret, setSecret] = useState<{ id?: number; name: string; email: string; password?: string; alternateEmail?: string | null; inviteUrl?: string } | null>(null);
  const [filter, setFilter] = useState('');
  const [role, setRole] = useState<RoleFilter>('all');
  const refresh = useRefresh();
  const { run, busy } = useAction();
  const list = useMemo(() => users.data ?? [], [users.data]);
  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return list.filter(
      (u) =>
        (role === 'all' || (role === 'admins' ? u.role !== 'member' : role === 'members' ? u.role === 'member' : u.status === 'disabled')) &&
        (!q || u.email.includes(q) || u.name.toLowerCase().includes(q) || (u.alternateEmail && u.alternateEmail.toLowerCase().includes(q)) || u.mailboxes.some((m) => m.address.includes(q))),
    );
  }, [list, filter, role]);

  // "Invite people" on the overview links here with ?add=1.
  useEffect(() => {
    if (params.get('add')) {
      setCreating(true);
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  if (users.isLoading) return <PageSpinner />;
  const counts = {
    all: list.length,
    admins: list.filter((u) => u.role !== 'member').length,
    members: list.filter((u) => u.role === 'member').length,
    disabled: list.filter((u) => u.status === 'disabled').length,
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Users"
        description="People who can sign in. Each person sees only the inboxes they're a member of."
        actions={
          <Button variant="primary" icon={<UserPlus className="h-[15px] w-[15px]" />} onClick={() => setCreating(true)}>
            Add a user
          </Button>
        }
      />
      {list.length === 0 ? (
        <Card>
          <EmptyState icon={<UsersRound />} title="No users yet" />
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex h-[34px] w-full items-center gap-2 rounded-lg border border-border bg-surface px-2.5 focus-within:border-primary focus-within:ring-3 focus-within:ring-[var(--ring)] sm:w-[280px]">
              <Search className="h-[15px] w-[15px] text-faint" />
              <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter users" aria-label="Filter users" className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-faint" />
            </div>
            <SegmentedControl
              value={role}
              onChange={setRole}
              options={[
                { value: 'all', label: 'All', count: counts.all },
                { value: 'admins', label: 'Admins', count: counts.admins },
                { value: 'members', label: 'Members', count: counts.members },
                ...(counts.disabled ? [{ value: 'disabled' as const, label: 'Disabled', count: counts.disabled }] : []),
              ]}
            />
          </div>
          <Card className="overflow-hidden">
            <div className={cn(grid, 'hidden h-[38px] border-b border-border bg-surface-2 text-xs font-medium text-faint md:grid')}>
              <span>Person</span>
              <span>Role</span>
              <span>Status</span>
              <span>Invitation</span>
              <span>Last sign-in</span>
              <span className="text-right pr-2">Actions</span>
            </div>
            {shown.map((u) => (
              <div
                key={u.id}
                role="row"
                tabIndex={0}
                onClick={() => navigate(`/admin/users/${u.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') navigate(`/admin/users/${u.id}`);
                }}
                className={cn(grid, 'min-h-[62px] w-full cursor-pointer border-b border-border py-2.5 text-left text-[13px] transition-colors last:border-b-0 hover:bg-surface-2')}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={u.name} address={u.email} size={32} />
                  <div className="min-w-0 leading-snug">
                    <div className="flex items-center gap-1.5 truncate font-semibold">
                      <span className="truncate">{u.name || u.email}</span>
                      {u.id === me?.id && <span className="font-normal text-faint">(you)</span>}
                    </div>
                    <div className="truncate text-[12.5px] text-muted">{u.email}</div>
                    {u.alternateEmail && <div className="truncate text-[11px] text-faint">Alt: {u.alternateEmail}</div>}
                  </div>
                </div>

                <span className="hidden md:block">
                  <RoleChip role={u.role} />
                </span>

                <span className="hidden md:block">
                  {u.status === 'disabled' ? (
                    <Badge tone="danger" pill>
                      Disabled
                    </Badge>
                  ) : u.invitationStatus === 'pending' || (u.mustChangePassword && u.invitationStatus !== 'accepted') ? (
                    <Badge tone="warning" pill>
                      Pending
                    </Badge>
                  ) : (
                    <Badge tone="success" pill>
                      Active
                    </Badge>
                  )}
                </span>

                <div className="hidden md:flex flex-col">
                  {u.invitationStatus === 'accepted' ? (
                    <Badge tone="success" pill>
                      Accepted
                    </Badge>
                  ) : u.invitationStatus === 'sent' ? (
                    <>
                      <Badge tone="primary" pill>
                        Sent
                      </Badge>
                      {u.lastInvitationSentAt && (
                        <span className="text-[10.5px] text-faint mt-0.5">
                          {timeAgo(u.lastInvitationSentAt)}
                        </span>
                      )}
                    </>
                  ) : u.invitationStatus === 'expired' ? (
                    <Badge tone="neutral" pill>
                      Expired
                    </Badge>
                  ) : u.invitationStatus === 'failed' ? (
                    <Badge tone="danger" pill>
                      Failed
                    </Badge>
                  ) : (
                    <span className="text-xs text-faint">None</span>
                  )}
                </div>

                <span className="hidden truncate text-[12.5px] text-muted md:block">{lastSignIn(u)}</span>

                <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => navigate(`/admin/users/${u.id}`)}
                    title="Edit user"
                  >
                    Edit
                  </Button>
                  <Button
                    size="xs"
                    variant="secondary"
                    icon={<Mail className="h-3 w-3" />}
                    onClick={() => setInvitingUser(u)}
                    title={u.invitationStatus === 'sent' || u.invitationStatus === 'expired' ? 'Resend invitation' : 'Send Credentials'}
                  >
                    {u.invitationStatus === 'sent' || u.invitationStatus === 'expired' ? 'Resend' : 'Send Credentials'}
                  </Button>
                  {u.role !== 'owner' && u.id !== me?.id && (
                    <Button
                      size="xs"
                      variant="ghost"
                      className={u.status === 'active' ? 'text-muted hover:text-danger' : 'text-success'}
                      loading={busy === `status-${u.id}`}
                      onClick={() =>
                        run(
                          `status-${u.id}`,
                          () => patch(`/admin/users/${u.id}`, { status: u.status === 'active' ? 'disabled' : 'active' }).then(refresh),
                          u.status === 'active' ? 'User disabled' : 'User enabled',
                        )
                      }
                    >
                      {u.status === 'active' ? 'Disable' : 'Enable'}
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {!shown.length && <div className="px-5 py-8 text-center text-[13px] text-muted">No users match.</div>}
          </Card>
        </>
      )}

      {creating && (
        <CreateUserDialog
          onClose={() => setCreating(false)}
          onCreated={(r) => {
            setCreating(false);
            setSecret(r);
            refresh();
          }}
        />
      )}
      {invitingUser && (
        <SendInvitationDialog
          user={invitingUser}
          onClose={() => setInvitingUser(null)}
          onSent={refresh}
        />
      )}
      {secret && <SecretDialog secret={secret} onClose={() => setSecret(null)} onSendCredentials={() => {
        if (secret.id) {
          const target = list.find((x) => x.id === secret.id);
          if (target) setInvitingUser(target);
        }
      }} />}
    </div>
  );
}

export function UserDetailPage() {
  const { id } = useParams();
  const users = useUsers();
  const user = users.data?.find((u) => u.id === Number(id));
  if (users.isLoading) return <PageSpinner />;
  if (!user)
    return (
      <Card>
        <EmptyState icon={<UsersRound />} title="User not found" action={<Link to="/admin/users" className="text-[13px] font-medium text-primary-text hover:underline">Back to users</Link>} />
      </Card>
    );
  return <UserDetail key={user.id} user={user} users={users.data ?? []} />;
}

function UserDetail({ user, users }: { user: UserSummary; users: UserSummary[] }) {
  const me = useUser();
  const navigate = useNavigate();
  const refresh = useRefresh();
  const mailboxes = useQuery({ queryKey: ['admin', 'mailboxes'], queryFn: () => get<MailboxAdmin[]>('/admin/mailboxes') });
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [alternateEmail, setAlternateEmail] = useState(user.alternateEmail || '');
  const [storageQuota, setStorageQuota] = useState(user.storageQuota !== null && user.storageQuota !== undefined ? String(user.storageQuota) : '');
  const [role, setRole] = useState<'member' | 'admin'>(user.role === 'admin' ? 'admin' : 'member');
  const [secret, setSecret] = useState<{ id?: number; name: string; email: string; password?: string; alternateEmail?: string | null; inviteUrl?: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [inviting, setInviting] = useState(false);
  const { run, busy } = useAction();
  const isOwner = user.role === 'owner';
  const isMe = user.id === me?.id;
  const label = user.name || user.email;

  // Access is stored per inbox, so changing it rewrites that inbox's member list.
  const setAccess = (m: MailboxAdmin, access: { canSend: boolean } | null) => {
    const others = m.members.filter((x) => x.userId !== user.id).map((x) => ({ userId: x.userId, canSend: x.canSend }));
    const next = access ? [...others, { userId: user.id, canSend: access.canSend }] : others;
    return run(`access-${m.id}`, () => put(`/admin/mailboxes/${m.id}/members`, { members: next }).then(refresh), access ? undefined : `Removed from ${m.address}`);
  };

  return (
    <div className="flex flex-col gap-5">
      <Link to="/admin/users" className="-mb-3 flex w-fit items-center gap-1.5 text-[13px] text-muted hover:text-fg">
        <ArrowLeft className="h-3.5 w-3.5" />
        Users
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={user.name} address={user.email} size={52} />
          <div className="min-w-0 flex-1">
            <h1 className="flex flex-wrap items-center gap-2 text-[22px] leading-tight font-semibold tracking-[-0.02em]">
              <span className="truncate">{label}</span>
              <RoleChip role={user.role} />
              {user.status === 'disabled' && (
                <Badge tone="danger" pill>
                  Disabled
                </Badge>
              )}
            </h1>
            <p className="mt-1 text-[13px] text-muted">
              {user.email} {user.alternateEmail && `(Alt: ${user.alternateEmail})`} · added {new Date(user.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · {user.lastLoginAt ? `last signed in ${timeAgo(user.lastLoginAt)}` : 'never signed in'}
            </p>
          </div>
        </div>
        <Button
          variant="secondary"
          icon={<Mail className="h-4 w-4" />}
          onClick={() => setInviting(true)}
        >
          {user.invitationStatus === 'sent' || user.invitationStatus === 'expired' ? 'Resend Invitation' : 'Send Credentials'}
        </Button>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="General" />
            <div className="grid gap-x-5 gap-y-4 px-5 py-[18px] sm:grid-cols-2">
              <Field label="Name" id="uname">
                <Input id="uname" value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="Sign-in email" id="uemail">
                <Input id="uemail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <Field label="Alternate / recovery email" id="ualt" hint="Personal email where credentials and account activation links are delivered.">
                <Input id="ualt" type="email" value={alternateEmail} onChange={(e) => setAlternateEmail(e.target.value)} placeholder="e.g. user.personal@gmail.com" />
              </Field>
              <Field label="Storage quota (MB)" id="uquota" hint="Leave blank for unlimited storage.">
                <Input id="uquota" type="number" min={0} value={storageQuota} onChange={(e) => setStorageQuota(e.target.value)} placeholder="Unlimited" />
              </Field>
              <Field label="Role" className="sm:col-span-2" hint={isOwner ? 'The owner set up this server. Ownership cannot be changed here.' : undefined}>
                {isOwner ? (
                  <div className="flex h-9 items-center gap-2 text-[13px] text-muted">
                    <Crown className="h-4 w-4 text-primary-text" /> Owner: full access, including recovery with the recovery key.
                  </div>
                ) : (
                  <ChoiceCards
                    value={role}
                    onChange={setRole}
                    options={[
                      { value: 'member', label: 'Member', hint: 'Uses their inboxes and nothing else.' },
                      { value: 'admin', label: 'Admin', hint: 'Manages domains, providers, inboxes and users.' },
                    ]}
                  />
                )}
              </Field>
            </div>
            <div className="flex justify-end border-t border-border px-5 py-3">
              <Button
                variant="primary"
                size="sm"
                loading={busy === 'general'}
                onClick={() =>
                  run(
                    'general',
                    () =>
                      patch(`/admin/users/${user.id}`, {
                        name,
                        email,
                        alternateEmail: alternateEmail.trim() || null,
                        storageQuota: storageQuota ? Number(storageQuota) : null,
                        ...(isOwner ? {} : { role }),
                      }).then(refresh),
                    'User updated',
                  )
                }
              >
                Save
              </Button>
            </div>
          </Card>

          <Card>
            <CardHeader title="Inbox access" description="The inboxes this person can read. Turn off “Can send” for read-only access. Admins don't see inboxes they aren't members of." />
            {mailboxes.isLoading ? (
              <div className="px-5 py-5 text-[13px] text-muted">Loading inboxes…</div>
            ) : !mailboxes.data?.length ? (
              <div className="px-5 py-5 text-[13px] text-muted">No inboxes yet.</div>
            ) : (
              mailboxes.data.map((m) => {
                const member = m.members.find((x) => x.userId === user.id);
                const working = busy === `access-${m.id}`;
                return (
                  <div
                    key={m.id}
                    className={cn('flex min-h-[52px] cursor-pointer items-center gap-3 border-b border-border px-5 py-2 text-[13px] transition-colors last:border-b-0 hover:bg-surface-2', working && 'opacity-60')}
                    onClick={() => !working && setAccess(m, member ? null : { canSend: true })}
                  >
                    <Tick checked={!!member} onChange={(v) => setAccess(m, v ? { canSend: true } : null)} label={m.address} />
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted">{m.kind === 'shared' ? <UsersRound className="h-3.5 w-3.5" /> : <AtSign className="h-3.5 w-3.5" />}</span>
                    <div className="min-w-0 flex-1 leading-snug">
                      <div className={cn('truncate font-medium', !member && 'text-muted')}>{m.address}</div>
                      <div className="truncate text-xs text-faint">
                        {m.kind === 'shared' ? 'Shared' : 'Personal'} · {m.members.length} {m.members.length === 1 ? 'member' : 'members'}
                      </div>
                    </div>
                    {member && (
                      <span className="flex shrink-0 items-center gap-2 text-xs text-muted" onClick={(e) => e.stopPropagation()}>
                        Can send
                        <Switch checked={member.canSend} onChange={(c) => setAccess(m, { canSend: c })} label={`Can send from ${m.address}`} disabled={working} />
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </Card>

          {!isOwner && !isMe && (
            <div className="flex flex-wrap items-center gap-4 rounded-xl border border-[color-mix(in_oklch,var(--danger)_30%,var(--border))] bg-surface px-5 py-4">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-danger">Delete this user</div>
                <div className="text-[12.5px] text-muted text-pretty">They lose access immediately. Their inboxes and mail are kept, and you can hand their access to someone else.</div>
              </div>
              <Button variant="danger" onClick={() => setDeleting(true)}>
                Delete user
              </Button>
            </div>
          )}
        </div>

        <Card>
          <CardHeader title="Sign-in and security" />
          <SecurityRow icon={<CircleCheck />} label="Sign-in" value={user.status === 'active' ? 'Allowed' : 'Disabled'} tone={user.status === 'active' ? 'success' : 'danger'}>
            {!isOwner && (
              <Button size="xs" loading={busy === 'status'} onClick={() => run('status', () => patch(`/admin/users/${user.id}`, { status: user.status === 'active' ? 'disabled' : 'active' }).then(refresh), user.status === 'active' ? 'Sign-in disabled' : 'Sign-in enabled')}>
                {user.status === 'active' ? 'Disable' : 'Enable'}
              </Button>
            )}
          </SecurityRow>

          <SecurityRow
            icon={<Mail />}
            label="Invitation"
            value={
              user.invitationStatus === 'accepted'
                ? 'Accepted'
                : user.invitationStatus === 'sent'
                ? `Sent ${user.lastInvitationSentAt ? `(${timeAgo(user.lastInvitationSentAt)})` : ''}`
                : user.invitationStatus === 'expired'
                ? 'Expired'
                : user.invitationStatus === 'failed'
                ? 'Delivery failed'
                : 'Not sent'
            }
            tone={user.invitationStatus === 'accepted' ? 'success' : user.invitationStatus === 'failed' ? 'danger' : undefined}
          >
            <Button size="xs" onClick={() => setInviting(true)}>
              {user.invitationStatus === 'sent' || user.invitationStatus === 'expired' ? 'Resend' : 'Send Credentials'}
            </Button>
          </SecurityRow>

          <SecurityRow icon={<ShieldCheck />} label="Two-factor" value={user.totpEnabled ? 'On' : 'Off'} tone={user.totpEnabled ? 'success' : undefined}>
            {user.totpEnabled && (
              <Button size="xs" icon={<ShieldOff />} loading={busy === '2fa'} onClick={() => run('2fa', () => post(`/admin/users/${user.id}/reset-2fa`).then(refresh), 'Two-factor turned off for this user')}>
                Turn off
              </Button>
            )}
          </SecurityRow>

          <SecurityRow icon={<KeyRound />} label="Password" value={user.mustChangePassword ? 'Temporary' : 'Set'}>
            <Button
              size="xs"
              disabled={isOwner && !isMe}
              loading={busy === 'reset'}
              onClick={() =>
                run('reset', async () => {
                  const r = await post<{ password: string }>(`/admin/users/${user.id}/reset-password`);
                  setSecret({ id: user.id, name: user.name, email: user.email, password: r.password, alternateEmail: user.alternateEmail });
                  await refresh();
                })
              }
            >
              Reset
            </Button>
          </SecurityRow>
          <SecurityRow icon={<Clock />} label="Last sign-in" value={lastSignIn(user)} />
        </Card>
      </div>

      {deleting && (
        <DeleteUserDialog
          user={user}
          users={users}
          onClose={() => setDeleting(false)}
          onDeleted={() => {
            refresh();
            navigate('/admin/users');
          }}
        />
      )}
      {inviting && (
        <SendInvitationDialog
          user={user}
          onClose={() => setInviting(false)}
          onSent={refresh}
        />
      )}
      {secret && (
        <SecretDialog
          secret={secret}
          onClose={() => setSecret(null)}
          onSendCredentials={() => setInviting(true)}
        />
      )}
    </div>
  );
}

function SecurityRow({ icon, label, value, tone, children }: { icon: ReactNode; label: string; value: string; tone?: 'success' | 'danger'; children?: ReactNode }) {
  return (
    <div className="flex min-h-[52px] items-center gap-3 border-b border-border py-2 pr-3 pl-5 text-[13px] last:border-b-0">
      <span className="text-faint [&>svg]:h-[15px] [&>svg]:w-[15px]">{icon}</span>
      <div className="min-w-0 flex-1 leading-snug">
        <div className="text-xs text-faint">{label}</div>
        <div className={cn('truncate font-medium', tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-danger' : 'text-fg')}>{value}</div>
      </div>
      {children}
    </div>
  );
}

function SendInvitationDialog({
  user,
  onClose,
  onSent,
}: {
  user: UserSummary;
  onClose: () => void;
  onSent: () => void;
}) {
  const [alternateEmail, setAlternateEmail] = useState(user.alternateEmail || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();

  const isResend = user.invitationStatus === 'sent' || user.invitationStatus === 'expired';

  const send = async () => {
    setBusy(true);
    setError('');
    try {
      await post(`/admin/users/${user.id}/send-credentials`, {
        alternateEmail: alternateEmail.trim() || undefined,
      });
      toast.success(isResend ? 'Invitation resent successfully' : 'Credentials sent successfully');
      onSent();
      onClose();
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  return (
    <ConfirmDialog
      open
      onClose={onClose}
      title={isResend ? `Resend invitation to ${user.name || user.email}?` : `Send credentials to ${user.name || user.email}?`}
      confirmLabel={isResend ? 'Resend invitation' : 'Send Credentials'}
      loading={busy}
      onConfirm={send}
    >
      <div className="space-y-3 text-[13px]">
        {error && <Alert tone="danger">{error}</Alert>}
        <p className="text-muted">
          A secure, single-use password setup link will be delivered so {user.name?.split(' ')[0] || 'they'} can set their password and activate their business email account.
        </p>
        <Field label="Deliver to alternate / recovery email" hint="Personal or existing email address where credentials will arrive.">
          <Input
            type="email"
            required
            value={alternateEmail}
            onChange={(e) => setAlternateEmail(e.target.value)}
            placeholder="e.g. user.personal@gmail.com"
            autoFocus
          />
        </Field>
      </div>
    </ConfirmDialog>
  );
}

function SecretDialog({
  secret,
  onClose,
  onSendCredentials,
}: {
  secret: { id?: number; name: string; email: string; password?: string; alternateEmail?: string | null; inviteUrl?: string };
  onClose: () => void;
  onSendCredentials?: () => void;
}) {
  const toast = useToast();
  const rows: [string, string, boolean][] = [
    ['Sign in at', location.host, false],
    ['Email', secret.email, false],
    ...(secret.password ? [['Password', secret.password, true] as [string, string, boolean]] : []),
    ...(secret.alternateEmail ? [['Sent to', secret.alternateEmail, false] as [string, string, boolean]] : []),
    ...(secret.inviteUrl ? [['Activation link', secret.inviteUrl, false] as [string, string, boolean]] : []),
  ];

  return (
    <Dialog
      open
      onClose={onClose}
      size="sm"
      icon={<CircleCheck />}
      tone="success"
      title={secret.inviteUrl ? 'Account ready & invitation created' : 'Share these sign-in details'}
      description={
        secret.inviteUrl
          ? `An invitation was created for ${secret.name?.split(' ')[0] || 'them'}. They can set their password using the activation link.`
          : `Send them to ${secret.name?.split(' ')[0] || 'them'} privately. The password works once; they'll choose a new one.`
      }
      footer={
        <>
          <Button
            icon={<Copy className="h-3.5 w-3.5" />}
            onClick={() => {
              const text = [
                `Sign in at ${location.origin}`,
                `Email: ${secret.email}`,
                secret.password ? `Password: ${secret.password}` : '',
                secret.inviteUrl ? `Activation link: ${secret.inviteUrl}` : '',
              ]
                .filter(Boolean)
                .join('\n');
              copyText(text).then(() => toast.success('Copied'));
            }}
          >
            Copy all
          </Button>
          {onSendCredentials && (
            <Button
              variant="secondary"
              icon={<Mail className="h-3.5 w-3.5" />}
              onClick={() => {
                onClose();
                onSendCredentials();
              }}
            >
              Send Credentials
            </Button>
          )}
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </>
      }
    >
      <div className="overflow-hidden rounded-[10px] border border-border text-[13px]">
        {rows.map(([k, v, mono]) => (
          <div key={k} className="flex min-h-11 items-center gap-2.5 border-b border-border py-1.5 pr-2 pl-3.5 last:border-b-0">
            <span className="w-[88px] shrink-0 text-[12.5px] text-faint">{k}</span>
            <span className={cn('min-w-0 flex-1 truncate', mono && 'font-mono tracking-[0.02em]')}>{v}</span>
            {mono && <CopyButton text={v} />}
          </div>
        ))}
      </div>
    </Dialog>
  );
}

function CreateUserDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (r: { id?: number; name: string; email: string; password?: string; alternateEmail?: string | null; inviteUrl?: string }) => void;
}) {
  const domains = useQuery({ queryKey: ['admin', 'domains'], queryFn: () => get<DomainInfo[]>('/admin/domains') });
  const mailboxes = useQuery({ queryKey: ['admin', 'mailboxes'], queryFn: () => get<MailboxAdmin[]>('/admin/mailboxes') });
  const [name, setName] = useState('');
  const [role, setRole] = useState<'member' | 'admin'>('member');
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [localPart, setLocalPart] = useState('');
  const [domainId, setDomainId] = useState<number | ''>('');
  const [email, setEmail] = useState('');
  const [alternateEmail, setAlternateEmail] = useState('');
  const [authMethod, setAuthMethod] = useState<'invite' | 'manual'>('invite');
  const [manualPassword, setManualPassword] = useState('');
  const [storageQuota, setStorageQuota] = useState('');
  const [shared, setShared] = useState<number[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const domainList = domains.data ?? [];
  const domain = domainList.find((d) => d.id === domainId) ?? domainList[0];
  const suggested = name.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '');

  const mailboxPreview = mode === 'new' && domain ? `${localPart || suggested || 'user'}@${domain.name}` : email;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (authMethod === 'invite' && !alternateEmail.trim()) {
      setError('Please provide an alternate email address to send the credentials.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const r = await post<{ id: number; email: string; password?: string; invitationStatus?: string; inviteUrl?: string }>('/admin/users', {
        name,
        role,
        email: mode === 'existing' ? email : undefined,
        alternateEmail: alternateEmail.trim() || null,
        storageQuota: storageQuota ? Number(storageQuota) : null,
        newMailbox: mode === 'new' ? { localPart: localPart || suggested, domainId: domain?.id } : null,
        mailboxIds: shared,
        password: authMethod === 'manual' && manualPassword.trim() ? manualPassword.trim() : undefined,
        sendInvitation: authMethod === 'invite',
      });
      onCreated({
        id: r.id,
        name,
        email: r.email,
        password: authMethod === 'manual' ? r.password : undefined,
        alternateEmail: alternateEmail.trim() || null,
        inviteUrl: r.inviteUrl,
      });
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Add a mailbox user"
      description="Create a user, configure their inbox, and deliver credentials."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            type="submit"
            form="create-user"
            loading={busy}
            icon={authMethod === 'invite' ? <Mail className="h-4 w-4" /> : undefined}
            disabled={mode === 'new' && !domain}
          >
            {authMethod === 'invite' ? 'Send Credentials' : 'Add user'}
          </Button>
        </>
      }
    >
      <form id="create-user" onSubmit={submit} className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="grid grid-cols-[1fr_150px] gap-2.5">
          <Field label="Full name" id="name">
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus placeholder="e.g. Jane Doe" />
          </Field>
          <Field label="Role" id="role">
            <Select id="role" value={role} onChange={(e) => setRole(e.target.value as 'member' | 'admin')}>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </Select>
          </Field>
        </div>
        <p className="-mt-2 text-xs text-muted">{role === 'admin' ? 'Admins manage domains, providers, inboxes and users.' : 'Members use their inboxes and nothing else.'}</p>
        
        <ChoiceCards
          value={mode}
          onChange={setMode}
          options={[
            { value: 'new', label: 'Create a new inbox', hint: 'This becomes their business mailbox and sign-in.' },
            { value: 'existing', label: 'Sign-in email only', hint: 'Any address; give them access to shared inboxes below.' },
          ]}
        />
        {mode === 'new' ? (
          <div className="space-y-1">
            <Field label="Business mailbox address" id="local">
              <AddressInput id="local" local={localPart} onLocal={setLocalPart} domainId={domain?.id} onDomain={setDomainId} domains={domainList} placeholder={suggested || 'jane'} />
            </Field>
            {mailboxPreview && (
              <div className="text-xs text-muted">
                Mailbox: <span className="font-mono font-medium text-fg">{mailboxPreview}</span>
              </div>
            )}
          </div>
        ) : (
          <Field label="Sign-in email" id="email">
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
        )}

        <Field label="Alternate / recovery email" id="alternateEmail" hint="Personal email where credentials and activation links will be delivered.">
          <Input
            id="alternateEmail"
            type="email"
            value={alternateEmail}
            onChange={(e) => setAlternateEmail(e.target.value)}
            placeholder="e.g. user.personal@gmail.com"
            required={authMethod === 'invite'}
          />
        </Field>

        <Field label="Password setup method">
          <ChoiceCards
            value={authMethod}
            onChange={setAuthMethod}
            options={[
              {
                value: 'invite',
                label: 'Email invitation link (Recommended)',
                hint: 'Sends a secure, single-use password setup link to their alternate email.',
              },
              {
                value: 'manual',
                label: 'Manual temporary password',
                hint: 'Set or auto-generate a temporary password to share manually.',
              },
            ]}
          />
        </Field>

        {authMethod === 'manual' && (
          <Field label="Temporary password" hint="Leave blank to auto-generate a secure 16-character password.">
            <Input
              type="password"
              value={manualPassword}
              onChange={(e) => setManualPassword(e.target.value)}
              placeholder="Auto-generated if blank"
              minLength={10}
            />
          </Field>
        )}

        <Field label="Storage quota (MB)" hint="Optional storage limit. Leave blank for unlimited.">
          <Input
            type="number"
            min={0}
            value={storageQuota}
            onChange={(e) => setStorageQuota(e.target.value)}
            placeholder="Unlimited"
          />
        </Field>

        {!!mailboxes.data?.length && (
          <Field label="Also give access to shared inboxes">
            <div className="scroll-thin flex max-h-40 flex-col gap-2 overflow-y-auto pt-0.5">
              {mailboxes.data.map((m) => {
                const on = shared.includes(m.id);
                const toggle = (v: boolean) => setShared((s) => (v ? [...s, m.id] : s.filter((x) => x !== m.id)));
                return (
                  <div key={m.id} className="flex cursor-pointer items-center gap-2.5 text-[13px]" onClick={() => toggle(!on)}>
                    <Tick checked={on} onChange={toggle} label={m.address} />
                    {m.address}
                    <span className="truncate text-faint">· {m.displayName || (m.kind === 'shared' ? 'Shared inbox' : 'Personal')}</span>
                  </div>
                );
              })}
            </div>
          </Field>
        )}
      </form>
    </Dialog>
  );
}

function DeleteUserDialog({ user, users, onClose, onDeleted }: { user: UserSummary; users: UserSummary[]; onClose: () => void; onDeleted: () => void }) {
  const [reassign, setReassign] = useState<number | ''>('');
  const { run, busy } = useAction();
  const target = users.find((u) => u.id === reassign);
  return (
    <ConfirmDialog
      open
      danger
      onClose={onClose}
      title={`Delete ${user.name || user.email}?`}
      confirmLabel="Delete user"
      loading={!!busy}
      onConfirm={() => run('delete', () => del(`/admin/users/${user.id}${reassign ? `?reassignTo=${reassign}` : ''}`).then(onDeleted), 'User deleted')}
    >
      <p>They lose access immediately. Their inboxes and mail are kept.</p>
      <div className="mt-4 text-fg">
        <Field label="Give their inbox access and assigned conversations to" hint={target ? `Their inboxes and assigned conversations move to ${target.name || target.email}.` : undefined}>
          <Select value={reassign} onChange={(e) => setReassign(e.target.value ? Number(e.target.value) : '')}>
            <option value="">Nobody</option>
            {users
              .filter((u) => u.id !== user.id)
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name || u.email}
                </option>
              ))}
          </Select>
        </Field>
      </div>
    </ConfirmDialog>
  );
}
