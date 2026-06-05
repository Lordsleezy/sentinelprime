/**
 * Product analytics — Supabase when configured, else SQLite (dev/E2E).
 * All writes are fire-and-forget safe (errors logged, never thrown to callers).
 */
const crypto = require("crypto");
const account = require("./account_store");

const useSupabase = () => account.useSupabase();

function supabase() {
  const { createClient } = require("@supabase/supabase-js");
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function initSqliteTables() {
  await account.run(`CREATE TABLE IF NOT EXISTS download_events (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    country TEXT,
    referrer TEXT,
    version TEXT,
    channel TEXT
  )`);
  await account.run(`CREATE TABLE IF NOT EXISTS installs (
    install_id TEXT PRIMARY KEY,
    version TEXT,
    os TEXT,
    arch TEXT,
    installed_at TEXT NOT NULL,
    trial_started_at TEXT,
    created_at TEXT NOT NULL
  )`);
  await account.run(`CREATE TABLE IF NOT EXISTS trial_events (
    id TEXT PRIMARY KEY,
    install_id TEXT,
    started_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);
  await account.run(`CREATE TABLE IF NOT EXISTS license_events (
    id TEXT PRIMARY KEY,
    install_id TEXT,
    license_key TEXT,
    email TEXT,
    event_type TEXT NOT NULL,
    machine_id TEXT,
    created_at TEXT NOT NULL
  )`);
}

async function init() {
  if (!useSupabase()) await initSqliteTables();
  return { backend: useSupabase() ? "supabase" : "sqlite" };
}

function safe(fn) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (e) {
      console.error("[analytics]", e.message);
      return null;
    }
  };
}

const recordDownloadEvent = safe(async ({
  ip_address,
  user_agent,
  country,
  referrer,
  version,
  channel = "windows",
}) => {
  const now = new Date().toISOString();
  if (useSupabase()) {
    const sb = supabase();
    await sb.from("download_events").insert({
      ip_address: ip_address || null,
      user_agent: user_agent || null,
      country: country || null,
      referrer: referrer || null,
      version: version || null,
      channel,
      created_at: now,
    });
    return;
  }
  await account.run(
    `INSERT INTO download_events(id, created_at, ip_address, user_agent, country, referrer, version, channel)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [crypto.randomUUID(), now, ip_address, user_agent, country, referrer, version, channel]
  );
});

const recordInstall = safe(async ({ install_id, version, os, arch, installed_at, trial_start }) => {
  const at = installed_at || new Date().toISOString();
  const trialAt = trial_start ? at : null;
  if (useSupabase()) {
    const sb = supabase();
    await sb.from("installs").upsert(
      {
        install_id,
        version: version || null,
        os: os || null,
        arch: arch || null,
        installed_at: at,
        trial_started_at: trialAt,
      },
      { onConflict: "install_id" }
    );
    if (trial_start) {
      await sb.from("trial_events").insert({
        install_id,
        started_at: at,
      });
    }
    return;
  }
  await account.run(
    `INSERT OR REPLACE INTO installs(install_id, version, os, arch, installed_at, trial_started_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [install_id, version, os, arch, at, trialAt, at]
  );
  if (trial_start) {
    await account.run(
      `INSERT INTO trial_events(id, install_id, started_at, created_at) VALUES (?, ?, ?, ?)`,
      [crypto.randomUUID(), install_id, at, at]
    );
  }
});

const recordTrialStart = safe(async ({ install_id, started_at }) => {
  const at = started_at || new Date().toISOString();
  if (useSupabase()) {
    const sb = supabase();
    await sb.from("trial_events").insert({ install_id, started_at: at });
    await sb
      .from("installs")
      .update({ trial_started_at: at })
      .eq("install_id", install_id);
    return;
  }
  await account.run(
    `INSERT INTO trial_events(id, install_id, started_at, created_at) VALUES (?, ?, ?, ?)`,
    [crypto.randomUUID(), install_id, at, at]
  );
  await account.run(`UPDATE installs SET trial_started_at = ? WHERE install_id = ?`, [at, install_id]);
});

const recordLicenseEvent = safe(
  async ({ install_id, license_key, email, event_type, machine_id }) => {
    const now = new Date().toISOString();
    if (!["activation", "validation"].includes(event_type)) return;
    if (useSupabase()) {
      const sb = supabase();
      await sb.from("license_events").insert({
        install_id: install_id || null,
        license_key: license_key || null,
        email: email || null,
        event_type,
        machine_id: machine_id || null,
        created_at: now,
      });
      return;
    }
    await account.run(
      `INSERT INTO license_events(id, install_id, license_key, email, event_type, machine_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        install_id,
        license_key,
        email,
        event_type,
        machine_id,
        now,
      ]
    );
  }
);

