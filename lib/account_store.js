/**
 * Unified account store — Supabase when configured, else SQLite mirror (dev/E2E).
 */
const crypto = require("crypto");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

function supabaseServiceKey() {
  return process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
}

const useSupabase = Boolean(process.env.SUPABASE_URL && supabaseServiceKey());
const runningInFunction = Boolean(
  process.env.NETLIFY ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.AWS_EXECUTION_ENV ||
  process.env.LAMBDA_TASK_ROOT
);
const defaultSqlitePath = runningInFunction
  ? path.join("/tmp", "sentinel_account.sqlite")
  : path.join(__dirname, "..", "sentinel_account.sqlite");

let supabase = null;
let db = null;

function getDb() {
  if (!db) {
    db = new sqlite3.Database(
      process.env.SQLITE_PATH || defaultSqlitePath
    );
  }
  return db;
}

function initSqlite() {
  return new Promise((resolve, reject) => {
    const d = getDb();
    d.serialize(() => {
      d.run(`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT,
        email_verified INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
      )`);
      d.run(`CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        full_name TEXT,
        created_at TEXT NOT NULL
      )`);
      d.run(`CREATE TABLE IF NOT EXISTS subscriptions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        stripe_customer_id TEXT,
        stripe_subscription_id TEXT UNIQUE,
        plan TEXT NOT NULL,
        status TEXT NOT NULL,
        current_period_end TEXT,
        created_at TEXT NOT NULL
      )`);
      d.run(`CREATE TABLE IF NOT EXISTS product_licenses (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        license_key TEXT UNIQUE NOT NULL,
        tier TEXT DEFAULT 'pro',
        plan TEXT,
        machine_id TEXT,
        activated_at TEXT,
        created_at TEXT NOT NULL
      )`);
      d.run(`CREATE TABLE IF NOT EXISTS payment_history (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        stripe_payment_intent TEXT,
        stripe_invoice_id TEXT,
        amount_cents INTEGER,
        currency TEXT,
        plan TEXT,
        status TEXT,
        created_at TEXT NOT NULL
      )`);
      d.run(`CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        action TEXT,
        detail TEXT,
        created_at TEXT NOT NULL
      )`);
      d.run(`CREATE TABLE IF NOT EXISTS activation_codes (
        code TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        user_id TEXT,
        created_at TEXT NOT NULL,
        activated_at TEXT,
        machine_id TEXT
      )`);
      d.run(`CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT, email TEXT, subject TEXT, message TEXT, created_at TEXT NOT NULL
      )`);
      d.run(`CREATE TABLE IF NOT EXISTS drive_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        created_at TEXT NOT NULL
      )`, err => (err ? reject(err) : resolve()));
    });
  });
}

async function init() {
  if (useSupabase) {
    const { createClient } = require("@supabase/supabase-js");
    supabase = createClient(
      process.env.SUPABASE_URL,
      supabaseServiceKey(),
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    return { backend: "supabase" };
  }
  await initSqlite();
  return { backend: "sqlite" };
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = (stored || "").split(":");
  if (!salt || !hash) return false;
  const test = crypto.scryptSync(password, salt, 64).toString("hex");
  return test === hash;
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
  });
}

async function audit(userId, action, detail = {}) {
  if (useSupabase) {
    await supabase.from("audit_logs").insert({ user_id: userId, action, detail });
    return;
  }
  await run(
    "INSERT INTO audit_logs(user_id, action, detail, created_at) VALUES (?, ?, ?, ?)",
    [userId, action, JSON.stringify(detail), new Date().toISOString()]
  );
}

