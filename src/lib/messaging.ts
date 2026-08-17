/**
 * Whether patient messaging is switched on for this deployment.
 *
 * The clinic does not use SMS or email today, so both channels are dormant:
 * nothing is sent, no provider is contacted, and no sms_logs / email_logs rows
 * are written. The tables, historical rows, adapters and patient contact
 * fields are all left intact — this only stops the active work.
 *
 * The switch is the provider setting that already existed (`SMS_PROVIDER` /
 * `EMAIL_PROVIDER`), so there is no new configuration system to learn. A
 * channel is live only when it names a real provider. "mock" counts as off:
 * it never delivered anything, it only wrote log rows and console lines.
 *
 * To re-enable later, set the provider (and its credentials) in the
 * environment — e.g. SMS_PROVIDER=sparrow, EMAIL_PROVIDER=resend. No code
 * change is needed; every call site below re-activates on its own.
 */
/* TEst fr Commit */
const DORMANT = new Set(["", "mock", "off", "none", "disabled"]);

function live(provider: string | undefined): boolean {
  return !DORMANT.has((provider ?? "").trim().toLowerCase());
}

/** True when a real SMS provider is configured. */
export const SMS_ENABLED = live(process.env.SMS_PROVIDER);

/** True when a real email provider is configured. */
export const EMAIL_ENABLED = live(process.env.EMAIL_PROVIDER);

/** True when either channel is live — used to show/hide messaging UI. */
export const MESSAGING_ENABLED = SMS_ENABLED || EMAIL_ENABLED;