function bucketRows(rows, dateField = "created_at", days = 30) {
  const buckets = {};
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    buckets[key] = 0;
  }
  for (const row of rows) {
    const raw = row[dateField] || row.installed_at || row.started_at;
    if (!raw) continue;
    const key = String(raw).slice(0, 10);
    if (key in buckets) buckets[key] += 1;
  }
  return Object.entries(buckets).map(([date, count]) => ({ date, count }));
}

function sumPayments(rows) {
  return rows.reduce((acc, p) => {
    if ((p.status || "").toLowerCase() === "succeeded" || (p.status || "").toLowerCase() === "paid") {
      return acc + (p.amount_cents || 0);
    }
    return acc;
  }, 0);
}

async function getAdminAnalytics() {
  const now = new Date();
  const trialCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  if (useSupabase()) {
    const sb = supabase();
    const [downloads, downloadsTotal, installs, installsTotal, trials, converted, payments, subs] =
      await Promise.all([
        sb.from("download_events").select("created_at").gte("created_at", monthAgo).order("created_at", { ascending: true }),
        sb.from("download_events").select("*", { count: "exact", head: true }),
        sb.from("installs").select("install_id, installed_at, trial_started_at").gte("installed_at", monthAgo),
        sb.from("installs").select("*", { count: "exact", head: true }),
        sb.from("trial_events").select("install_id, started_at").gte("started_at", trialCutoff),
        sb
          .from("product_licenses")
          .select("*", { count: "exact", head: true })
          .not("activated_at", "is", null),
        sb.from("payment_history").select("amount_cents, status, created_at").gte("created_at", monthAgo),
        sb.from("subscriptions").select("status").eq("status", "active"),
      ]);
    const downloadRows = downloads.data || [];
    const installRows = installs.data || [];
    const trialRows = trials.data || [];
    const paymentRows = payments.data || [];
    return {
      downloads: {
        total: downloadsTotal.count || 0,
        daily: bucketRows(downloadRows, "created_at", 30),
      },
      installs: {
        total: installsTotal.count || 0,
        daily: bucketRows(installRows, "installed_at", 30),
      },
      active_trials: trialRows.length,
      converted_users: converted.count || 0,
      active_subscriptions: (subs.data || []).length,
      revenue_cents: sumPayments(paymentRows),
      revenue_usd: (sumPayments(paymentRows) / 100).toFixed(2),
    };
  }

  const downloadRows = await account.all(
    "SELECT created_at FROM download_events WHERE created_at >= ? ORDER BY created_at",
    [monthAgo]
  );
  const installRows = await account.all("SELECT install_id, installed_at, trial_started_at FROM installs");
  const trialRows = await account.all(
    "SELECT install_id, started_at FROM trial_events WHERE started_at >= ?",
    [trialCutoff]
  );
  const convertedRow = await account.get(
    `SELECT COUNT(*) AS c FROM product_licenses WHERE activated_at IS NOT NULL`
  );
  const downloadsTotal = await account.get(`SELECT COUNT(*) AS c FROM download_events`);
  const installsTotal = await account.get(`SELECT COUNT(*) AS c FROM installs`);
  const paymentRows = await account.all(
    "SELECT amount_cents, status, created_at FROM payment_history WHERE created_at >= ?",
    [monthAgo]
  );
  const subs = await account.all(`SELECT status FROM subscriptions WHERE status = 'active'`);

  return {
    downloads: { total: downloadsTotal?.c || 0, daily: bucketRows(downloadRows, "created_at", 30) },
    installs: { total: installsTotal?.c || 0, daily: bucketRows(installRows, "installed_at", 30) },
    active_trials: trialRows.length,
    converted_users: convertedRow?.c || 0,
    active_subscriptions: subs.length,
    revenue_cents: sumPayments(paymentRows),
    revenue_usd: (sumPayments(paymentRows) / 100).toFixed(2),
  };
}

module.exports = {
  init,
  recordDownloadEvent,
  recordInstall,
  recordTrialStart,
  recordLicenseEvent,
  getAdminAnalytics,
};