async function signUp(email, password, fullName = "") {
  const em = (email || "").trim().toLowerCase();
  if (!em || !password) throw new Error("email and password required");

  if (useSupabase) {
    const { data, error } = await supabase.auth.signUp({
      email: em,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) throw error;
    const uid = data.user?.id;
    if (uid) {
      await supabase.from("profiles").upsert({
        id: uid,
        email: em,
        full_name: fullName,
        updated_at: new Date().toISOString(),
      });
      await audit(uid, "signup", { email: em });
    }
    return { user_id: uid, email: em, session: data.session };
  }

  const existing = await get("SELECT id FROM users WHERE email = ?", [em]);
  if (existing) throw new Error("Email already registered");
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await run(
    "INSERT INTO users(id, email, password_hash, email_verified, created_at) VALUES (?, ?, ?, 1, ?)",
    [id, em, hashPassword(password), now]
  );
  await run("INSERT INTO profiles(id, email, full_name, created_at) VALUES (?, ?, ?, ?)", [
    id,
    em,
    fullName,
    now,
  ]);
  await audit(id, "signup", { email: em });
  return { user_id: id, email: em, email_verified: true };
}

async function signIn(email, password) {
  const em = (email || "").trim().toLowerCase();
  if (useSupabase) {
    const { data, error } = await supabase.auth.signInWithPassword({ email: em, password });
    if (error) throw error;
    await audit(data.user?.id, "login", {});
    return {
      user_id: data.user?.id,
      email: em,
      access_token: data.session?.access_token,
      refresh_token: data.session?.refresh_token,
    };
  }
  const row = await get("SELECT * FROM users WHERE email = ?", [em]);
  if (!row || !verifyPassword(password, row.password_hash)) {
    throw new Error("Invalid email or password");
  }
  await audit(row.id, "login", {});
  return { user_id: row.id, email: em, access_token: `local-${row.id}` };
}

async function getUserByEmail(email) {
  const em = (email || "").trim().toLowerCase();
  if (useSupabase) {
    const { data } = await supabase.from("profiles").select("*").eq("email", em).maybeSingle();
    return data;
  }
  return get("SELECT * FROM profiles WHERE email = ?", [em]);
}

async function createLicense({ userId, email, plan }) {
  const licenseKey = crypto.randomUUID();
  const now = new Date().toISOString();
  if (useSupabase) {
    await supabase.from("product_licenses").insert({
      user_id: userId,
      license_key: licenseKey,
      tier: "pro",
      plan,
      created_at: now,
    });
  } else {
    await run(
      `INSERT INTO product_licenses(id, user_id, license_key, tier, plan, created_at)
       VALUES (?, ?, ?, 'pro', ?, ?)`,
      [crypto.randomUUID(), userId || null, licenseKey, plan, now]
    );
    await run(
      "INSERT OR REPLACE INTO activation_codes(code, email, user_id, created_at) VALUES (?, ?, ?, ?)",
      [licenseKey, email, userId || null, now]
    );
  }
  await audit(userId, "license_created", { plan, license_key: licenseKey });
  return licenseKey;
}

async function syncSubscription({
  userId,
  email,
  plan,
  status,
  stripeCustomerId,
  stripeSubscriptionId,
  currentPeriodEnd,
}) {
  const now = new Date().toISOString();
  if (useSupabase) {
    await supabase.from("subscriptions").upsert(
      {
        user_id: userId,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
        plan,
        status,
        current_period_end: currentPeriodEnd,
        updated_at: now,
      },
      { onConflict: "stripe_subscription_id" }
    );
  } else {
    const existing = stripeSubscriptionId
      ? await get("SELECT id FROM subscriptions WHERE stripe_subscription_id = ?", [
          stripeSubscriptionId,
        ])
      : null;
    if (existing) {
      await run(
        `UPDATE subscriptions SET status = ?, plan = ?, current_period_end = ?, user_id = ? WHERE id = ?`,
        [status, plan, currentPeriodEnd, userId, existing.id]
      );
    } else {
      await run(
        `INSERT INTO subscriptions(id, user_id, stripe_customer_id, stripe_subscription_id, plan, status, current_period_end, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          crypto.randomUUID(),
          userId,
          stripeCustomerId,
          stripeSubscriptionId,
          plan,
          status,
          currentPeriodEnd,
          now,
        ]
      );
    }
  }
  await audit(userId, "subscription_sync", { plan, status });
}

async function recordPayment({
  userId,
  amountCents,
  plan,
  status,
  stripePaymentIntent,
  stripeInvoiceId,
}) {
  const now = new Date().toISOString();
  if (useSupabase) {
    await supabase.from("payment_history").insert({
      user_id: userId,
      amount_cents: amountCents,
      plan,
      status,
      stripe_payment_intent: stripePaymentIntent,
      stripe_invoice_id: stripeInvoiceId,
      created_at: now,
    });
  } else {
    await run(
      `INSERT INTO payment_history(id, user_id, stripe_payment_intent, stripe_invoice_id, amount_cents, currency, plan, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'usd', ?, ?, ?)`,
      [
        crypto.randomUUID(),
        userId,
        stripePaymentIntent,
        stripeInvoiceId,
        amountCents,
        plan,
        status,
        now,
      ]
    );
  }
}

async function validateLicense(code, machineId) {
  if (useSupabase) {
    const { data: lic } = await supabase
      .from("product_licenses")
      .select("*")
      .eq("license_key", code)
      .maybeSingle();
    if (!lic) return { valid: false };
    if (lic.machine_id && lic.machine_id !== machineId) return { valid: false };
    if (!lic.machine_id) {
      await supabase
        .from("product_licenses")
        .update({ machine_id: machineId, activated_at: new Date().toISOString() })
        .eq("license_key", code);
    }
    if (lic.user_id) {
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("status, plan")
        .eq("user_id", lic.user_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (sub?.status === "canceled") return { valid: false, reason: "subscription_canceled" };
      return { valid: true, tier: lic.tier || "pro", plan: lic.plan || sub?.plan, activated: true };
    }
    return { valid: true, tier: lic.tier || "pro", plan: lic.plan, activated: true };
  }
  let lic = await get("SELECT * FROM product_licenses WHERE license_key = ?", [code]);
  if (!lic) {
    const legacy = await get("SELECT * FROM activation_codes WHERE code = ?", [code]);
    if (!legacy) return { valid: false };
    lic = {
      license_key: legacy.code,
      user_id: legacy.user_id,
      machine_id: legacy.machine_id,
      plan: null,
      tier: "pro",
    };
  }
  if (lic.machine_id && lic.machine_id !== machineId) return { valid: false };
  if (!lic.machine_id) {
    const now = new Date().toISOString();
    await run("UPDATE product_licenses SET machine_id = ?, activated_at = ? WHERE license_key = ?", [
      machineId,
      now,
      code,
    ]);
    await run("UPDATE activation_codes SET machine_id = ?, activated_at = ? WHERE code = ?", [
      machineId,
      now,
      code,
    ]);
  }
  const sub = lic.user_id
    ? await get("SELECT status, plan FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1", [
        lic.user_id,
      ])
    : null;
  if (sub && sub.status === "canceled") return { valid: false, reason: "subscription_canceled" };
  return { valid: true, tier: "pro", plan: lic.plan || sub?.plan, activated: true };
}

async function activateLicense(code, machineId) {
  return validateLicense(code, machineId);
}

async function getDashboard(userId) {
  if (useSupabase) {
    const [profile, subs, licenses, payments] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).single(),
      supabase.from("subscriptions").select("*").eq("user_id", userId),
      supabase.from("product_licenses").select("license_key, tier, plan, activated_at, created_at").eq("user_id", userId),
      supabase.from("payment_history").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
    ]);
    return {
      profile: profile.data,
      subscriptions: subs.data || [],
      licenses: licenses.data || [],
      payments: payments.data || [],
    };
  }
  const profile = await get("SELECT * FROM profiles WHERE id = ?", [userId]);
  const subscriptions = await all("SELECT * FROM subscriptions WHERE user_id = ?", [userId]);
  const licenses = await all(
    "SELECT license_key, tier, plan, activated_at, created_at FROM product_licenses WHERE user_id = ?",
    [userId]
  );
  const payments = await all(
    "SELECT * FROM payment_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 20",
    [userId]
  );
  return { profile, subscriptions, licenses, payments };
}

async function resolveUserIdForEmail(email) {
  const profile = await getUserByEmail(email);
  if (profile) return profile.id;
  if (useSupabase) return null;
  const u = await get("SELECT id FROM users WHERE email = ?", [(email || "").trim().toLowerCase()]);
  return u?.id || null;
}

async function getLicenseByKey(code) {
  if (!code) return null;
  if (useSupabase) {
    const { data } = await supabase.from("product_licenses").select("*").eq("license_key", code).maybeSingle();
    return data;
  }
  return get("SELECT * FROM product_licenses WHERE license_key = ?", [code]);
}

async function getProfileById(userId) {
  if (!userId) return null;
  if (useSupabase) {
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    return data;
  }
  return get("SELECT * FROM profiles WHERE id = ?", [userId]);
}

module.exports = {
  init,
  useSupabase: () => useSupabase,
  signUp,
  signIn,
  getUserByEmail,
  resolveUserIdForEmail,
  getLicenseByKey,
  getProfileById,
  createLicense,
  syncSubscription,
  recordPayment,
  validateLicense,
  activateLicense,
  getDashboard,
  audit,
  getDb,
  run,
  get,
  all,
};
