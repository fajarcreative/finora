(() => {
  'use strict';

  const SUPABASE_URL = 'https://cuyllsugrnefuehzhvwx.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_75ygnr8HLbRxESEVBqcdZw_-2VXIUub';

  const VAULT_KEY = 'finora_vault_v1';
  const TAB_SESSION_KEY = 'finora_tab_session_v1';
  const PWA_SESSION_KEY = 'finora_pwa_session_v1';
  const INSTALLED_KEY = 'finora_installed_v1';
  const SYNC_QUEUE_KEY = 'finora_sync_queue_v1';
  const PENDING_MIGRATION_KEY = 'finora_pending_migration_v1';

  const sb = window.supabase && typeof window.supabase.createClient === 'function'
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      })
    : null;

  const EXPENSE_CATEGORIES = [
    { id: 'makan', name: 'Makan & Minum', icon: 'restaurant' },
    { id: 'dapur', name: 'Belanja Dapur', icon: 'shopping_cart' },
    { id: 'transport', name: 'Transportasi', icon: 'directions_subway' },
    { id: 'tagihan', name: 'Tagihan & Air', icon: 'bolt' },
    { id: 'hiburan', name: 'Hiburan & Santai', icon: 'sports_esports' },
    { id: 'kesehatan', name: 'Kesehatan', icon: 'medical_services' },
    { id: 'pendidikan', name: 'Pendidikan', icon: 'school' },
    { id: 'lainnya', name: 'Lain-lain', icon: 'more_horiz' }
  ];

  const INCOME_CATEGORIES = [
    { id: 'gaji', name: 'Gaji & Bonus', icon: 'payments' },
    { id: 'freelance', name: 'Freelance', icon: 'work' },
    { id: 'investasi', name: 'Hasil Investasi', icon: 'trending_up' },
    { id: 'hadiah', name: 'Pemasukan Lain', icon: 'redeem' }
  ];

  const TAGS = ['#KebutuhanPokok', '#RutinHarian', '#BisaDitekan', '#Darurat'];

  const SUBTITLES = {
    beranda: 'Smart Personal Finance',
    mutasi: 'Riwayat Mutasi Lengkap',
    catat: 'Catat Transaksi Harian',
    budget: 'Budget & Pengaturan Kas',
    laporan: 'Laporan & Spreadsheet'
  };

  function toISODate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function daysAgoISO(days) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return toISODate(d);
  }

  function createEmptyBudgets() {
    const budgets = {};
    EXPENSE_CATEGORIES.forEach((c) => { budgets[c.id] = 0; });
    return budgets;
  }

  function createEmptyUserData(userName, extra = {}) {
    return {
      userName: userName || 'Pengguna',
      hideBalance: false,
      pinSalt: extra.pinSalt || '',
      pinHash: extra.pinHash || '',
      wallets: [
        { id: 'tunai', name: 'Dompet Tunai', subtitle: 'Uang fisik di saku', icon: 'payments', badge: 'Aktif', balance: 0 },
        { id: 'bca', name: 'Rekening Bank', subtitle: 'Gaji & Operasional', icon: 'account_balance', badge: 'Utama', balance: 0 },
        { id: 'ewallet', name: 'E-Wallet', subtitle: 'GoPay / OVO / DANA', icon: 'wallet', badge: 'Tersinkron', balance: 0 }
      ],
      budgets: createEmptyBudgets(),
      transactions: []
    };
  }

  function loadVault() {
    try {
      const raw = localStorage.getItem(VAULT_KEY);
      if (!raw) return { accounts: {} };
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.accounts !== 'object') return { accounts: {} };
      return parsed;
    } catch {
      return { accounts: {} };
    }
  }

  function saveVault() {
    try {
      localStorage.setItem(VAULT_KEY, JSON.stringify(vault));
    } catch {
      // Ignore storage quota errors
    }
  }

  function loadSyncQueueMap() {
    try {
      const raw = localStorage.getItem(SYNC_QUEUE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  function saveSyncQueueMap(map) {
    try {
      localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(map));
    } catch {
      // Ignore storage quota errors
    }
  }

  function getQueuedOps(email) {
    const clean = normalizeEmail(email);
    if (!clean) return [];
    const map = loadSyncQueueMap();
    return Array.isArray(map[clean]) ? map[clean] : [];
  }

  function enqueueSyncOp(email, op) {
    const clean = normalizeEmail(email);
    if (!clean) return;
    const map = loadSyncQueueMap();
    const list = Array.isArray(map[clean]) ? map[clean] : [];
    list.push({ ...op, queuedAt: Date.now() });
    map[clean] = list;
    saveSyncQueueMap(map);
  }

  function setQueuedOps(email, ops) {
    const clean = normalizeEmail(email);
    if (!clean) return;
    const map = loadSyncQueueMap();
    if (!ops || ops.length === 0) delete map[clean];
    else map[clean] = ops;
    saveSyncQueueMap(map);
  }

  function getPendingMigrationEmails() {
    try {
      const raw = localStorage.getItem(PENDING_MIGRATION_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  function setPendingMigration(email, flag) {
    const clean = normalizeEmail(email);
    if (!clean) return;
    const map = getPendingMigrationEmails();
    if (flag) map[clean] = true;
    else delete map[clean];
    try {
      localStorage.setItem(PENDING_MIGRATION_KEY, JSON.stringify(map));
    } catch {
      // Ignore storage errors
    }
  }

  function generateSalt() {
    if (window.crypto && window.crypto.getRandomValues) {
      const arr = new Uint8Array(12);
      window.crypto.getRandomValues(arr);
      return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
    }
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  async function hashPassword(password, salt) {
    const input = `${salt}:${password}`;
    if (window.crypto && window.crypto.subtle) {
      const encoded = new TextEncoder().encode(input);
      const buf = await window.crypto.subtle.digest('SHA-256', encoded);
      return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
    }
    // Lightweight fallback for non-HTTPS origins
    let h1 = 0x811c9dc5;
    let h2 = 0x01000193;
    for (let i = 0; i < input.length; i++) {
      const c = input.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 16777619);
      h2 = Math.imul(h2 ^ (c + i), 2246822519);
    }
    return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
  }

  function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function isStandaloneMode() {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: minimal-ui)').matches ||
      window.navigator.standalone === true
    );
  }

  function isAppInstalled() {
    return isStandaloneMode() || localStorage.getItem(INSTALLED_KEY) === '1';
  }

  function getActiveSessionEmail() {
    try {
      const tabEmail = normalizeEmail(sessionStorage.getItem(TAB_SESSION_KEY));
      if (tabEmail && vault.accounts[tabEmail]) return tabEmail;
      if (isStandaloneMode()) {
        const pwaEmail = normalizeEmail(localStorage.getItem(PWA_SESSION_KEY));
        if (pwaEmail && vault.accounts[pwaEmail]) return pwaEmail;
      }
    } catch {
      // Ignore storage access errors
    }
    return '';
  }

  function setActiveSession(email, rememberInPwa) {
    const clean = normalizeEmail(email);
    currentEmail = clean;
    try {
      sessionStorage.setItem(TAB_SESSION_KEY, clean);
      if (isStandaloneMode() && rememberInPwa) {
        localStorage.setItem(PWA_SESSION_KEY, clean);
      } else {
        localStorage.removeItem(PWA_SESSION_KEY);
      }
    } catch {
      // Ignore storage errors
    }
  }

  function clearActiveSession() {
    currentEmail = '';
    cloudUser = null;
    unsubscribeRealtime();
    try {
      sessionStorage.removeItem(TAB_SESSION_KEY);
      localStorage.removeItem(PWA_SESSION_KEY);
    } catch {
      // Ignore storage errors
    }
  }

  function getAuthRedirectUrl() {
    return `${window.location.origin}${window.location.pathname}`;
  }

  function isMissingColumnError(err) {
    const code = String(err?.code || '');
    const msg = String(err?.message || '');
    return (
      code === '42703' ||
      code === 'PGRST204' ||
      /Could not find the '.*' column|column .* does not exist/i.test(msg)
    );
  }

  function isMissingSchemaError(err) {
    const code = String(err?.code || '');
    const msg = String(err?.message || '');
    return (
      code === 'PGRST205' ||
      code === '42P01' ||
      code === '42883' ||
      /does not exist|Could not find the table|Could not find the function/i.test(msg)
    );
  }

  function isNetworkError(err) {
    if (!navigator.onLine) return true;
    const msg = String(err?.message || '');
    return /Failed to fetch|NetworkError|Load failed|fetch/i.test(msg);
  }

  function mapAuthErrorMessage(err) {
    const msg = String(err?.message || 'Terjadi kesalahan autentikasi');
    if (/Invalid login credentials/i.test(msg)) {
      return 'Email atau password salah. Pastikan akun sudah terdaftar.';
    }
    if (/Email not confirmed/i.test(msg)) {
      return 'Email belum dikonfirmasi. Cek kotak masuk / folder spam email Anda.';
    }
    if (/User already registered/i.test(msg)) {
      return 'Email ini sudah terdaftar di Cloud. Silakan masuk melalui tab Masuk Akun.';
    }
    if (/Password should be at least/i.test(msg)) {
      return 'Password minimal 6 karakter.';
    }
    if (/rate limit|too many requests/i.test(msg)) {
      return 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.';
    }
    return msg;
  }

  let vault = loadVault();
  let currentEmail = getActiveSessionEmail();
  let cloudUser = null;
  let state = currentEmail && vault.accounts[currentEmail]
    ? vault.accounts[currentEmail].data
    : null;

  let activeTab = getInitialTab();
  let authMode = 'login'; // 'login' | 'register'
  let authBusy = false;
  let isBootstrapping = Boolean(sb);
  let pendingVerificationEmail = '';
  let syncStatus = 'idle'; // 'idle' | 'syncing' | 'synced' | 'offline' | 'local-only' | 'schema-missing'
  let lastSyncError = '';
  let lastSyncedAt = null;
  let realtimeChannel = null;
  let realtimeRefreshTimer = null;
  let mutasiFilters = { search: '', type: 'all', categoryId: 'all', walletId: 'all' };
  let catatDraft = {
    type: 'expense',
    amount: 0,
    categoryId: 'makan',
    walletId: 'tunai',
    date: toISODate(new Date()),
    time: new Date().toTimeString().slice(0, 5),
    note: '',
    tag: '#KebutuhanPokok',
    receiptName: ''
  };
  let reportRange = 'weekly';
  let reportOffset = 0;
  let deferredInstallPrompt = null;
  let installBannerDismissed = false;

  const authScreenEl = document.getElementById('auth-screen');
  const appShellEl = document.getElementById('app-shell');
  const mainEl = document.getElementById('app-main');
  const subtitleEl = document.getElementById('header-subtitle');
  const avatarEl = document.getElementById('header-avatar');
  const modalRoot = document.getElementById('modal-root');
  const toastRoot = document.getElementById('toast-root');
  const headerInstallBtn = document.getElementById('header-install-btn');

  function cacheUserStateLocally(email, data, extra = {}) {
    const clean = normalizeEmail(email);
    if (!clean || !data) return;
    const prev = vault.accounts[clean] || {};
    vault.accounts[clean] = {
      email: clean,
      name: data.userName || prev.name || 'Pengguna',
      salt: prev.salt || '',
      passwordHash: prev.passwordHash || '',
      createdAt: extra.createdAt || prev.createdAt || new Date().toISOString(),
      cloudLinked: extra.cloudLinked ?? prev.cloudLinked ?? Boolean(cloudUser),
      data
    };
    saveVault();
  }

  function saveState() {
    if (!currentEmail || !state) return;
    cacheUserStateLocally(currentEmail, state);
  }

  function hasMeaningfulData(data) {
    if (!data) return false;
    if (Array.isArray(data.transactions) && data.transactions.length > 0) return true;
    const wallets = Array.isArray(data.wallets) ? data.wallets : [];
    if (wallets.length > 3) return true;
    if (wallets.some((w) => (Number(w.balance) || 0) !== 0)) return true;
    const budgets = data.budgets || {};
    if (Object.values(budgets).some((v) => (Number(v) || 0) > 0)) return true;
    return false;
  }

  async function pushUserDataToCloud(user, data) {
    if (!sb || !user || !data) return;
    const email = normalizeEmail(user.email || currentEmail);
    const userId = user.id;

    if (data.pinSalt && data.pinHash) {
      await sb.auth.updateUser({
        data: {
          pin_salt: data.pinSalt,
          pin_hash: data.pinHash
        }
      }).catch(() => {});
    }

    const profilePayload = {
      id: userId,
      email,
      user_name: data.userName || 'Pengguna',
      hide_balance: Boolean(data.hideBalance)
    };
    if (data.pinSalt || data.pinHash) {
      profilePayload.pin_salt = data.pinSalt || '';
      profilePayload.pin_hash = data.pinHash || '';
    }
    let { error: profErr } = await sb.from('profiles').upsert(profilePayload, { onConflict: 'id' });
    if (profErr && isMissingColumnError(profErr)) {
      delete profilePayload.pin_salt;
      delete profilePayload.pin_hash;
      ({ error: profErr } = await sb.from('profiles').upsert(profilePayload, { onConflict: 'id' }));
    }
    if (profErr) throw profErr;

    const walletsInput = Array.isArray(data.wallets) && data.wallets.length > 0
      ? data.wallets
      : createEmptyUserData(data.userName).wallets;

    const walletRows = walletsInput.map((w, idx) => ({
      user_id: userId,
      client_id: String(w.id),
      name: String(w.name || 'Dompet'),
      subtitle: String(w.subtitle || 'Dompet Aktif'),
      icon: String(w.icon || 'account_balance_wallet'),
      badge: String(w.badge || 'Aktif'),
      balance: Math.round(Number(w.balance) || 0),
      sort_order: idx
    }));

    const { error: walErr } = await sb.from('wallets').upsert(walletRows, {
      onConflict: 'user_id,client_id'
    });
    if (walErr) throw walErr;

    const { data: savedWallets, error: fetchWalErr } = await sb
      .from('wallets')
      .select('id, client_id')
      .eq('user_id', userId);
    if (fetchWalErr) throw fetchWalErr;

    const walletUuidByClient = {};
    (savedWallets || []).forEach((w) => {
      walletUuidByClient[w.client_id] = w.id;
    });

    const budgetObj = { ...createEmptyBudgets(), ...(data.budgets || {}) };
    const budgetRows = Object.entries(budgetObj).map(([categoryId, limit]) => ({
      user_id: userId,
      category_id: categoryId,
      monthly_limit: Math.max(0, Math.round(Number(limit) || 0))
    }));

    const { error: bgtErr } = await sb.from('budgets').upsert(budgetRows, {
      onConflict: 'user_id,category_id'
    });
    if (bgtErr) throw bgtErr;

    const txs = Array.isArray(data.transactions) ? data.transactions : [];
    for (let i = 0; i < txs.length; i += 200) {
      const chunk = txs.slice(i, i + 200).map((tx) => ({
        user_id: userId,
        wallet_id: walletUuidByClient[tx.walletId] || null,
        client_id: String(tx.id),
        wallet_client_id: String(tx.walletId || 'tunai'),
        type: tx.type === 'income' ? 'income' : 'expense',
        amount: Math.max(1, Math.round(Number(tx.amount) || 0)),
        category_id: String(tx.categoryId || 'lainnya'),
        note: String(tx.note || ''),
        tag: String(tx.tag || ''),
        tx_date: tx.date || toISODate(new Date()),
        tx_time: tx.time || '00:00',
        receipt_name: String(tx.receiptName || '')
      }));
      const { error: txErr } = await sb.from('transactions').upsert(chunk, {
        onConflict: 'user_id,client_id'
      });
      if (txErr) throw txErr;
    }
  }

  async function fetchCloudState(user) {
    if (!sb || !user) return null;
    const userId = user.id;

    let [profRes, walRes, bgtRes, txRes, freshUserRes] = await Promise.all([
      sb.from('profiles').select('id, email, user_name, hide_balance, pin_salt, pin_hash, created_at').eq('id', userId).maybeSingle(),
      sb.from('wallets').select('id, client_id, name, subtitle, icon, badge, balance, sort_order').eq('user_id', userId).order('sort_order', { ascending: true }).order('created_at', { ascending: true }),
      sb.from('budgets').select('category_id, monthly_limit').eq('user_id', userId),
      sb.from('transactions').select('client_id, wallet_client_id, type, amount, category_id, note, tag, tx_date, tx_time, receipt_name').eq('user_id', userId).order('tx_date', { ascending: false }).order('tx_time', { ascending: false }).order('created_at', { ascending: false }),
      sb.auth.getUser().catch(() => ({ data: { user } }))
    ]);

    if (profRes.error && isMissingColumnError(profRes.error)) {
      profRes = await sb.from('profiles').select('id, email, user_name, hide_balance, created_at').eq('id', userId).maybeSingle();
    }

    if (profRes.error) throw profRes.error;
    if (walRes.error) throw walRes.error;
    if (bgtRes.error) throw bgtRes.error;
    if (txRes.error) throw txRes.error;

    const freshUser = freshUserRes?.data?.user || user;
    const userMeta = freshUser?.user_metadata || {};
    const cachedPin = vault.accounts[normalizeEmail(user.email)]?.data;

    const cloudPinSalt = profRes.data?.pin_salt || userMeta.pin_salt || '';
    const cloudPinHash = profRes.data?.pin_hash || userMeta.pin_hash || '';
    const hasCloudPin = Boolean(cloudPinSalt && cloudPinHash);

    const resolvedPinSalt = cloudPinSalt || cachedPin?.pinSalt || '';
    const resolvedPinHash = cloudPinHash || cachedPin?.pinHash || '';

    if (!profRes.data) {
      const fallbackName = userMeta.user_name || (user.email ? user.email.split('@')[0] : 'Pengguna');
      const seeded = createEmptyUserData(fallbackName, {
        pinSalt: resolvedPinSalt,
        pinHash: resolvedPinHash
      });
      await pushUserDataToCloud(user, seeded);
      return {
        createdAt: user.created_at || new Date().toISOString(),
        hasCloudPin,
        cloudPinSalt,
        cloudPinHash,
        data: seeded
      };
    }

    const wallets = (walRes.data || []).map((w) => ({
      id: w.client_id,
      name: w.name,
      subtitle: w.subtitle,
      icon: w.icon,
      badge: w.badge,
      balance: Number(w.balance) || 0
    }));

    const budgets = createEmptyBudgets();
    (bgtRes.data || []).forEach((b) => {
      budgets[b.category_id] = Number(b.monthly_limit) || 0;
    });

    const transactions = (txRes.data || []).map((t) => ({
      id: t.client_id,
      type: t.type,
      amount: Number(t.amount) || 0,
      categoryId: t.category_id,
      walletId: t.wallet_client_id,
      note: t.note,
      tag: t.tag,
      date: t.tx_date,
      time: t.tx_time,
      receiptName: t.receipt_name
    }));

    return {
      createdAt: profRes.data.created_at || user.created_at || new Date().toISOString(),
      hasCloudPin,
      cloudPinSalt,
      cloudPinHash,
      data: {
        userName: profRes.data.user_name || 'Pengguna',
        hideBalance: Boolean(profRes.data.hide_balance),
        pinSalt: resolvedPinSalt,
        pinHash: resolvedPinHash,
        wallets: wallets.length > 0 ? wallets : createEmptyUserData(profRes.data.user_name).wallets,
        budgets,
        transactions
      }
    };
  }

  async function executeCloudOp(user, op) {
    if (!sb || !user) return;
    const userId = user.id;

    if (op.type === 'record_tx') {
      const tx = op.payload;
      const { error } = await sb.rpc('record_transaction', {
        p_client_id: tx.id,
        p_wallet_client_id: tx.walletId,
        p_type: tx.type,
        p_amount: Math.round(Number(tx.amount) || 0),
        p_category_id: tx.categoryId,
        p_note: tx.note || '',
        p_tag: tx.tag || '',
        p_tx_date: tx.date,
        p_tx_time: tx.time || '00:00',
        p_receipt_name: tx.receiptName || ''
      });
      if (error) throw error;
      return;
    }

    if (op.type === 'delete_tx') {
      const { error } = await sb.rpc('delete_transaction', {
        p_client_id: op.payload.id
      });
      if (error) throw error;
      return;
    }

    if (op.type === 'upsert_wallet') {
      const w = op.payload;
      const { error } = await sb.from('wallets').upsert({
        user_id: userId,
        client_id: w.id,
        name: w.name,
        subtitle: w.subtitle || 'Dompet Aktif',
        icon: w.icon || 'account_balance_wallet',
        badge: w.badge || 'Aktif',
        balance: Math.round(Number(w.balance) || 0),
        sort_order: Number(w.sortOrder) || 0
      }, { onConflict: 'user_id,client_id' });
      if (error) throw error;
      return;
    }

    if (op.type === 'upsert_budgets') {
      const rows = Object.entries(op.payload || {}).map(([categoryId, limit]) => ({
        user_id: userId,
        category_id: categoryId,
        monthly_limit: Math.max(0, Math.round(Number(limit) || 0))
      }));
      const { error } = await sb.from('budgets').upsert(rows, {
        onConflict: 'user_id,category_id'
      });
      if (error) throw error;
      return;
    }

    if (op.type === 'update_profile') {
      const { error } = await sb.from('profiles').update({
        user_name: op.payload.userName,
        hide_balance: Boolean(op.payload.hideBalance)
      }).eq('id', userId);
      if (error) throw error;
      return;
    }

    if (op.type === 'update_pin') {
      const pinSalt = op.payload.pinSalt || '';
      const pinHash = op.payload.pinHash || '';
      if (pinSalt && pinHash) {
        try {
          const { data: upRes } = await sb.auth.updateUser({
            data: { pin_salt: pinSalt, pin_hash: pinHash }
          });
          if (upRes?.user) cloudUser = upRes.user;
        } catch (e) {
          console.warn('executeCloudOp updateUser pin error:', e);
        }
      }
      const { error } = await sb.from('profiles').update({
        pin_salt: pinSalt,
        pin_hash: pinHash
      }).eq('id', userId);
      if (error && !isMissingColumnError(error)) throw error;
      return;
    }

    if (op.type === 'reset_data') {
      const { error } = await sb.rpc('reset_user_data');
      if (error) throw error;
    }
  }

  async function flushSyncQueue(user = cloudUser) {
    if (!sb || !user) return true;
    const email = normalizeEmail(user.email || currentEmail);
    const ops = getQueuedOps(email);
    if (ops.length === 0) return true;

    const remaining = [];
    for (let i = 0; i < ops.length; i++) {
      try {
        await executeCloudOp(user, ops[i]);
      } catch (err) {
        if (isNetworkError(err)) {
          remaining.push(...ops.slice(i));
          setQueuedOps(email, remaining);
          syncStatus = 'offline';
          return false;
        }
        if (isMissingSchemaError(err)) {
          remaining.push(...ops.slice(i));
          setQueuedOps(email, remaining);
          syncStatus = 'schema-missing';
          return false;
        }
        // Drop invalid/duplicate operation so queue doesn't jam
      }
    }
    setQueuedOps(email, []);
    return true;
  }

  function syncCloudAction(op) {
    if (!currentEmail) return;
    if (!sb || !cloudUser) {
      if (syncStatus === 'local-only') {
        enqueueSyncOp(currentEmail, op);
      }
      return;
    }
    syncStatus = 'syncing';
    executeCloudOp(cloudUser, op)
      .then(async () => {
        await flushSyncQueue(cloudUser);
        syncStatus = 'synced';
        lastSyncedAt = new Date();
      })
      .catch((err) => {
        if (isMissingSchemaError(err)) {
          enqueueSyncOp(currentEmail, op);
          syncStatus = 'schema-missing';
          showToast('Database Supabase belum dijalankan. Jalankan schema.sql terlebih dahulu.', 'error');
        } else {
          enqueueSyncOp(currentEmail, op);
          syncStatus = 'offline';
        }
      });
  }

  function unsubscribeRealtime() {
    if (realtimeRefreshTimer) {
      clearTimeout(realtimeRefreshTimer);
      realtimeRefreshTimer = null;
    }
    if (realtimeChannel && sb) {
      sb.removeChannel(realtimeChannel).catch(() => {});
      realtimeChannel = null;
    }
  }

  function subscribeRealtime(userId) {
    if (!sb || !userId) return;
    unsubscribeRealtime();
    const scheduleRefresh = () => {
      if (realtimeRefreshTimer) clearTimeout(realtimeRefreshTimer);
      realtimeRefreshTimer = setTimeout(() => {
        refreshFromCloud({ silent: true });
      }, 450);
    };

    realtimeChannel = sb
      .channel(`finora-sync-${userId}`)
      .on('broadcast', { event: 'pin_updated' }, (msg) => {
        if (msg?.payload?.pinSalt && msg?.payload?.pinHash) {
          if (state) {
            state.pinSalt = msg.payload.pinSalt;
            state.pinHash = msg.payload.pinHash;
            saveState();
          }
        }
        scheduleRefresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wallets', filter: `user_id=eq.${userId}` }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'budgets', filter: `user_id=eq.${userId}` }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `user_id=eq.${userId}` }, scheduleRefresh)
      .subscribe();
  }

  async function hydrateSession(user, options = {}) {
    if (!user) return;
    const email = normalizeEmail(user.email);
    const prevLocalData = vault.accounts[email]?.data || null;
    const hadPendingMigration = Boolean(getPendingMigrationEmails()[email]);

    cloudUser = user;
    setActiveSession(email, options.remember ?? true);
    syncStatus = 'syncing';

    try {
      await flushSyncQueue(user);
      let fetched = await fetchCloudState(user);

      // Auto-migrate existing MacBook local data into Cloud if Cloud is still empty
      if (
        prevLocalData &&
        hasMeaningfulData(prevLocalData) &&
        !hasMeaningfulData(fetched.data)
      ) {
        await pushUserDataToCloud(user, prevLocalData);
        fetched = await fetchCloudState(user);
        setPendingMigration(email, false);
        showToast('Data lokal MacBook Anda berhasil disinkronkan ke Cloud!');
      } else if (hadPendingMigration) {
        setPendingMigration(email, false);
      }

      // Auto-migrate local PIN into Cloud if this device has local PIN but Cloud doesn't have it yet
      const localPinSalt = prevLocalData?.pinSalt || state?.pinSalt || '';
      const localPinHash = prevLocalData?.pinHash || state?.pinHash || '';
      if (localPinSalt && localPinHash && !fetched.hasCloudPin) {
        fetched.data.pinSalt = localPinSalt;
        fetched.data.pinHash = localPinHash;
        try {
          const { data: upRes } = await sb.auth.updateUser({
            data: {
              pin_salt: localPinSalt,
              pin_hash: localPinHash
            }
          });
          if (upRes?.user) cloudUser = upRes.user;
        } catch (e) {
          console.warn('Auto-upload local PIN to cloud failed:', e);
        }
        sb.from('profiles').update({
          pin_salt: localPinSalt,
          pin_hash: localPinHash
        }).eq('id', user.id).then(() => {}).catch(() => {});
      } else if (fetched.hasCloudPin) {
        fetched.data.pinSalt = fetched.cloudPinSalt;
        fetched.data.pinHash = fetched.cloudPinHash;
      }

      state = fetched.data;
      cacheUserStateLocally(email, state, {
        createdAt: fetched.createdAt,
        cloudLinked: true
      });
      syncStatus = 'synced';
      lastSyncError = '';
      lastSyncedAt = new Date();
      subscribeRealtime(user.id);
    } catch (err) {
      lastSyncError = String(err?.message || err?.code || '');
      if (isMissingSchemaError(err)) {
        syncStatus = 'schema-missing';
        state = prevLocalData || createEmptyUserData(user.user_metadata?.user_name || email.split('@')[0]);
        cacheUserStateLocally(email, state, { cloudLinked: false });
        if (!options.silent) {
          showToast('Tabel Supabase belum dibuat. Jalankan supabase/schema.sql di SQL Editor.', 'error');
        }
      } else {
        syncStatus = 'offline';
        state = prevLocalData || createEmptyUserData(user.user_metadata?.user_name || email.split('@')[0]);
        cacheUserStateLocally(email, state, { cloudLinked: true });
        if (!options.silent) {
          showToast(`Gagal sinkron Cloud: ${lastSyncError || 'mode offline'}`, 'error');
        }
      }
    }

    if (!state.wallets.some((w) => w.id === catatDraft.walletId) && state.wallets[0]) {
      catatDraft.walletId = state.wallets[0].id;
    }
  }

  async function refreshFromCloud({ silent = false } = {}) {
    if (!sb || !cloudUser) return;
    try {
      syncStatus = 'syncing';
      const flushed = await flushSyncQueue(cloudUser);
      if (!flushed) return;
      const fetched = await fetchCloudState(cloudUser);
      if (!fetched) return;
      if (state?.pinSalt && state?.pinHash && !fetched.hasCloudPin) {
        fetched.data.pinSalt = state.pinSalt;
        fetched.data.pinHash = state.pinHash;
        try {
          const { data: upRes } = await sb.auth.updateUser({
            data: {
              pin_salt: state.pinSalt,
              pin_hash: state.pinHash
            }
          });
          if (upRes?.user) cloudUser = upRes.user;
        } catch (e) {
          console.warn('Sync PIN to cloud failed:', e);
        }
        sb.from('profiles').update({
          pin_salt: state.pinSalt,
          pin_hash: state.pinHash
        }).eq('id', cloudUser.id).then(() => {}).catch(() => {});
      } else if (fetched.hasCloudPin) {
        fetched.data.pinSalt = fetched.cloudPinSalt;
        fetched.data.pinHash = fetched.cloudPinHash;
      }
      state = fetched.data;
      cacheUserStateLocally(currentEmail, state, {
        createdAt: fetched.createdAt,
        cloudLinked: true
      });
      syncStatus = 'synced';
      lastSyncError = '';
      lastSyncedAt = new Date();
      render();
      if (!silent) showToast('Data tersinkron dengan Cloud!');
    } catch (err) {
      lastSyncError = String(err?.message || err?.code || '');
      if (isMissingSchemaError(err)) syncStatus = 'schema-missing';
      else syncStatus = 'offline';
      if (!silent) showToast(`Gagal menyinkronkan: ${lastSyncError || 'periksa koneksi Anda'}`, 'error');
    }
  }

  function getInitialTab() {
    const h = window.location.hash.replace('#', '');
    return ['beranda', 'mutasi', 'catat', 'budget', 'laporan'].includes(h) ? h : 'beranda';
  }

  function esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatRp(n) {
    const abs = Math.abs(Math.round(Number(n) || 0));
    return abs.toLocaleString('id-ID');
  }

  function formatShortRp(n) {
    const abs = Math.abs(Number(n) || 0);
    if (abs >= 1000000) return `${(abs / 1000000).toFixed(1).replace(/\.0$/, '')}jt`;
    if (abs >= 1000) return `${Math.round(abs / 1000)}rb`;
    return String(abs);
  }

  function getCategory(id) {
    return (
      EXPENSE_CATEGORIES.find((c) => c.id === id) ||
      INCOME_CATEGORIES.find((c) => c.id === id) ||
      { id, name: 'Lain-lain', icon: 'receipt' }
    );
  }

  function getWallet(id) {
    return state.wallets.find((w) => w.id === id) || { id, name: 'Dompet', icon: 'wallet', balance: 0 };
  }

  function formatIndoDate(isoDate) {
    if (!isoDate) return '';
    const today = toISODate(new Date());
    const yesterday = daysAgoISO(1);
    const [y, m, d] = isoDate.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const label = dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    if (isoDate === today) return `Hari Ini, ${label}`;
    if (isoDate === yesterday) return `Kemarin, ${label}`;
    return dt.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }

  function formatTodayBanner() {
    return new Date().toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  function getTotalBalance() {
    return state.wallets.reduce((sum, w) => sum + (Number(w.balance) || 0), 0);
  }

  function getMonthTransactions() {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return state.transactions.filter((tx) => (tx.date || '').startsWith(ym));
  }

  function sortedTransactions(list = state.transactions) {
    return [...list].sort((a, b) => {
      const ka = `${a.date || ''}T${a.time || '00:00'}`;
      const kb = `${b.date || ''}T${b.time || '00:00'}`;
      return kb.localeCompare(ka);
    });
  }

  function showToast(message, tone = 'primary') {
    const bg = tone === 'error'
      ? 'bg-error text-on-error'
      : 'bg-inverse-surface text-inverse-on-surface';
    const icon = tone === 'error' ? 'error' : 'check_circle';
    const el = document.createElement('div');
    el.className = `pointer-events-auto flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg ${bg} text-label-md font-semibold transition-all duration-200`;
    el.innerHTML = `<span class="material-symbols-outlined text-[18px]">${icon}</span><span class="flex-1">${esc(message)}</span>`;
    toastRoot.appendChild(el);
    setTimeout(() => {
      el.classList.add('opacity-0', '-translate-y-2');
      setTimeout(() => el.remove(), 220);
    }, 2800);
  }

  function closeModal() {
    modalRoot.classList.add('hidden');
    modalRoot.innerHTML = '';
  }

  function openModal(innerHTML) {
    modalRoot.innerHTML = `
      <div class="w-full max-w-md bg-surface rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl max-h-[85vh] overflow-y-auto">
        ${innerHTML}
      </div>
    `;
    modalRoot.classList.remove('hidden');
    modalRoot.onclick = (e) => {
      if (e.target === modalRoot) closeModal();
    };
  }

  function isIosBrowser() {
    const ua = navigator.userAgent || '';
    const isIos = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    return isIos && !isStandaloneMode();
  }

  function updateInstallButtonVisibility() {
    if (!headerInstallBtn) return;
    if (isAppInstalled()) {
      headerInstallBtn.classList.add('hidden');
      headerInstallBtn.classList.remove('flex');
      return;
    }
    headerInstallBtn.classList.remove('hidden');
    headerInstallBtn.classList.add('flex');
  }

  async function triggerInstall() {
    if (isAppInstalled()) {
      updateInstallButtonVisibility();
      return;
    }

    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        localStorage.setItem(INSTALLED_KEY, '1');
        deferredInstallPrompt = null;
        updateInstallButtonVisibility();
        showToast('Finora berhasil dipasang di perangkat!');
        render();
      }
      return;
    }

    const ios = isIosBrowser();
    openModal(`
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2.5">
          <img src="./icons/icon-192.png" alt="Finora" class="w-10 h-10 rounded-xl shadow-xs">
          <div>
            <h3 class="font-headline-sm text-headline-sm text-on-surface">Pasang Finora di HP</h3>
            <p class="font-body-sm text-body-sm text-on-surface-variant">Gunakan seperti aplikasi native tanpa App Store</p>
          </div>
        </div>
        <button id="modal-close-btn" type="button" class="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant">
          <span class="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>
      <div class="space-y-3 text-body-sm text-on-surface-variant">
        ${ios ? `
          <div class="p-3 rounded-xl bg-primary-fixed/30 text-on-primary-fixed space-y-1.5">
            <p class="font-semibold text-on-surface">Cara Pasang di iPhone / iPad (Safari):</p>
            <ol class="list-decimal pl-4 space-y-1">
              <li>Ketuk tombol <strong>Bagikan (Share)</strong> di Safari.</li>
              <li>Pilih <strong>Tambah ke Layar Utama (Add to Home Screen)</strong>.</li>
              <li>Ketuk <strong>Tambah (Add)</strong> di pojok kanan atas.</li>
            </ol>
          </div>
        ` : `
          <div class="p-3 rounded-xl bg-surface-container-low space-y-1.5">
            <p class="font-semibold text-on-surface">Cara Pasang di Android (Chrome):</p>
            <ol class="list-decimal pl-4 space-y-1">
              <li>Buka link Finora HTTPS di Google Chrome.</li>
              <li>Ketuk menu titik tiga <strong>⋮</strong> di pojok kanan atas.</li>
              <li>Pilih <strong>Tambahkan ke layar utama / Install App</strong>.</li>
            </ol>
          </div>
          <div class="p-3 rounded-xl bg-primary-fixed/25 space-y-1.5">
            <p class="font-semibold text-on-surface">Cara Pasang di iPhone (Safari):</p>
            <ol class="list-decimal pl-4 space-y-1">
              <li>Buka link Finora di Safari.</li>
              <li>Ketuk ikon <strong>Bagikan (Share)</strong> → <strong>Tambah ke Layar Utama</strong>.</li>
            </ol>
          </div>
        `}
      </div>
      <div class="mt-4 flex flex-col gap-2">
        <button id="modal-ok-btn" type="button" class="w-full py-2.5 rounded-xl bg-primary text-on-primary font-label-md font-semibold">Mengerti</button>
        ${ios ? `
          <button id="modal-mark-installed" type="button" class="w-full py-2 rounded-xl bg-surface-container text-on-surface-variant font-label-sm font-semibold">Saya Sudah Pasang di Layar Utama</button>
        ` : ''}
      </div>
    `);
    document.getElementById('modal-close-btn').onclick = closeModal;
    document.getElementById('modal-ok-btn').onclick = closeModal;
    const markBtn = document.getElementById('modal-mark-installed');
    if (markBtn) {
      markBtn.onclick = () => {
        localStorage.setItem(INSTALLED_KEY, '1');
        updateInstallButtonVisibility();
        closeModal();
        render();
      };
    }
  }

  // ==================== AUTH SCREEN ====================
  async function linkLocalAccountToCloud(email, password) {
    if (!sb) {
      showToast('Layanan Cloud belum tersedia. Periksa koneksi internet Anda.', 'error');
      return { ok: false };
    }
    const clean = normalizeEmail(email);
    const localAcc = vault.accounts[clean];

    // 1. Try normal cloud login first (e.g. account already registered on another device)
    const signInRes = await sb.auth.signInWithPassword({ email: clean, password });
    if (!signInRes.error && signInRes.data?.session?.user) {
      await hydrateSession(signInRes.data.session.user, { remember: true });
      return { ok: true, mode: 'signed_in' };
    }

    if (signInRes.error && /Email not confirmed/i.test(signInRes.error.message || '')) {
      pendingVerificationEmail = clean;
      if (localAcc && hasMeaningfulData(localAcc.data)) {
        setPendingMigration(clean, true);
      }
      showToast(mapAuthErrorMessage(signInRes.error), 'error');
      return { ok: false, needsVerification: true };
    }

    // 2. If not yet in Cloud, check if it exists in MacBook local vault
    if (localAcc && localAcc.passwordHash) {
      const attemptHash = await hashPassword(password, localAcc.salt);
      if (attemptHash !== localAcc.passwordHash) {
        showToast('Password salah. Silakan periksa kembali.', 'error');
        return { ok: false };
      }
      const displayName = localAcc.name || localAcc.data?.userName || clean.split('@')[0];
      const signUpRes = await sb.auth.signUp({
        email: clean,
        password,
        options: {
          data: { user_name: displayName },
          emailRedirectTo: getAuthRedirectUrl()
        }
      });
      if (signUpRes.error) {
        showToast(mapAuthErrorMessage(signUpRes.error), 'error');
        return { ok: false };
      }
      if (signUpRes.data?.session?.user) {
        await hydrateSession(signUpRes.data.session.user, { remember: true });
        return { ok: true, mode: 'migrated' };
      }
      setPendingMigration(clean, true);
      pendingVerificationEmail = clean;
      return { ok: false, needsVerification: true };
    }

    if (signInRes.error) {
      if (/Email not confirmed/i.test(signInRes.error.message || '')) {
        pendingVerificationEmail = clean;
      }
      showToast(mapAuthErrorMessage(signInRes.error), 'error');
    }
    return { ok: false };
  }

  function openLinkCloudModal() {
    if (!currentEmail) return;
    openModal(`
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <div class="w-9 h-9 rounded-xl bg-primary-fixed text-on-primary-fixed flex items-center justify-center">
            <span class="material-symbols-outlined text-[20px]">cloud_sync</span>
          </div>
          <div>
            <h3 class="font-headline-sm text-headline-sm text-on-surface">Hubungkan ke Cloud</h3>
            <p class="font-body-sm text-body-sm text-on-surface-variant">Sinkronkan data MacBook ke HP</p>
          </div>
        </div>
        <button id="modal-close-btn" type="button" class="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant">
          <span class="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>
      <p class="font-body-sm text-body-sm text-on-surface-variant mb-3">
        Masukkan password akun <strong>${esc(currentEmail)}</strong> sekali lagi untuk mengaktifkan sinkronisasi lintas perangkat.
      </p>
      <form id="link-cloud-form" class="space-y-3">
        <input id="link-cloud-pw" type="password" autocomplete="current-password" placeholder="Masukkan password Anda" class="w-full px-3 py-2.5 rounded-xl bg-surface-container-low text-on-surface font-body-md focus:outline-none focus:ring-2 focus:ring-primary/30" required>
        <button id="link-cloud-submit" type="submit" class="w-full py-2.5 rounded-xl bg-primary text-on-primary font-label-md font-bold flex items-center justify-center gap-1.5">
          <span class="material-symbols-outlined text-[18px]">cloud_upload</span>
          <span>Aktifkan Sync Cloud</span>
        </button>
      </form>
    `);
    document.getElementById('modal-close-btn').onclick = closeModal;
    document.getElementById('link-cloud-form').onsubmit = async (e) => {
      e.preventDefault();
      const pw = document.getElementById('link-cloud-pw').value;
      const btn = document.getElementById('link-cloud-submit');
      btn.disabled = true;
      btn.innerHTML = '<span>Menghubungkan...</span>';
      const res = await linkLocalAccountToCloud(currentEmail, pw);
      closeModal();
      if (res.ok) {
        showToast('Akun terhubung ke Cloud! Buka email yang sama di HP Anda.');
      } else if (res.needsVerification) {
        showToast('Cek inbox email Anda untuk link konfirmasi, lalu masuk kembali.');
      }
      render();
    };
  }

  function openForgotPasswordModal(prefillEmail = '') {
    openModal(`
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-headline-sm text-headline-sm text-on-surface">Reset Password</h3>
        <button id="modal-close-btn" type="button" class="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant">
          <span class="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>
      <p class="font-body-sm text-body-sm text-on-surface-variant mb-3">
        Masukkan email terdaftar Anda. Kami akan mengirimkan tautan untuk membuat password baru.
      </p>
      <form id="forgot-pw-form" class="space-y-3">
        <input id="forgot-pw-email" type="email" value="${esc(prefillEmail)}" placeholder="nama@email.com" class="w-full px-3 py-2.5 rounded-xl bg-surface-container-low text-on-surface font-body-md focus:outline-none focus:ring-2 focus:ring-primary/30" required>
        <button id="forgot-pw-submit" type="submit" class="w-full py-2.5 rounded-xl bg-primary text-on-primary font-label-md font-bold">
          Kirim Link Reset Password
        </button>
      </form>
    `);
    document.getElementById('modal-close-btn').onclick = closeModal;
    document.getElementById('forgot-pw-form').onsubmit = async (e) => {
      e.preventDefault();
      if (!sb) {
        showToast('Layanan Cloud belum tersedia', 'error');
        return;
      }
      const email = normalizeEmail(document.getElementById('forgot-pw-email').value);
      if (!isValidEmail(email)) {
        showToast('Masukkan alamat email yang valid', 'error');
        return;
      }
      const btn = document.getElementById('forgot-pw-submit');
      btn.disabled = true;
      btn.textContent = 'Mengirim...';
      const { error } = await sb.auth.resetPasswordForEmail(email, {
        redirectTo: getAuthRedirectUrl()
      });
      closeModal();
      if (error) {
        showToast(mapAuthErrorMessage(error), 'error');
        return;
      }
      showToast(`Link reset password dikirim ke ${email}`);
    };
  }

  function openNewPasswordModal() {
    openModal(`
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-headline-sm text-headline-sm text-on-surface">Buat Password Baru</h3>
        <button id="modal-close-btn" type="button" class="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant">
          <span class="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>
      <form id="recovery-pw-form" class="space-y-3">
        <input id="recovery-pw-new" type="password" placeholder="Password baru (min. 6 karakter)" class="w-full px-3 py-2.5 rounded-xl bg-surface-container-low text-on-surface font-body-md focus:outline-none focus:ring-2 focus:ring-primary/30" required>
        <button type="submit" class="w-full py-2.5 rounded-xl bg-primary text-on-primary font-label-md font-bold">Simpan Password Baru</button>
      </form>
    `);
    document.getElementById('modal-close-btn').onclick = closeModal;
    document.getElementById('recovery-pw-form').onsubmit = async (e) => {
      e.preventDefault();
      if (!sb) return;
      const pw = document.getElementById('recovery-pw-new').value;
      if (pw.length < 6) {
        showToast('Password minimal 6 karakter', 'error');
        return;
      }
      const { error } = await sb.auth.updateUser({ password: pw });
      if (error) {
        showToast(mapAuthErrorMessage(error), 'error');
        return;
      }
      closeModal();
      showToast('Password baru berhasil disimpan!');
    };
  }

  function renderAuthScreen() {
    appShellEl.classList.add('hidden');
    authScreenEl.classList.remove('hidden');

    if (isBootstrapping) {
      authScreenEl.innerHTML = `
        <div class="flex flex-col flex-1 items-center justify-center py-12 text-center space-y-4">
          <img src="./icons/icon-192.png" alt="Finora Logo" class="w-16 h-16 rounded-2xl shadow-md animate-pulse">
          <div>
            <h1 class="font-headline-md text-headline-md text-primary font-bold">Finora</h1>
            <p class="font-body-sm text-body-sm text-on-surface-variant mt-1">Menghubungkan akun & menyinkronkan data...</p>
          </div>
        </div>
      `;
      return;
    }

    const savedEmails = Object.keys(vault.accounts || {});
    const installed = isAppInstalled();

    authScreenEl.innerHTML = `
      <div class="flex flex-col flex-1 justify-center py-6 space-y-6">
        <!-- Brand Hero -->
        <div class="flex flex-col items-center text-center space-y-2">
          <img src="./icons/icon-192.png" alt="Finora Logo" class="w-16 h-16 rounded-2xl shadow-md">
          <div>
            <h1 class="font-headline-lg text-headline-lg text-primary font-bold tracking-tight">Finora</h1>
            <p class="font-body-sm text-body-sm text-on-surface-variant">Smart Personal Finance • Sinkron Otomatis Antar Perangkat</p>
          </div>
          ${!installed ? `
            <button id="auth-install-btn" type="button" class="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary-fixed text-on-primary-fixed font-label-sm text-label-sm font-bold shadow-xs hover:opacity-90">
              <span class="material-symbols-outlined text-[16px]">install_mobile</span>
              <span>Pasang Aplikasi di HP</span>
            </button>
          ` : ''}
        </div>

        ${pendingVerificationEmail ? `
          <div class="bg-primary-fixed/40 rounded-2xl p-4 space-y-2.5 shadow-sm">
            <div class="flex items-start gap-2.5">
              <span class="material-symbols-outlined text-primary text-[22px] shrink-0">mark_email_unread</span>
              <div class="text-body-sm text-on-primary-fixed min-w-0">
                <p class="font-bold">Konfirmasi Email Diperlukan</p>
                <p class="mt-0.5 text-on-primary-fixed-variant">
                  Kami telah mengirim link verifikasi ke <strong>${esc(pendingVerificationEmail)}</strong>. Klik link tersebut di kotak masuk email Anda, lalu login kembali di sini.
                </p>
              </div>
            </div>
            <div class="flex gap-2">
              <button id="resend-verif-btn" type="button" class="flex-1 py-2 px-3 rounded-xl bg-primary text-on-primary font-label-sm font-bold">
                Kirim Ulang Email
              </button>
              <button id="dismiss-verif-btn" type="button" class="py-2 px-3 rounded-xl bg-surface-container-lowest text-on-surface font-label-sm font-semibold">
                Tutup
              </button>
            </div>
          </div>
        ` : ''}

        <!-- Auth Card -->
        <div class="bg-surface-container-lowest rounded-2xl p-5 shadow-md space-y-4">
          <div class="p-1 bg-surface-container rounded-xl flex items-center">
            <button id="auth-tab-login" type="button" class="flex-1 py-2 px-3 rounded-lg ${authMode === 'login' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant'} font-label-md text-label-md font-bold transition-all">
              Masuk Akun
            </button>
            <button id="auth-tab-register" type="button" class="flex-1 py-2 px-3 rounded-lg ${authMode === 'register' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant'} font-label-md text-label-md font-bold transition-all">
              Buat Akun Baru
            </button>
          </div>

          ${authMode === 'login' ? `
            <form id="login-form" class="space-y-3.5" novalidate>
              <div>
                <label class="font-label-sm text-label-sm text-on-surface-variant" for="login-email">Email</label>
                <div class="relative mt-1 flex items-center">
                  <span class="material-symbols-outlined text-[19px] text-outline absolute left-3">mail</span>
                  <input id="login-email" type="email" autocomplete="email" placeholder="nama@email.com" value="${esc(pendingVerificationEmail || savedEmails[0] || '')}" class="w-full pl-10 pr-3 py-2.5 rounded-xl bg-surface-container-low text-on-surface font-body-md focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/30" required>
                </div>
              </div>

              <div>
                <div class="flex items-center justify-between">
                  <label class="font-label-sm text-label-sm text-on-surface-variant" for="login-password">Password</label>
                  <button id="forgot-pw-btn" type="button" class="font-label-sm text-label-sm text-primary font-semibold hover:underline">Lupa password?</button>
                </div>
                <div class="relative mt-1 flex items-center">
                  <span class="material-symbols-outlined text-[19px] text-outline absolute left-3">lock</span>
                  <input id="login-password" type="password" autocomplete="current-password" placeholder="Masukkan password" class="w-full pl-10 pr-10 py-2.5 rounded-xl bg-surface-container-low text-on-surface font-body-md focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/30" required>
                  <button data-toggle-pw="login-password" type="button" aria-label="Lihat password" class="absolute right-2.5 text-on-surface-variant p-1">
                    <span class="material-symbols-outlined text-[19px]">visibility</span>
                  </button>
                </div>
              </div>

              ${isStandaloneMode() ? `
                <label class="flex items-center gap-2 text-body-sm text-on-surface-variant cursor-pointer select-none">
                  <input id="login-remember" type="checkbox" checked class="w-4 h-4 accent-primary rounded">
                  <span>Tetap masuk di aplikasi terpasang</span>
                </label>
              ` : ''}

              <button id="login-submit-btn" type="submit" ${authBusy ? 'disabled' : ''} class="w-full py-3 rounded-xl bg-primary hover:bg-primary-container disabled:opacity-60 text-on-primary font-label-lg font-bold shadow-sm active:scale-[0.99] transition-all flex items-center justify-center gap-2">
                <span class="material-symbols-outlined text-[20px]">login</span>
                <span>${authBusy ? 'Memproses...' : 'Masuk ke Finora'}</span>
              </button>
            </form>

            ${savedEmails.length > 0 ? `
              <div class="pt-2 border-t border-surface-container">
                <p class="font-label-sm text-label-sm text-on-surface-variant mb-2">Akun tersimpan di perangkat ini:</p>
                <div class="flex flex-wrap gap-1.5">
                  ${savedEmails.map((em) => `
                    <button data-pick-email="${esc(em)}" type="button" class="px-2.5 py-1 rounded-full bg-surface-container text-on-surface font-label-sm text-label-sm hover:bg-primary-fixed transition-colors">
                      ${esc(em)}
                    </button>
                  `).join('')}
                </div>
              </div>
            ` : `
              <div class="p-3 rounded-xl bg-surface-container-low text-body-sm text-on-surface-variant flex items-start gap-2">
                <span class="material-symbols-outlined text-[18px] text-primary shrink-0 mt-0.5">devices</span>
                <span>Sudah daftar di MacBook atau HP lain? Cukup masuk dengan email & password yang sama — semua data Anda otomatis mengikuti.</span>
              </div>
            `}
          ` : `
            <form id="register-form" class="space-y-3" novalidate>
              <div>
                <label class="font-label-sm text-label-sm text-on-surface-variant" for="reg-name">Nama Panggilan</label>
                <div class="relative mt-1 flex items-center">
                  <span class="material-symbols-outlined text-[19px] text-outline absolute left-3">person</span>
                  <input id="reg-name" type="text" autocomplete="name" placeholder="Contoh: Fajar" class="w-full pl-10 pr-3 py-2.5 rounded-xl bg-surface-container-low text-on-surface font-body-md focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/30" required>
                </div>
              </div>

              <div>
                <label class="font-label-sm text-label-sm text-on-surface-variant" for="reg-email">Email</label>
                <div class="relative mt-1 flex items-center">
                  <span class="material-symbols-outlined text-[19px] text-outline absolute left-3">mail</span>
                  <input id="reg-email" type="email" autocomplete="email" placeholder="nama@email.com" class="w-full pl-10 pr-3 py-2.5 rounded-xl bg-surface-container-low text-on-surface font-body-md focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/30" required>
                </div>
              </div>

              <div>
                <label class="font-label-sm text-label-sm text-on-surface-variant" for="reg-password">Password (min. 6 karakter)</label>
                <div class="relative mt-1 flex items-center">
                  <span class="material-symbols-outlined text-[19px] text-outline absolute left-3">lock</span>
                  <input id="reg-password" type="password" autocomplete="new-password" placeholder="Buat password aman" class="w-full pl-10 pr-10 py-2.5 rounded-xl bg-surface-container-low text-on-surface font-body-md focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/30" required>
                  <button data-toggle-pw="reg-password" type="button" aria-label="Lihat password" class="absolute right-2.5 text-on-surface-variant p-1">
                    <span class="material-symbols-outlined text-[19px]">visibility</span>
                  </button>
                </div>
              </div>

              <div>
                <label class="font-label-sm text-label-sm text-on-surface-variant" for="reg-password2">Konfirmasi Password</label>
                <div class="relative mt-1 flex items-center">
                  <span class="material-symbols-outlined text-[19px] text-outline absolute left-3">verified_user</span>
                  <input id="reg-password2" type="password" autocomplete="new-password" placeholder="Ulangi password" class="w-full pl-10 pr-10 py-2.5 rounded-xl bg-surface-container-low text-on-surface font-body-md focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/30" required>
                  <button data-toggle-pw="reg-password2" type="button" aria-label="Lihat password" class="absolute right-2.5 text-on-surface-variant p-1">
                    <span class="material-symbols-outlined text-[19px]">visibility</span>
                  </button>
                </div>
              </div>

              <button id="reg-submit-btn" type="submit" ${authBusy ? 'disabled' : ''} class="w-full py-3 rounded-xl bg-primary hover:bg-primary-container disabled:opacity-60 text-on-primary font-label-lg font-bold shadow-sm active:scale-[0.99] transition-all flex items-center justify-center gap-2">
                <span class="material-symbols-outlined text-[20px]">person_add</span>
                <span>${authBusy ? 'Mendaftarkan...' : 'Daftar & Masuk'}</span>
              </button>
            </form>
          `}

          <div class="pt-1 flex items-center justify-between text-label-sm text-on-surface-variant">
            <span class="flex items-center gap-1">
              <span class="material-symbols-outlined text-[15px] text-primary">cloud_done</span>
              Akun & data tersinkron ke Cloud
            </span>
            <button id="auth-restore-json" type="button" class="text-primary font-bold hover:underline">Pulihkan Backup</button>
          </div>
        </div>
      </div>

      <p class="text-center font-label-sm text-label-sm text-outline pb-2">
        Finora PWA • Cloud Sync (Supabase)
      </p>
    `;

    const authInstallBtn = document.getElementById('auth-install-btn');
    if (authInstallBtn) authInstallBtn.onclick = triggerInstall;

    const resendBtn = document.getElementById('resend-verif-btn');
    if (resendBtn) {
      resendBtn.onclick = async () => {
        if (!sb || !pendingVerificationEmail) return;
        resendBtn.disabled = true;
        resendBtn.textContent = 'Mengirim...';
        const { error } = await sb.auth.resend({
          type: 'signup',
          email: pendingVerificationEmail,
          options: { emailRedirectTo: getAuthRedirectUrl() }
        });
        if (error) showToast(mapAuthErrorMessage(error), 'error');
        else showToast(`Email verifikasi dikirim ulang ke ${pendingVerificationEmail}`);
        resendBtn.disabled = false;
        resendBtn.textContent = 'Kirim Ulang Email';
      };
    }

    const dismissVerifBtn = document.getElementById('dismiss-verif-btn');
    if (dismissVerifBtn) {
      dismissVerifBtn.onclick = () => {
        pendingVerificationEmail = '';
        renderAuthScreen();
      };
    }

    document.getElementById('auth-tab-login').onclick = () => {
      authMode = 'login';
      renderAuthScreen();
    };
    document.getElementById('auth-tab-register').onclick = () => {
      authMode = 'register';
      renderAuthScreen();
    };

    const forgotBtn = document.getElementById('forgot-pw-btn');
    if (forgotBtn) {
      forgotBtn.onclick = () => {
        const cur = document.getElementById('login-email')?.value || '';
        openForgotPasswordModal(cur);
      };
    }

    document.querySelectorAll('[data-toggle-pw]').forEach((btn) => {
      btn.onclick = () => {
        const inp = document.getElementById(btn.dataset.togglePw);
        if (!inp) return;
        const isPw = inp.type === 'password';
        inp.type = isPw ? 'text' : 'password';
        btn.querySelector('span').textContent = isPw ? 'visibility_off' : 'visibility';
      };
    });

    document.querySelectorAll('[data-pick-email]').forEach((btn) => {
      btn.onclick = () => {
        const inp = document.getElementById('login-email');
        if (inp) inp.value = btn.dataset.pickEmail;
        const pw = document.getElementById('login-password');
        if (pw) pw.focus();
      };
    });

    document.getElementById('auth-restore-json').onclick = () => openRestoreBackupModal(true);

    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.onsubmit = async (e) => {
        e.preventDefault();
        if (authBusy) return;
        const email = normalizeEmail(document.getElementById('login-email').value);
        const password = document.getElementById('login-password').value;
        const remember = document.getElementById('login-remember')?.checked ?? true;

        if (!isValidEmail(email)) {
          showToast('Masukkan alamat email yang valid', 'error');
          return;
        }
        if (!password) {
          showToast('Masukkan password Anda', 'error');
          return;
        }

        if (!sb) {
          const account = vault.accounts[email];
          if (!account) {
            showToast('Koneksi Cloud tidak tersedia dan email belum ada di perangkat ini.', 'error');
            return;
          }
          const attemptHash = await hashPassword(password, account.salt);
          if (attemptHash !== account.passwordHash) {
            showToast('Password salah. Silakan periksa kembali.', 'error');
            return;
          }
          setActiveSession(email, remember);
          state = account.data;
          syncStatus = 'offline';
          catatDraft.walletId = state.wallets[0]?.id || 'tunai';
          showToast(`Masuk mode offline sebagai ${state.userName}`);
          render();
          return;
        }

        authBusy = true;
        renderAuthScreen();
        try {
          const res = await linkLocalAccountToCloud(email, password);
          if (res.ok) {
            pendingVerificationEmail = '';
            setActiveSession(email, remember);
            showToast(
              res.mode === 'migrated'
                ? `Akun ${email} & data lokal tersinkron ke Cloud!`
                : `Selamat datang kembali, ${state.userName}!`
            );
          } else if (!res.needsVerification && !navigator.onLine) {
            const localAcc = vault.accounts[email];
            if (localAcc && localAcc.passwordHash) {
              const attemptHash = await hashPassword(password, localAcc.salt);
              if (attemptHash === localAcc.passwordHash) {
                setActiveSession(email, remember);
                state = localAcc.data;
                syncStatus = 'offline';
                showToast(`Masuk mode offline sebagai ${state.userName}`);
              }
            }
          }
        } finally {
          authBusy = false;
          render();
        }
      };
    }

    const regForm = document.getElementById('register-form');
    if (regForm) {
      regForm.onsubmit = async (e) => {
        e.preventDefault();
        if (authBusy) return;
        const name = document.getElementById('reg-name').value.trim();
        const email = normalizeEmail(document.getElementById('reg-email').value);
        const pw1 = document.getElementById('reg-password').value;
        const pw2 = document.getElementById('reg-password2').value;

        if (!name) {
          showToast('Nama panggilan wajib diisi', 'error');
          return;
        }
        if (!isValidEmail(email)) {
          showToast('Masukkan format email yang benar', 'error');
          return;
        }
        if (pw1.length < 6) {
          showToast('Password minimal 6 karakter', 'error');
          return;
        }
        if (pw1 !== pw2) {
          showToast('Konfirmasi password tidak cocok', 'error');
          return;
        }
        if (!sb) {
          showToast('Layanan Cloud belum tersedia. Periksa koneksi internet Anda.', 'error');
          return;
        }

        authBusy = true;
        renderAuthScreen();
        try {
          const { data, error } = await sb.auth.signUp({
            email,
            password: pw1,
            options: {
              data: { user_name: name },
              emailRedirectTo: getAuthRedirectUrl()
            }
          });
          if (error) {
            showToast(mapAuthErrorMessage(error), 'error');
            return;
          }

          if (data?.session?.user) {
            pendingVerificationEmail = '';
            await hydrateSession(data.session.user, { remember: true });
            showToast(`Akun ${email} berhasil dibuat & tersinkron ke Cloud!`);
          } else {
            pendingVerificationEmail = email;
            authMode = 'login';
            showToast(`Pendaftaran berhasil! Cek email ${email} untuk verifikasi.`);
          }
        } finally {
          authBusy = false;
          render();
        }
      };
    }
  }

  // ==================== BACKUP & RESTORE ====================
  function exportAccountBackup() {
    if (!currentEmail || !state) return;
    const account = vault.accounts[currentEmail] || {};
    const payload = {
      app: 'finora-pwa',
      version: 2,
      exportedAt: new Date().toISOString(),
      account: {
        email: currentEmail,
        name: state.userName || account.name || 'Pengguna',
        salt: account.salt || '',
        passwordHash: account.passwordHash || '',
        createdAt: account.createdAt || new Date().toISOString(),
        data: state
      }
    };
    const safeName = currentEmail.replace(/[^a-z0-9]/gi, '_');
    const filename = `Finora_Backup_${safeName}_${toISODate(new Date())}.json`;
    triggerFileDownload(filename, JSON.stringify(payload, null, 2), 'application/json');
    showToast('Backup akun (.json) berhasil diunduh!');
  }

  function openRestoreBackupModal(fromAuth = false) {
    openModal(`
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-headline-sm text-headline-sm text-on-surface">Pulihkan Backup Akun</h3>
        <button id="modal-close-btn" type="button" class="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant">
          <span class="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>
      <p class="font-body-sm text-body-sm text-on-surface-variant mb-3">
        Pilih file backup <code>.json</code> yang pernah diekspor dari Finora untuk memulihkan transaksi, dompet, dan budget Anda.
      </p>
      <label class="w-full p-5 rounded-xl bg-surface-container-low flex flex-col items-center justify-center text-center cursor-pointer hover:bg-surface-container transition-colors">
        <input id="restore-file-input" type="file" accept=".json,application/json" class="hidden">
        <span class="material-symbols-outlined text-[30px] text-primary mb-1">upload_file</span>
        <span class="font-label-md text-label-md text-on-surface font-semibold">Pilih File Backup (.json)</span>
      </label>
    `);
    document.getElementById('modal-close-btn').onclick = closeModal;
    document.getElementById('restore-file-input').onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const acc = parsed?.account;
        if (!acc || !acc.email || !acc.data) {
          showToast('Format file backup tidak valid', 'error');
          return;
        }
        const email = normalizeEmail(acc.email);
        vault.accounts[email] = {
          email,
          name: acc.name || acc.data.userName || 'Pengguna',
          salt: acc.salt || '',
          passwordHash: acc.passwordHash || '',
          createdAt: acc.createdAt || new Date().toISOString(),
          cloudLinked: Boolean(cloudUser),
          data: acc.data
        };
        saveVault();

        if (!fromAuth && cloudUser && email === currentEmail) {
          state = acc.data;
          try {
            await pushUserDataToCloud(cloudUser, state);
            await refreshFromCloud({ silent: true });
            showToast(`Data ${email} dipulihkan & disinkronkan ke Cloud!`);
          } catch {
            showToast('Data dipulihkan lokal, gagal upload ke Cloud.', 'error');
          }
          closeModal();
          render();
          return;
        }

        closeModal();
        showToast(`Data akun ${email} dipulihkan! Silakan masuk dengan akun Anda.`);
        if (fromAuth) {
          authMode = 'login';
          renderAuthScreen();
        } else if (email === currentEmail) {
          state = vault.accounts[email].data;
          render();
        }
      } catch {
        showToast('Gagal membaca file backup', 'error');
      }
    };
  }

  // ==================== APP SHELL & TABS ====================
  function setActiveTab(tab, options = {}) {
    if (!['beranda', 'mutasi', 'catat', 'budget', 'laporan'].includes(tab)) return;
    activeTab = tab;
    if (options.catatType) {
      catatDraft.type = options.catatType;
      catatDraft.categoryId = options.catatType === 'income' ? INCOME_CATEGORIES[0].id : EXPENSE_CATEGORIES[0].id;
    }
    if (window.location.hash !== `#${tab}`) {
      history.replaceState(null, '', `#${tab}`);
    }
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function updateNavChrome() {
    subtitleEl.textContent = SUBTITLES[activeTab] || 'Smart Personal Finance';
    avatarEl.textContent = (state.userName || currentEmail || 'U').trim().charAt(0).toUpperCase() || 'U';
    updateInstallButtonVisibility();

    document.querySelectorAll('.nav-tab').forEach((btn) => {
      const tab = btn.dataset.tab;
      if (tab === 'catat') {
        const label = btn.querySelector('span:last-child');
        label.className = activeTab === 'catat'
          ? 'mt-1 px-2.5 py-0.5 rounded-full bg-primary-container text-white font-label-sm text-label-sm font-bold shadow-xs ring-2 ring-primary-fixed'
          : 'mt-1 px-2.5 py-0.5 rounded-full bg-primary text-white font-label-sm text-label-sm font-bold shadow-xs';
        return;
      }
      btn.className = tab === activeTab
        ? 'nav-tab flex flex-col items-center justify-center min-w-[56px] h-12 transition-colors text-primary font-bold'
        : 'nav-tab flex flex-col items-center justify-center min-w-[56px] h-12 text-on-surface-variant hover:text-on-surface transition-colors';
    });
  }

  function renderBeranda() {
    const totalBalance = getTotalBalance();
    const monthTxs = getMonthTransactions();
    const totalIn = monthTxs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const totalOut = monthTxs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const recent = sortedTransactions().slice(0, 4);

    const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const last7 = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = toISODate(d);
      const spent = state.transactions
        .filter((t) => t.type === 'expense' && t.date === iso)
        .reduce((s, t) => s + t.amount, 0);
      last7.push({ label: dayNames[d.getDay()], spent, isToday: i === 0 });
    }
    const maxSpent = Math.max(...last7.map((x) => x.spent), 1);
    const avgSpent = Math.round(last7.reduce((s, x) => s + x.spent, 0) / 7);
    const peakDay = last7.reduce((best, cur) => (cur.spent > best.spent ? cur : best), last7[0]);

    const showInstallBanner = !isAppInstalled() && !installBannerDismissed;
    const waitingEmailVerif = syncStatus === 'local-only' && pendingVerificationEmail === currentEmail;
    const syncChip = getSyncBadgeMeta();

    mainEl.innerHTML = `
      <div class="flex flex-col w-full pb-4 space-y-space-md">
        ${waitingEmailVerif ? `
          <div class="px-margin-mobile">
            <div class="bg-primary-fixed/50 rounded-xl p-3 space-y-2 shadow-xs">
              <div class="flex items-start gap-2.5">
                <span class="material-symbols-outlined text-primary text-[22px] shrink-0">mark_email_unread</span>
                <div class="min-w-0 flex-1">
                  <p class="font-label-md text-label-md text-on-primary-fixed font-bold">Menunggu Konfirmasi Email</p>
                  <p class="font-body-sm text-body-sm text-on-primary-fixed-variant">
                    Klik link verifikasi yang dikirim ke <strong>${esc(currentEmail)}</strong> (cek Inbox/Spam), lalu klik Coba Sinkron.
                  </p>
                </div>
              </div>
              <div class="flex gap-2">
                <button id="banner-resend-verif-btn" type="button" class="flex-1 py-1.5 px-3 rounded-lg bg-surface-container-lowest text-primary font-label-sm font-bold">Kirim Ulang Email</button>
                <button id="banner-link-cloud-btn" type="button" class="flex-1 py-1.5 px-3 rounded-lg bg-primary text-on-primary font-label-sm font-bold">Coba Sinkron</button>
              </div>
            </div>
          </div>
        ` : syncStatus === 'local-only' ? `
          <div class="px-margin-mobile">
            <div class="bg-tertiary-fixed/50 rounded-xl p-3 flex items-center justify-between gap-2 shadow-xs">
              <div class="flex items-center gap-2.5 min-w-0">
                <div class="w-9 h-9 rounded-xl bg-tertiary text-on-tertiary flex items-center justify-center shrink-0">
                  <span class="material-symbols-outlined text-[20px]">cloud_sync</span>
                </div>
                <div class="min-w-0">
                  <p class="font-label-md text-label-md text-on-tertiary-fixed font-bold truncate">Akun Lokal Belum Sinkron ke HP</p>
                  <p class="font-body-sm text-body-sm text-on-tertiary-fixed-variant truncate">Verifikasi password sekali agar data ikut ke HP</p>
                </div>
              </div>
              <button id="banner-link-cloud-btn" type="button" class="px-3 py-1.5 rounded-lg bg-tertiary text-on-tertiary font-label-sm text-label-sm font-bold shadow-xs shrink-0 active:scale-95 transition-transform">
                Hubungkan
              </button>
            </div>
          </div>
        ` : (syncStatus === 'offline' || syncStatus === 'schema-missing') && cloudUser ? `
          <div class="px-margin-mobile">
            <div class="bg-error-container/50 rounded-xl p-3 flex items-center justify-between gap-2 shadow-xs">
              <div class="min-w-0">
                <p class="font-label-md text-label-md text-on-error-container font-bold truncate">
                  ${syncStatus === 'schema-missing' ? 'Tabel Supabase Belum Disiapkan' : 'Sinkronisasi Cloud Tertunda'}
                </p>
                <p class="font-body-sm text-body-sm text-on-error-container/80 truncate">
                  ${esc(lastSyncError || 'Periksa koneksi internet Anda lalu coba sinkronkan ulang.')}
                </p>
              </div>
              <button id="banner-retry-sync-btn" type="button" class="px-3 py-1.5 rounded-lg bg-error text-on-error font-label-sm text-label-sm font-bold shrink-0">
                Coba Lagi
              </button>
            </div>
          </div>
        ` : ''}

        ${showInstallBanner ? `
          <div class="px-margin-mobile">
            <div class="bg-primary-fixed/40 rounded-xl p-3 flex items-center justify-between gap-2 shadow-xs">
              <div class="flex items-center gap-2.5 min-w-0">
                <div class="w-9 h-9 rounded-xl bg-primary text-on-primary flex items-center justify-center shrink-0">
                  <span class="material-symbols-outlined text-[20px]">smartphone</span>
                </div>
                <div class="min-w-0">
                  <p class="font-label-md text-label-md text-on-primary-fixed font-bold truncate">Pasang Finora di HP</p>
                  <p class="font-body-sm text-body-sm text-on-primary-fixed-variant truncate">Akses cepat dari layar utama & offline</p>
                </div>
              </div>
              <div class="flex items-center gap-1 shrink-0">
                <button id="banner-install-btn" type="button" class="px-3 py-1.5 rounded-lg bg-primary text-on-primary font-label-sm text-label-sm font-bold shadow-xs active:scale-95 transition-transform">
                  Pasang
                </button>
                <button id="banner-dismiss-btn" type="button" aria-label="Tutup" class="w-7 h-7 rounded-lg text-on-primary-fixed-variant hover:bg-primary/10 flex items-center justify-center">
                  <span class="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>
            </div>
          </div>
        ` : ''}

        <!-- Greeting Header Banner -->
        <div class="px-margin-mobile flex items-center justify-between">
          <div class="flex flex-col min-w-0 pr-2">
            <div class="flex items-center gap-space-xs">
              <span class="font-headline-md text-headline-md text-on-surface truncate">Halo, ${esc(state.userName)}!</span>
              <span class="text-[20px]">👋</span>
            </div>
            <div class="flex items-center gap-1.5 min-w-0">
              <span class="font-body-sm text-body-sm text-on-surface-variant truncate">${esc(currentEmail)}</span>
              <span class="px-1.5 py-0.5 rounded-full ${syncChip.cls} font-label-sm text-[9px] font-bold shrink-0">${esc(syncChip.label)}</span>
            </div>
          </div>
          <div class="w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center text-on-primary-fixed shadow-sm shrink-0">
            <span class="material-symbols-outlined text-[20px]" style="font-variation-settings: 'FILL' 1;">eco</span>
          </div>
        </div>

        <!-- Primary Net Balance Card -->
        <div class="px-margin-mobile">
          <div class="w-full bg-gradient-to-br from-primary via-primary to-primary-container text-on-primary rounded-xl p-space-md shadow-md relative overflow-hidden">
            <div class="absolute -right-10 -top-10 w-36 h-36 rounded-full bg-primary-fixed/15 blur-2xl pointer-events-none"></div>
            <div class="absolute -left-8 -bottom-8 w-28 h-28 rounded-full bg-inverse-primary/10 blur-xl pointer-events-none"></div>
            <div class="relative z-10 flex flex-col space-y-space-sm">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-space-xs">
                  <span class="font-label-md text-label-md text-primary-fixed uppercase tracking-wider">Total Saldo Kas</span>
                  <button id="toggle-balance-btn" type="button" aria-label="Sembunyikan atau Tampilkan Saldo" class="text-primary-fixed hover:text-on-primary transition-colors">
                    <span class="material-symbols-outlined text-[18px]">${state.hideBalance ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
                <span class="bg-primary-fixed/20 text-primary-fixed text-label-sm font-label-sm px-2 py-0.5 rounded-full backdrop-blur-sm">${state.wallets.length} Dompet Aktif</span>
              </div>
              <div class="flex items-baseline space-x-1.5 py-1">
                <span class="font-headline-sm text-headline-sm text-primary-fixed">Rp</span>
                <span class="font-numeric-hero text-numeric-hero tracking-tight">${state.hideBalance ? '••••••••' : formatRp(totalBalance)}</span>
              </div>
              <div class="grid grid-cols-2 gap-space-xs pt-space-xs">
                <div class="bg-surface-container-lowest/15 backdrop-blur-md rounded-lg p-2.5 flex items-center gap-space-xs">
                  <div class="w-7 h-7 rounded-full bg-primary-fixed text-on-primary-fixed flex items-center justify-center shrink-0">
                    <span class="material-symbols-outlined text-[16px]">arrow_upward</span>
                  </div>
                  <div class="flex flex-col min-w-0">
                    <span class="font-label-sm text-label-sm text-on-primary-container truncate">Pemasukan</span>
                    <span class="font-numeric-table text-numeric-table text-on-primary truncate">${state.hideBalance ? '••••••' : `+Rp ${formatRp(totalIn)}`}</span>
                  </div>
                </div>
                <div class="bg-surface-container-lowest/15 backdrop-blur-md rounded-lg p-2.5 flex items-center gap-space-xs">
                  <div class="w-7 h-7 rounded-full bg-secondary-fixed text-secondary flex items-center justify-center shrink-0">
                    <span class="material-symbols-outlined text-[16px]">arrow_downward</span>
                  </div>
                  <div class="flex flex-col min-w-0">
                    <span class="font-label-sm text-label-sm text-on-primary-container truncate">Pengeluaran</span>
                    <span class="font-numeric-table text-numeric-table text-secondary-fixed truncate">${state.hideBalance ? '••••••' : `-Rp ${formatRp(totalOut)}`}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Quick Action Buttons -->
        <div class="px-margin-mobile">
          <div class="grid grid-cols-4 gap-space-xs">
            <button data-quick="income" type="button" class="flex flex-col items-center justify-center p-2 rounded-xl bg-surface-container-lowest shadow-sm hover:bg-surface-container transition-transform active:scale-95 text-center group">
              <div class="w-11 h-11 rounded-full bg-primary-fixed/40 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-on-primary transition-colors">
                <span class="material-symbols-outlined text-[22px]">add_circle</span>
              </div>
              <span class="font-label-sm text-label-sm text-on-surface mt-1.5 line-clamp-1">Catat Masuk</span>
            </button>
            <button data-quick="expense" type="button" class="flex flex-col items-center justify-center p-2 rounded-xl bg-surface-container-lowest shadow-sm hover:bg-surface-container transition-transform active:scale-95 text-center group">
              <div class="w-11 h-11 rounded-full bg-secondary-fixed/50 flex items-center justify-center text-secondary group-hover:bg-secondary group-hover:text-on-secondary transition-colors">
                <span class="material-symbols-outlined text-[22px]">remove_circle</span>
              </div>
              <span class="font-label-sm text-label-sm text-on-surface mt-1.5 line-clamp-1">Catat Keluar</span>
            </button>
            <button data-quick="budget" type="button" class="flex flex-col items-center justify-center p-2 rounded-xl bg-surface-container-lowest shadow-sm hover:bg-surface-container transition-transform active:scale-95 text-center group">
              <div class="w-11 h-11 rounded-full bg-surface-container-highest flex items-center justify-center text-tertiary group-hover:bg-tertiary group-hover:text-on-tertiary transition-colors">
                <span class="material-symbols-outlined text-[22px]">account_balance_wallet</span>
              </div>
              <span class="font-label-sm text-label-sm text-on-surface mt-1.5 line-clamp-1">Atur Budget</span>
            </button>
            <button data-quick="laporan" type="button" class="flex flex-col items-center justify-center p-2 rounded-xl bg-surface-container-lowest shadow-sm hover:bg-surface-container transition-transform active:scale-95 text-center group">
              <div class="w-11 h-11 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant group-hover:bg-inverse-surface group-hover:text-inverse-on-surface transition-colors">
                <span class="material-symbols-outlined text-[22px]">file_download</span>
              </div>
              <span class="font-label-sm text-label-sm text-on-surface mt-1.5 line-clamp-1">Export Data</span>
            </button>
          </div>
        </div>

        <!-- Weekly Cashflow Mini Trend -->
        <div class="px-margin-mobile">
          <div class="w-full bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col space-y-space-sm">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-space-xs">
                <span class="material-symbols-outlined text-[20px] text-primary">insights</span>
                <span class="font-headline-sm text-headline-sm text-on-surface">Tren Keluar 7 Hari</span>
              </div>
              <span class="bg-surface-container text-on-surface-variant font-label-sm text-label-sm px-2.5 py-1 rounded-full">
                Rata-rata: Rp ${formatShortRp(avgSpent)}/hari
              </span>
            </div>
            <div class="w-full pt-2">
              <div class="h-24 w-full flex flex-col justify-end">
                <div class="grid grid-cols-7 gap-2 items-end h-16 w-full px-1">
                  ${last7.map((d) => {
                    const hPct = d.spent > 0 ? Math.max(14, Math.round((d.spent / maxSpent) * 100)) : 6;
                    const isPeak = d.spent > 0 && d.spent === peakDay.spent;
                    const barClass = d.spent === 0
                      ? 'bg-surface-container-highest'
                      : d.isToday
                        ? 'bg-primary shadow-sm'
                        : isPeak
                          ? 'bg-secondary shadow-sm'
                          : 'bg-surface-container-highest group-hover:bg-primary';
                    const textClass = d.isToday
                      ? 'text-primary font-bold'
                      : isPeak
                        ? 'text-secondary font-bold'
                        : 'text-on-surface-variant';
                    return `
                      <div class="flex flex-col items-center gap-1 h-full justify-end group" title="Rp ${formatRp(d.spent)}">
                        <div class="w-full max-w-[20px] ${barClass} rounded-t-sm transition-all" style="height: ${hPct}%;"></div>
                        <span class="font-label-sm text-label-sm ${textClass}">${d.label}</span>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            </div>
            <div class="flex items-center justify-between pt-1 text-on-surface-variant">
              <span class="font-body-sm text-body-sm flex items-center gap-1">
                <span class="w-2 h-2 rounded-full bg-primary inline-block"></span> Hari ini: Rp ${formatShortRp(last7[6].spent)}
              </span>
              <span class="font-body-sm text-body-sm flex items-center gap-1">
                <span class="w-2 h-2 rounded-full bg-secondary inline-block"></span> Puncak: Rp ${formatShortRp(peakDay.spent)}
              </span>
            </div>
          </div>
        </div>

        <!-- Smart Tip Banner -->
        <div class="px-margin-mobile">
          <div class="w-full bg-surface-container rounded-xl p-3 flex items-start gap-space-sm shadow-sm">
            <div class="w-8 h-8 rounded-full bg-tertiary-fixed flex items-center justify-center text-tertiary shrink-0 mt-0.5">
              <span class="material-symbols-outlined text-[18px]">lightbulb</span>
            </div>
            <div class="flex-1 flex flex-col">
              <p class="font-body-sm text-body-sm text-on-surface leading-tight">
                <strong class="font-bold text-primary">Selisih bulan ini: ${totalIn - totalOut >= 0 ? '+' : '-'}Rp ${formatRp(totalIn - totalOut)}</strong>. Data tersimpan rapi untuk akun ${esc(currentEmail)}.
              </p>
              <button id="tip-download-btn" type="button" class="font-label-sm text-label-sm text-tertiary text-left mt-1 font-bold hover:underline inline-flex items-center gap-0.5">
                Unduh Laporan Mingguan <span class="material-symbols-outlined text-[14px]">chevron_right</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Recent Transactions Section -->
        <div class="px-margin-mobile flex flex-col space-y-space-sm">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-space-xs">
              <span class="font-headline-sm text-headline-sm text-on-surface">Transaksi Terkini</span>
              <span class="bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm px-2 py-0.5 rounded-full">${state.transactions.length}</span>
            </div>
            <button id="home-see-all-btn" type="button" class="font-label-md text-label-md text-primary hover:text-primary-container font-semibold transition-colors flex items-center gap-0.5">
              Lihat Semua
              <span class="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>
          <div class="flex flex-col space-y-2">
            ${recent.length === 0 ? `
              <div class="bg-surface-container-lowest p-6 rounded-xl text-center shadow-sm flex flex-col items-center gap-2">
                <span class="material-symbols-outlined text-[32px] text-primary">add_task</span>
                <p class="font-label-lg text-on-surface">Belum ada transaksi</p>
                <p class="font-body-sm text-on-surface-variant">Ketuk tombol <strong>+ Catat</strong> di bawah untuk mulai mencatat pemasukan atau pengeluaran.</p>
              </div>
            ` : recent.map((tx) => {
              const cat = getCategory(tx.categoryId);
              const wal = getWallet(tx.walletId);
              const isInc = tx.type === 'income';
              return `
                <button data-tx-id="${esc(tx.id)}" type="button" class="tx-item-btn w-full text-left bg-surface-container-lowest p-space-md rounded-xl flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
                  <div class="flex items-center gap-space-sm min-w-0">
                    <div class="w-10 h-10 rounded-full ${isInc ? 'bg-primary-fixed/50 text-primary' : 'bg-secondary-fixed/50 text-secondary'} flex items-center justify-center shrink-0">
                      <span class="material-symbols-outlined text-[20px]">${esc(cat.icon)}</span>
                    </div>
                    <div class="flex flex-col min-w-0">
                      <span class="font-body-md text-body-md font-bold text-on-surface truncate">${esc(tx.note || cat.name)}</span>
                      <span class="font-body-sm text-body-sm text-on-surface-variant truncate">${esc(cat.name)} • ${esc(wal.name)}</span>
                      <span class="font-label-sm text-label-sm text-outline">${esc(formatIndoDate(tx.date))}, ${esc(tx.time)}</span>
                    </div>
                  </div>
                  <div class="flex flex-col items-end shrink-0 pl-2">
                    <span class="font-numeric-table text-numeric-table ${isInc ? 'text-primary' : 'text-secondary'} font-bold">${isInc ? '+' : '-'}Rp ${formatRp(tx.amount)}</span>
                    <span class="font-label-sm text-label-sm px-2 py-0.5 rounded-full ${isInc ? 'bg-primary-fixed/30 text-primary' : 'bg-secondary-fixed/30 text-secondary'} mt-1">${isInc ? 'Masuk' : 'Keluar'}</span>
                  </div>
                </button>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;

    document.getElementById('toggle-balance-btn').onclick = () => {
      state.hideBalance = !state.hideBalance;
      saveState();
      syncCloudAction({
        type: 'update_profile',
        payload: { userName: state.userName, hideBalance: state.hideBalance }
      });
      renderBeranda();
    };

    const linkCloudBtn = document.getElementById('banner-link-cloud-btn');
    if (linkCloudBtn) linkCloudBtn.onclick = openLinkCloudModal;

    const resendBannerBtn = document.getElementById('banner-resend-verif-btn');
    if (resendBannerBtn) {
      resendBannerBtn.onclick = async () => {
        if (!sb || !currentEmail) return;
        resendBannerBtn.disabled = true;
        resendBannerBtn.textContent = 'Mengirim...';
        const { error } = await sb.auth.resend({
          type: 'signup',
          email: currentEmail,
          options: { emailRedirectTo: getAuthRedirectUrl() }
        });
        if (error) showToast(mapAuthErrorMessage(error), 'error');
        else showToast(`Email verifikasi dikirim ulang ke ${currentEmail}`);
        resendBannerBtn.disabled = false;
        resendBannerBtn.textContent = 'Kirim Ulang Email';
      };
    }

    const retrySyncBtn = document.getElementById('banner-retry-sync-btn');
    if (retrySyncBtn) {
      retrySyncBtn.onclick = () => refreshFromCloud({ silent: false });
    }

    const bannerInstallBtn = document.getElementById('banner-install-btn');
    if (bannerInstallBtn) bannerInstallBtn.onclick = triggerInstall;
    const bannerDismissBtn = document.getElementById('banner-dismiss-btn');
    if (bannerDismissBtn) {
      bannerDismissBtn.onclick = () => {
        installBannerDismissed = true;
        renderBeranda();
      };
    }

    document.querySelectorAll('[data-quick]').forEach((btn) => {
      btn.onclick = () => {
        const q = btn.dataset.quick;
        if (q === 'income') setActiveTab('catat', { catatType: 'income' });
        else if (q === 'expense') setActiveTab('catat', { catatType: 'expense' });
        else setActiveTab(q);
      };
    });

    document.getElementById('tip-download-btn').onclick = () => setActiveTab('laporan');
    document.getElementById('home-see-all-btn').onclick = () => setActiveTab('mutasi');
    bindTxDetailHandlers();
  }

  function getFilteredMutasi() {
    const q = mutasiFilters.search.trim().toLowerCase();
    return sortedTransactions().filter((tx) => {
      if (mutasiFilters.type !== 'all' && tx.type !== mutasiFilters.type) return false;
      if (mutasiFilters.categoryId !== 'all' && tx.categoryId !== mutasiFilters.categoryId) return false;
      if (mutasiFilters.walletId !== 'all' && tx.walletId !== mutasiFilters.walletId) return false;
      if (q) {
        const cat = getCategory(tx.categoryId).name.toLowerCase();
        const wal = getWallet(tx.walletId).name.toLowerCase();
        const note = (tx.note || '').toLowerCase();
        const tag = (tx.tag || '').toLowerCase();
        if (!cat.includes(q) && !wal.includes(q) && !note.includes(q) && !tag.includes(q)) return false;
      }
      return true;
    });
  }

  function renderMutasi() {
    const filtered = getFilteredMutasi();
    const totalIn = filtered.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const totalOut = filtered.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const net = totalIn - totalOut;

    const groups = new Map();
    for (const tx of filtered) {
      const k = tx.date || 'Lainnya';
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(tx);
    }

    const allCats = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];

    mainEl.innerHTML = `
      <div class="flex flex-col w-full px-margin-mobile pb-space-lg gap-space-md">
        <div class="flex items-start justify-between gap-space-sm pt-space-xs">
          <div class="flex flex-col">
            <div class="flex items-center gap-space-xs">
              <h1 class="font-headline-md text-headline-md text-on-surface">Riwayat Mutasi</h1>
              <span class="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-primary font-label-sm text-label-sm">Live</span>
            </div>
            <p class="font-body-sm text-body-sm text-on-surface-variant mt-0.5">Semua catatan uang masuk & keluar harian</p>
          </div>
          <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container-low text-on-surface-variant shadow-sm shrink-0">
            <span class="w-1.5 h-1.5 rounded-full bg-primary"></span>
            <span class="font-label-sm text-label-sm font-semibold">${filtered.length} Transaksi</span>
          </div>
        </div>

        <div class="flex flex-col gap-space-sm">
          <div class="flex items-center gap-space-xs">
            <div class="relative flex-1 flex items-center bg-surface-container-lowest rounded-xl shadow-sm">
              <span class="material-symbols-outlined text-[20px] text-outline ml-3">search</span>
              <input id="mutasi-search" type="text" value="${esc(mutasiFilters.search)}" placeholder="Cari transaksi, kategori, dompet..." class="w-full bg-transparent py-2.5 pl-2 pr-9 font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none">
              ${mutasiFilters.search ? `
                <button id="mutasi-clear-search" type="button" aria-label="Hapus pencarian" class="absolute right-2.5 w-6 h-6 flex items-center justify-center rounded-full bg-surface-variant text-on-surface-variant">
                  <span class="material-symbols-outlined text-[16px]">close</span>
                </button>
              ` : ''}
            </div>
          </div>

          <div class="flex items-center gap-space-xs overflow-x-auto no-scrollbar py-0.5">
            <button data-type-filter="all" type="button" class="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full ${mutasiFilters.type === 'all' ? 'bg-primary text-on-primary' : 'bg-surface-container-lowest text-on-surface-variant'} font-label-md text-label-md whitespace-nowrap shadow-sm">
              <span class="material-symbols-outlined text-[16px]">checklist</span>
              <span>Semua</span>
            </button>
            <button data-type-filter="expense" type="button" class="flex items-center gap-1 px-3 py-1.5 rounded-full ${mutasiFilters.type === 'expense' ? 'bg-secondary text-on-secondary' : 'bg-surface-container-lowest text-secondary'} font-label-md text-label-md whitespace-nowrap shadow-sm">
              <span class="material-symbols-outlined text-[16px]">arrow_downward</span>
              <span>Pengeluaran (-)</span>
            </button>
            <button data-type-filter="income" type="button" class="flex items-center gap-1 px-3 py-1.5 rounded-full ${mutasiFilters.type === 'income' ? 'bg-primary text-on-primary' : 'bg-surface-container-lowest text-primary'} font-label-md text-label-md whitespace-nowrap shadow-sm">
              <span class="material-symbols-outlined text-[16px]">arrow_upward</span>
              <span>Pemasukan (+)</span>
            </button>
            <select id="mutasi-cat-filter" class="px-3 py-1.5 rounded-full bg-surface-container-lowest text-on-surface-variant font-label-md text-label-md shadow-sm focus:outline-none">
              <option value="all">Kategori: Semua</option>
              ${allCats.map((c) => `<option value="${esc(c.id)}" ${mutasiFilters.categoryId === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
            </select>
            <select id="mutasi-wallet-filter" class="px-3 py-1.5 rounded-full bg-surface-container-lowest text-on-surface-variant font-label-md text-label-md shadow-sm focus:outline-none">
              <option value="all">Dompet: Semua</option>
              ${state.wallets.map((w) => `<option value="${esc(w.id)}" ${mutasiFilters.walletId === w.id ? 'selected' : ''}>${esc(w.name)}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="flex flex-col bg-surface-container-lowest rounded-xl p-space-md shadow-sm gap-space-sm">
          <div class="flex items-center justify-between">
            <span class="font-label-md text-label-md text-on-surface-variant flex items-center gap-1.5">
              <span class="material-symbols-outlined text-[18px] text-tertiary">query_stats</span>
              Ringkasan Hasil Filter
            </span>
          </div>
          <div class="grid grid-cols-3 gap-2 pt-1">
            <div class="flex flex-col bg-surface-container-low rounded-lg p-2.5">
              <span class="font-label-sm text-label-sm text-on-surface-variant">Masuk</span>
              <span class="font-numeric-table text-numeric-table text-primary mt-1 font-bold truncate">+${formatShortRp(totalIn)}</span>
            </div>
            <div class="flex flex-col bg-surface-container-low rounded-lg p-2.5">
              <span class="font-label-sm text-label-sm text-on-surface-variant">Keluar</span>
              <span class="font-numeric-table text-numeric-table text-secondary mt-1 font-bold truncate">-${formatShortRp(totalOut)}</span>
            </div>
            <div class="flex flex-col bg-primary-fixed/25 rounded-lg p-2.5">
              <span class="font-label-sm text-label-sm text-on-primary-fixed-variant font-semibold">Selisih</span>
              <span class="font-numeric-table text-numeric-table ${net >= 0 ? 'text-primary' : 'text-secondary'} mt-1 font-bold truncate">${net >= 0 ? '+' : '-'}${formatShortRp(net)}</span>
            </div>
          </div>
        </div>

        <div class="flex flex-col gap-space-md">
          ${groups.size === 0 ? `
            <div class="bg-surface-container-lowest rounded-xl p-8 text-center shadow-sm flex flex-col items-center gap-2">
              <span class="material-symbols-outlined text-[40px] text-outline">receipt_long</span>
              <p class="font-headline-sm text-headline-sm text-on-surface">Belum ada transaksi</p>
              <p class="font-body-sm text-body-sm text-on-surface-variant">Ubah filter atau catat transaksi baru di menu + Catat.</p>
            </div>
          ` : Array.from(groups.entries()).map(([dateKey, items]) => {
            const dayNet = items.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0);
            return `
              <div class="flex flex-col gap-space-xs">
                <div class="flex items-center justify-between px-1 py-1">
                  <div class="flex items-center gap-1.5">
                    <span class="w-2 h-2 rounded-full ${dateKey === toISODate(new Date()) ? 'bg-primary' : 'bg-outline'}"></span>
                    <span class="font-label-lg text-label-lg font-bold text-on-surface">${esc(formatIndoDate(dateKey))}</span>
                  </div>
                  <span class="font-label-sm text-label-sm font-semibold ${dayNet >= 0 ? 'text-primary bg-primary-fixed/40' : 'text-secondary bg-error-container/40'} px-2 py-0.5 rounded-full">
                    ${dayNet >= 0 ? '+' : '-'}Rp ${formatRp(dayNet)}
                  </span>
                </div>
                <div class="flex flex-col bg-surface-container-lowest rounded-xl shadow-sm divide-y divide-surface-container-low overflow-hidden">
                  ${items.map((tx) => {
                    const cat = getCategory(tx.categoryId);
                    const wal = getWallet(tx.walletId);
                    const isInc = tx.type === 'income';
                    return `
                      <button data-tx-id="${esc(tx.id)}" type="button" class="tx-item-btn w-full text-left flex items-center justify-between p-space-md hover:bg-surface-container-low/50 transition-colors">
                        <div class="flex items-center gap-space-sm min-w-0">
                          <div class="w-10 h-10 rounded-xl ${isInc ? 'bg-primary/10 text-primary' : 'bg-secondary/10 text-secondary'} flex items-center justify-center shrink-0">
                            <span class="material-symbols-outlined text-[22px]">${esc(cat.icon)}</span>
                          </div>
                          <div class="flex flex-col min-w-0">
                            <span class="font-label-lg text-label-lg font-bold text-on-surface truncate">${esc(tx.note || cat.name)}</span>
                            <div class="flex items-center gap-1.5 flex-wrap mt-0.5">
                              <span class="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-0.5">
                                <span class="material-symbols-outlined text-[13px]">${esc(wal.icon)}</span> ${esc(wal.name)}
                              </span>
                              <span class="text-outline-variant">•</span>
                              <span class="font-body-sm text-body-sm text-outline">${esc(tx.time)}</span>
                              ${tx.tag ? `<span class="px-1.5 py-0.2 rounded bg-surface-container-high text-on-surface-variant font-label-sm text-[10px]">${esc(tx.tag)}</span>` : ''}
                            </div>
                          </div>
                        </div>
                        <div class="flex flex-col items-end shrink-0 pl-2">
                          <span class="font-numeric-table text-numeric-table font-bold ${isInc ? 'text-primary' : 'text-secondary'}">${isInc ? '+' : '-'}Rp ${formatRp(tx.amount)}</span>
                          <span class="font-label-sm text-label-sm text-outline">${esc(cat.name)}</span>
                        </div>
                      </button>
                    `;
                  }).join('')}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    const searchInput = document.getElementById('mutasi-search');
    searchInput.oninput = (e) => {
      mutasiFilters.search = e.target.value;
      renderMutasi();
      const el = document.getElementById('mutasi-search');
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    };

    const clearBtn = document.getElementById('mutasi-clear-search');
    if (clearBtn) {
      clearBtn.onclick = () => {
        mutasiFilters.search = '';
        renderMutasi();
      };
    }

    document.querySelectorAll('[data-type-filter]').forEach((btn) => {
      btn.onclick = () => {
        mutasiFilters.type = btn.dataset.typeFilter;
        renderMutasi();
      };
    });

    document.getElementById('mutasi-cat-filter').onchange = (e) => {
      mutasiFilters.categoryId = e.target.value;
      renderMutasi();
    };

    document.getElementById('mutasi-wallet-filter').onchange = (e) => {
      mutasiFilters.walletId = e.target.value;
      renderMutasi();
    };

    bindTxDetailHandlers();
  }

  function openDeleteTxConfirmModal(tx) {
    if (!tx) return;
    const cat = getCategory(tx.categoryId);
    const wal = getWallet(tx.walletId);
    const isInc = tx.type === 'income';

    if (!state?.pinHash || !state?.pinSalt) {
      openModal(`
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <div class="w-9 h-9 rounded-xl bg-error-container text-on-error-container flex items-center justify-center">
              <span class="material-symbols-outlined text-[20px]">pin</span>
            </div>
            <h3 class="font-headline-sm text-headline-sm text-on-surface">PIN Belum Diatur</h3>
          </div>
          <button id="modal-close-btn" type="button" class="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant">
            <span class="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
        <p class="font-body-sm text-body-sm text-on-surface-variant mb-4">
          Untuk melindungi riwayat keuangan Anda, penghapusan transaksi mewajibkan verifikasi <strong>PIN Keamanan (6 digit)</strong>. Silakan buat PIN Anda terlebih dahulu di menu Pengaturan Akun.
        </p>
        <div class="flex gap-2">
          <button id="del-tx-go-pin-btn" type="button" class="flex-1 py-2.5 rounded-xl bg-primary text-on-primary font-label-md font-bold">
            Buat PIN Sekarang
          </button>
          <button id="del-tx-cancel-btn" type="button" class="py-2.5 px-4 rounded-xl bg-surface-container text-on-surface font-label-md font-semibold">
            Batal
          </button>
        </div>
      `);
      document.getElementById('modal-close-btn').onclick = closeModal;
      document.getElementById('del-tx-cancel-btn').onclick = closeModal;
      document.getElementById('del-tx-go-pin-btn').onclick = () => {
        openAccountSettingsModal();
        setTimeout(() => {
          const pinInp = document.getElementById('acc-new-pin');
          if (pinInp) {
            pinInp.scrollIntoView({ behavior: 'smooth', block: 'center' });
            pinInp.focus();
          }
        }, 60);
      };
      return;
    }

    openModal(`
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <div class="w-9 h-9 rounded-xl bg-error-container text-on-error-container flex items-center justify-center">
            <span class="material-symbols-outlined text-[20px]">delete</span>
          </div>
          <div>
            <h3 class="font-headline-sm text-headline-sm text-on-surface">Hapus Transaksi</h3>
            <p class="font-body-sm text-body-sm text-secondary">Verifikasi PIN keamanan diperlukan</p>
          </div>
        </div>
        <button id="modal-close-btn" type="button" class="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant">
          <span class="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>

      <div class="p-3 rounded-xl bg-surface-container-low mb-3 space-y-1.5">
        <div class="flex justify-between items-center text-body-sm">
          <span class="text-on-surface-variant">Jenis</span>
          <span class="font-semibold ${isInc ? 'text-primary' : 'text-secondary'}">${isInc ? 'Pemasukan' : 'Pengeluaran'}</span>
        </div>
        <div class="flex justify-between items-center text-body-sm">
          <span class="text-on-surface-variant">Nominal</span>
          <span class="font-semibold ${isInc ? 'text-primary' : 'text-secondary'}">${isInc ? '+' : '-'}Rp ${formatRp(tx.amount)}</span>
        </div>
        <div class="flex justify-between items-center text-body-sm">
          <span class="text-on-surface-variant">Keterangan</span>
          <span class="font-medium text-on-surface">${esc(tx.note || cat.name)}</span>
        </div>
        <div class="flex justify-between items-center text-body-sm">
          <span class="text-on-surface-variant">Sumber Dana</span>
          <span class="font-medium text-on-surface">${esc(wal.name)}</span>
        </div>
        <div class="flex justify-between items-center text-body-sm">
          <span class="text-on-surface-variant">Waktu</span>
          <span class="text-on-surface-variant">${esc(formatIndoDate(tx.date))} • ${esc(tx.time)}</span>
        </div>
      </div>

      <p class="text-[12px] text-on-surface-variant mb-3 leading-relaxed">
        *Saldo dompet <strong>${esc(wal.name)}</strong> akan otomatis disesuaikan (dikembalikan) saat transaksi ini dihapus.
      </p>

      <form id="delete-tx-pin-form" class="space-y-3" novalidate>
        <div>
          <label class="font-label-sm text-label-sm text-on-surface-variant" for="delete-tx-pin">Masukkan PIN Keamanan (6 digit)</label>
          <input id="delete-tx-pin" type="password" inputmode="numeric" maxlength="6" autocomplete="off" placeholder="••••••" class="mt-1 w-full px-3 py-2.5 rounded-xl bg-surface-container-low text-on-surface font-numeric-table tracking-widest focus:outline-none focus:ring-2 focus:ring-error/30" required autofocus>
        </div>
        <div class="flex gap-2 pt-1">
          <button id="del-tx-form-cancel" type="button" class="py-2.5 px-4 rounded-xl bg-surface-container text-on-surface font-label-md font-semibold">
            Batal
          </button>
          <button type="submit" id="del-tx-confirm-submit" class="flex-1 py-2.5 rounded-xl bg-error text-on-error font-label-md font-bold flex items-center justify-center gap-1.5 hover:opacity-90">
            <span class="material-symbols-outlined text-[18px]">delete</span>
            <span>Konfirmasi Hapus</span>
          </button>
        </div>
      </form>
    `);

    document.getElementById('modal-close-btn').onclick = closeModal;
    document.getElementById('del-tx-form-cancel').onclick = closeModal;
    setTimeout(() => {
      const pinInp = document.getElementById('delete-tx-pin');
      if (pinInp) pinInp.focus();
    }, 60);

    document.getElementById('delete-tx-pin-form').onsubmit = async (e) => {
      e.preventDefault();
      const pinInput = String(document.getElementById('delete-tx-pin').value || '').trim();
      if (!/^\d{6}$/.test(pinInput)) {
        showToast('PIN harus terdiri dari 6 digit angka', 'error');
        return;
      }

      const submitBtn = document.getElementById('del-tx-confirm-submit');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Memverifikasi...';
      }

      const attemptHash = await hashPassword(pinInput, state.pinSalt);
      if (attemptHash !== state.pinHash) {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span class="material-symbols-outlined text-[18px]">delete</span><span>Konfirmasi Hapus</span>';
        }
        showToast('PIN keamanan salah. Transaksi batal dihapus.', 'error');
        return;
      }

      const w = state.wallets.find((item) => item.id === tx.walletId);
      if (w) {
        w.balance += tx.type === 'income' ? -tx.amount : tx.amount;
      }
      state.transactions = state.transactions.filter((item) => item.id !== tx.id);
      saveState();
      syncCloudAction({ type: 'delete_tx', payload: { id: tx.id } });
      closeModal();
      showToast('Transaksi berhasil dihapus & saldo dompet disesuaikan');
      render();
    };
  }

  function bindTxDetailHandlers() {
    document.querySelectorAll('.tx-item-btn').forEach((btn) => {
      btn.onclick = () => {
        const tx = state.transactions.find((t) => t.id === btn.dataset.txId);
        if (!tx) return;
        const cat = getCategory(tx.categoryId);
        const wal = getWallet(tx.walletId);
        const isInc = tx.type === 'income';
        openModal(`
          <div class="flex items-center justify-between mb-4">
            <h3 class="font-headline-sm text-headline-sm text-on-surface">Detail Transaksi</h3>
            <button id="modal-close-btn" type="button" class="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant">
              <span class="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
          <div class="p-4 rounded-xl bg-surface-container-low flex flex-col items-center text-center gap-1 mb-4">
            <span class="font-label-sm text-label-sm uppercase ${isInc ? 'text-primary' : 'text-secondary'}">${isInc ? 'Pemasukan' : 'Pengeluaran'}</span>
            <span class="font-numeric-hero text-numeric-hero ${isInc ? 'text-primary' : 'text-secondary'}">${isInc ? '+' : '-'}Rp ${formatRp(tx.amount)}</span>
            <span class="font-body-md text-body-md font-semibold text-on-surface mt-1">${esc(tx.note || cat.name)}</span>
          </div>
          <div class="space-y-2 text-body-sm mb-5">
            <div class="flex justify-between py-1.5 border-b border-surface-container">
              <span class="text-on-surface-variant">Kategori</span>
              <span class="font-semibold text-on-surface">${esc(cat.name)}</span>
            </div>
            <div class="flex justify-between py-1.5 border-b border-surface-container">
              <span class="text-on-surface-variant">Sumber Dana</span>
              <span class="font-semibold text-on-surface">${esc(wal.name)}</span>
            </div>
            <div class="flex justify-between py-1.5 border-b border-surface-container">
              <span class="text-on-surface-variant">Waktu</span>
              <span class="font-semibold text-on-surface">${esc(formatIndoDate(tx.date))} • ${esc(tx.time)}</span>
            </div>
            ${tx.tag ? `
              <div class="flex justify-between py-1.5 border-b border-surface-container">
                <span class="text-on-surface-variant">Label</span>
                <span class="font-semibold text-primary">${esc(tx.tag)}</span>
              </div>
            ` : ''}
          </div>
          <button id="delete-tx-btn" type="button" class="w-full py-2.5 rounded-xl bg-error-container text-on-error-container font-label-md font-bold flex items-center justify-center gap-1.5 hover:opacity-90">
            <span class="material-symbols-outlined text-[18px]">delete</span>
            <span>Hapus Transaksi</span>
          </button>
        `);
        document.getElementById('modal-close-btn').onclick = closeModal;
        document.getElementById('delete-tx-btn').onclick = () => {
          openDeleteTxConfirmModal(tx);
        };
      };
    });
  }

  function renderCatat() {
    const isExp = catatDraft.type === 'expense';
    const cats = isExp ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
    if (!cats.some((c) => c.id === catatDraft.categoryId)) {
      catatDraft.categoryId = cats[0].id;
    }
    if (!state.wallets.some((w) => w.id === catatDraft.walletId) && state.wallets[0]) {
      catatDraft.walletId = state.wallets[0].id;
    }

    mainEl.innerHTML = `
      <div class="px-margin-mobile pt-space-xs pb-space-lg flex flex-col gap-space-md">
        <div class="p-1 bg-surface-container-high rounded-full flex items-center shadow-sm">
          <button id="catat-btn-expense" type="button" class="flex-1 py-2 px-3 rounded-full ${isExp ? 'bg-secondary text-on-secondary shadow-sm' : 'text-on-surface-variant'} font-label-md text-label-md flex items-center justify-center gap-1.5 transition-all">
            <span class="material-symbols-outlined text-[18px]">arrow_outward</span>
            <span>Pengeluaran</span>
          </button>
          <button id="catat-btn-income" type="button" class="flex-1 py-2 px-3 rounded-full ${!isExp ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'} font-label-md text-label-md flex items-center justify-center gap-1.5 transition-all">
            <span class="material-symbols-outlined text-[18px]">south_west</span>
            <span>Pemasukan</span>
          </button>
        </div>

        <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col items-center justify-center">
          <div class="flex items-center gap-1 text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider mb-1">
            <span class="w-2 h-2 rounded-full ${isExp ? 'bg-secondary' : 'bg-primary'} inline-block"></span>
            <span>${isExp ? 'Nominal Pengeluaran' : 'Nominal Pemasukan'}</span>
          </div>
          <div class="w-full flex items-center justify-center gap-1 py-1">
            <span class="font-headline-sm text-headline-sm text-on-surface-variant font-medium">Rp</span>
            <input id="catat-amount-input" type="text" inputmode="numeric" value="${formatRp(catatDraft.amount)}" class="w-48 text-center font-numeric-hero text-numeric-hero text-on-surface tracking-tight bg-transparent focus:outline-none border-b border-transparent focus:border-primary/40">
            <button id="catat-backspace" type="button" aria-label="Hapus digit" class="p-2 text-on-surface-variant hover:text-secondary active:scale-90 transition-transform">
              <span class="material-symbols-outlined text-[22px]">backspace</span>
            </button>
          </div>
          <div class="flex items-center justify-center gap-2 mt-space-xs w-full overflow-x-auto no-scrollbar pb-0.5">
            ${[10000, 20000, 50000, 100000].map((v) => `
              <button data-add-amt="${v}" type="button" class="py-1 px-2.5 rounded-full bg-surface-container-low text-on-surface font-label-sm text-label-sm hover:bg-surface-container active:scale-95 transition-all shadow-xs">
                +${v / 1000}rb
              </button>
            `).join('')}
            <button id="catat-reset-amt" type="button" class="py-1 px-2.5 rounded-full bg-surface-container text-on-surface-variant font-label-sm text-label-sm active:scale-95">
              0
            </button>
          </div>
        </div>

        <div class="flex flex-col gap-space-xs">
          <div class="flex items-center justify-between">
            <span class="font-label-lg text-label-lg text-on-surface font-semibold">Pilih Kategori</span>
            <span class="font-label-sm text-label-sm text-primary font-medium">${cats.length} Pilihan</span>
          </div>
          <div class="grid grid-cols-4 gap-2">
            ${cats.map((c) => {
              const active = catatDraft.categoryId === c.id;
              const activeClass = isExp ? 'bg-secondary-container text-on-secondary-container' : 'bg-primary-container text-on-primary-container';
              return `
                <button data-cat-id="${esc(c.id)}" type="button" class="flex flex-col items-center p-2.5 rounded-xl ${active ? activeClass : 'bg-surface-container-lowest text-on-surface hover:bg-surface-container-low'} shadow-xs transition-all active:scale-95">
                  <div class="w-10 h-10 rounded-full ${active ? 'bg-surface-container-lowest/25' : 'bg-surface-container text-on-surface-variant'} flex items-center justify-center mb-1">
                    <span class="material-symbols-outlined text-[20px]" ${active ? 'style="font-variation-settings: \'FILL\' 1;"' : ''}>${esc(c.icon)}</span>
                  </div>
                  <span class="font-label-sm text-label-sm text-center leading-tight truncate w-full">${esc(c.name)}</span>
                </button>
              `;
            }).join('')}
          </div>
        </div>

        <div class="flex flex-col gap-space-xs">
          <span class="font-label-lg text-label-lg text-on-surface font-semibold">Sumber Dana</span>
          <div class="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            ${state.wallets.map((w) => {
              const active = catatDraft.walletId === w.id;
              return `
                <button data-wallet-id="${esc(w.id)}" type="button" class="px-3 py-2 rounded-xl ${active ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container-lowest text-on-surface shadow-xs hover:bg-surface-container-low'} font-label-md text-label-md flex items-center gap-1.5 shrink-0 active:scale-95 transition-all">
                  <span class="material-symbols-outlined text-[18px]">${esc(w.icon)}</span>
                  <span>${esc(w.name)}</span>
                </button>
              `;
            }).join('')}
          </div>
        </div>

        <div class="flex flex-col gap-space-sm bg-surface-container-lowest p-space-md rounded-xl shadow-sm">
          <div class="grid grid-cols-2 gap-2">
            <div class="flex flex-col gap-1">
              <label class="font-label-sm text-label-sm text-on-surface-variant" for="catat-date">Tanggal</label>
              <input id="catat-date" type="date" value="${esc(catatDraft.date)}" class="w-full px-3 py-2 rounded-lg bg-surface-container-low text-on-surface font-body-sm focus:outline-none">
            </div>
            <div class="flex flex-col gap-1">
              <label class="font-label-sm text-label-sm text-on-surface-variant" for="catat-time">Jam</label>
              <input id="catat-time" type="time" value="${esc(catatDraft.time)}" class="w-full px-3 py-2 rounded-lg bg-surface-container-low text-on-surface font-body-sm focus:outline-none">
            </div>
          </div>

          <div class="flex flex-col gap-1">
            <label class="font-label-sm text-label-sm text-on-surface-variant" for="catat-note">Catatan Transaksi</label>
            <div class="relative flex items-center">
              <span class="material-symbols-outlined text-[20px] text-outline absolute left-3 pointer-events-none">edit_note</span>
              <input id="catat-note" type="text" value="${esc(catatDraft.note)}" placeholder="Contoh: Makan siang nasi padang + es teh" class="w-full pl-10 pr-3 py-2.5 rounded-lg bg-surface-container-low text-on-surface font-body-md text-body-md focus:bg-surface-container-lowest focus:outline-none">
            </div>
          </div>

          <div class="flex flex-col gap-1.5 pt-1">
            <span class="font-label-sm text-label-sm text-on-surface-variant">Label Keperluan</span>
            <div class="flex flex-wrap gap-1.5">
              ${TAGS.map((t) => {
                const active = catatDraft.tag === t;
                return `
                  <button data-tag="${esc(t)}" type="button" class="px-2.5 py-1 rounded-full ${active ? 'bg-primary-fixed text-on-primary-fixed-variant font-semibold' : 'bg-surface-container text-on-surface-variant'} font-label-sm text-label-sm active:scale-95 transition-all">
                    ${esc(t)}
                  </button>
                `;
              }).join('')}
            </div>
          </div>

          <div class="flex flex-col gap-1.5 pt-1">
            <span class="font-label-sm text-label-sm text-on-surface-variant">Struk Pembayaran (Opsional)</span>
            <label class="w-full p-space-md rounded-xl bg-surface-container-low flex flex-col items-center justify-center text-center cursor-pointer hover:bg-surface-container transition-colors">
              <input id="catat-receipt-input" type="file" accept="image/*,.pdf" class="hidden">
              <div class="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center text-primary mb-1.5">
                <span class="material-symbols-outlined text-[22px]">${catatDraft.receiptName ? 'task' : 'add_a_photo'}</span>
              </div>
              <span class="font-label-md text-label-md text-on-surface font-medium">${catatDraft.receiptName ? esc(catatDraft.receiptName) : 'Lampirkan Foto Struk / Nota'}</span>
              <span class="font-body-sm text-body-sm text-on-surface-variant mt-0.5">Format JPG, PNG, atau PDF</span>
            </label>
          </div>
        </div>

        <button id="catat-submit" type="button" class="w-full py-3.5 px-4 rounded-xl bg-primary text-on-primary font-headline-sm text-headline-sm font-semibold flex items-center justify-center gap-2 shadow-lg hover:bg-primary-container active:scale-[0.98] transition-all">
          <span class="material-symbols-outlined text-[22px]">check_circle</span>
          <span>Simpan Transaksi</span>
        </button>
      </div>
    `;

    document.getElementById('catat-btn-expense').onclick = () => {
      catatDraft.type = 'expense';
      renderCatat();
    };
    document.getElementById('catat-btn-income').onclick = () => {
      catatDraft.type = 'income';
      renderCatat();
    };

    const amtInput = document.getElementById('catat-amount-input');
    amtInput.oninput = (e) => {
      const digits = e.target.value.replace(/\D/g, '');
      catatDraft.amount = digits ? parseInt(digits, 10) : 0;
      e.target.value = formatRp(catatDraft.amount);
    };

    document.getElementById('catat-backspace').onclick = () => {
      const s = String(catatDraft.amount);
      catatDraft.amount = s.length > 1 ? parseInt(s.slice(0, -1), 10) : 0;
      amtInput.value = formatRp(catatDraft.amount);
    };

    document.getElementById('catat-reset-amt').onclick = () => {
      catatDraft.amount = 0;
      amtInput.value = '0';
    };

    document.querySelectorAll('[data-add-amt]').forEach((b) => {
      b.onclick = () => {
        catatDraft.amount += Number(b.dataset.addAmt);
        amtInput.value = formatRp(catatDraft.amount);
      };
    });

    document.querySelectorAll('[data-cat-id]').forEach((b) => {
      b.onclick = () => {
        catatDraft.categoryId = b.dataset.catId;
        renderCatat();
      };
    });

    document.querySelectorAll('[data-wallet-id]').forEach((b) => {
      b.onclick = () => {
        catatDraft.walletId = b.dataset.walletId;
        renderCatat();
      };
    });

    document.getElementById('catat-date').onchange = (e) => { catatDraft.date = e.target.value; };
    document.getElementById('catat-time').onchange = (e) => { catatDraft.time = e.target.value; };
    document.getElementById('catat-note').oninput = (e) => { catatDraft.note = e.target.value; };

    document.querySelectorAll('[data-tag]').forEach((b) => {
      b.onclick = () => {
        catatDraft.tag = catatDraft.tag === b.dataset.tag ? '' : b.dataset.tag;
        renderCatat();
      };
    });

    document.getElementById('catat-receipt-input').onchange = (e) => {
      const file = e.target.files?.[0];
      if (file) {
        catatDraft.receiptName = file.name;
        renderCatat();
      }
    };

    document.getElementById('catat-submit').onclick = () => {
      if (!catatDraft.amount || catatDraft.amount <= 0) {
        showToast('Masukkan nominal transaksi lebih dari Rp 0', 'error');
        return;
      }
      const cat = getCategory(catatDraft.categoryId);
      const tx = {
        id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: catatDraft.type,
        amount: catatDraft.amount,
        categoryId: catatDraft.categoryId,
        walletId: catatDraft.walletId,
        note: catatDraft.note.trim() || cat.name,
        tag: catatDraft.tag,
        date: catatDraft.date || toISODate(new Date()),
        time: catatDraft.time || new Date().toTimeString().slice(0, 5),
        receiptName: catatDraft.receiptName || ''
      };
      state.transactions.unshift(tx);
      const wallet = state.wallets.find((w) => w.id === tx.walletId);
      if (wallet) {
        wallet.balance += tx.type === 'income' ? tx.amount : -tx.amount;
      }
      saveState();
      syncCloudAction({ type: 'record_tx', payload: tx });
      catatDraft.amount = 0;
      catatDraft.note = '';
      catatDraft.receiptName = '';
      showToast('Transaksi berhasil disimpan!');
      setActiveTab('beranda');
    };
  }

  function renderBudget() {
    const monthTxs = getMonthTransactions().filter((t) => t.type === 'expense');
    const spentByCat = {};
    for (const tx of monthTxs) {
      spentByCat[tx.categoryId] = (spentByCat[tx.categoryId] || 0) + tx.amount;
    }

    const totalBudget = Object.values(state.budgets).reduce((s, v) => s + (Number(v) || 0), 0);
    const totalSpent = monthTxs.reduce((s, t) => s + t.amount, 0);
    const pct = totalBudget > 0 ? Math.min(100, Math.round((totalSpent / totalBudget) * 100)) : 0;
    const remaining = Math.max(0, totalBudget - totalSpent);

    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysLeft = Math.max(1, daysInMonth - now.getDate() + 1);
    const safeDaily = Math.round(remaining / daysLeft);
    const monthName = now.toLocaleDateString('id-ID', { month: 'long' });

    const totalBalance = getTotalBalance();

    mainEl.innerHTML = `
      <div class="flex flex-col w-full px-margin-mobile pb-space-lg gap-space-lg">
        <div class="flex flex-col gap-space-xs mt-space-xs">
          <div class="inline-flex items-center gap-space-xs text-primary">
            <span class="material-symbols-outlined text-[20px]" style="font-variation-settings: 'FILL' 1;">shield_with_heart</span>
            <span class="font-label-md text-label-md uppercase tracking-wider text-primary">Financial Guard</span>
          </div>
          <h1 class="font-headline-md text-headline-md text-on-surface">Batas Belanja & Manajemen Kas</h1>
          <p class="font-body-md text-body-md text-on-surface-variant">Kendalikan pengeluaran harian agar tetap mindful setiap saat.</p>
        </div>

        <div class="relative overflow-hidden bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md">
          <div class="flex items-center justify-between">
            <div class="flex flex-col">
              <span class="font-label-md text-label-md text-on-surface-variant">Total Anggaran Bulan ${esc(monthName)}</span>
              <div class="flex items-baseline gap-space-xs mt-0.5">
                <span class="font-headline-lg text-headline-lg text-on-surface">Rp ${formatRp(totalSpent)}</span>
                <span class="font-body-sm text-body-sm text-on-surface-variant">/ Rp ${formatRp(totalBudget)}</span>
              </div>
            </div>
            <div class="w-12 h-12 rounded-xl bg-primary-fixed flex items-center justify-center text-on-primary-fixed shadow-sm">
              <span class="material-symbols-outlined text-[26px]">pie_chart</span>
            </div>
          </div>

          <div class="flex flex-col gap-space-xs">
            <div class="w-full h-3 bg-surface-container rounded-full overflow-hidden p-0.5">
              <div class="h-full ${pct >= 90 ? 'bg-secondary' : 'bg-primary'} rounded-full transition-all duration-500" style="width: ${pct}%;"></div>
            </div>
            <div class="flex items-center justify-between font-label-sm text-label-sm text-on-surface-variant pt-0.5">
              <span class="font-bold ${pct >= 90 ? 'text-secondary' : 'text-primary'}">${pct}% terpakai</span>
              <span>Sisa Rp ${formatRp(remaining)} • <strong class="text-on-surface">${daysLeft} hari tersisa</strong></span>
            </div>
          </div>

          <div class="bg-primary/5 rounded-lg p-space-md flex items-center justify-between">
            <div class="flex items-center gap-space-sm">
              <div class="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <span class="material-symbols-outlined text-[20px]">verified_user</span>
              </div>
              <div class="flex flex-col">
                <span class="font-label-sm text-label-sm text-on-surface-variant">Batas Belanja Aman</span>
                <span class="font-headline-sm text-headline-sm text-primary">Rp ${formatRp(safeDaily)} <span class="font-body-sm text-body-sm text-on-surface-variant font-normal">/ hari</span></span>
              </div>
            </div>
          </div>
        </div>

        <div class="flex flex-col gap-space-md">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-space-xs">
              <h2 class="font-headline-sm text-headline-sm text-on-surface">Pos Anggaran Kategori</h2>
            </div>
            <button id="edit-budgets-btn" type="button" class="font-label-md text-label-md text-primary hover:text-primary-container flex items-center gap-0.5 font-semibold">
              <span>Atur Batas</span>
              <span class="material-symbols-outlined text-[16px]">tune</span>
            </button>
          </div>
          <div class="flex flex-col gap-space-sm">
            ${EXPENSE_CATEGORIES.map((cat) => {
              const limit = Number(state.budgets[cat.id]) || 0;
              const spent = spentByCat[cat.id] || 0;
              const cpct = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0;
              const over = spent > limit && limit > 0;
              const statusText = over
                ? 'Melebihi'
                : cpct >= 90
                  ? `${cpct}% Hampir Habis`
                  : cpct >= 75
                    ? `${cpct}% Waspada`
                    : `${cpct}% Aman`;
              const badgeCls = over || cpct >= 90
                ? 'bg-secondary-fixed text-on-secondary-fixed'
                : cpct >= 75
                  ? 'bg-tertiary-fixed text-on-tertiary-fixed'
                  : 'bg-primary/10 text-primary';
              const barCls = over || cpct >= 90
                ? 'bg-secondary-container'
                : cpct >= 75
                  ? 'bg-tertiary-container'
                  : 'bg-primary';
              return `
                <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-sm">
                  <div class="flex items-center justify-between gap-2">
                    <div class="flex items-center gap-space-sm min-w-0">
                      <div class="w-10 h-10 rounded-lg bg-surface-container-low flex items-center justify-center text-primary shrink-0">
                        <span class="material-symbols-outlined text-[22px]">${esc(cat.icon)}</span>
                      </div>
                      <div class="flex flex-col min-w-0">
                        <span class="font-headline-sm text-headline-sm text-on-surface leading-tight truncate">${esc(cat.name)}</span>
                        <span class="font-body-sm text-body-sm text-on-surface-variant">Rp ${formatRp(spent)} dari Rp ${formatRp(limit)}</span>
                      </div>
                    </div>
                    <span class="px-2.5 py-1 rounded-full ${badgeCls} font-label-sm text-label-sm font-bold shrink-0">${statusText}</span>
                  </div>
                  <div class="w-full h-2 bg-surface-container rounded-full overflow-hidden">
                    <div class="h-full ${barCls} rounded-full" style="width: ${cpct}%;"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <div class="flex flex-col gap-space-md">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="font-headline-sm text-headline-sm text-on-surface">Sumber Dana & Saldo Dompet</h2>
              <span class="font-body-sm text-body-sm text-on-surface-variant">Likuiditas siap pakai</span>
            </div>
            <span class="font-headline-sm text-headline-sm text-primary font-bold">Rp ${formatRp(totalBalance)}</span>
          </div>
          <div class="grid grid-cols-1 gap-space-sm">
            ${state.wallets.map((w) => `
              <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex items-center justify-between">
                <div class="flex items-center gap-space-md min-w-0">
                  <div class="w-11 h-11 rounded-xl bg-surface-container-low flex items-center justify-center text-primary shrink-0">
                    <span class="material-symbols-outlined text-[24px]">${esc(w.icon)}</span>
                  </div>
                  <div class="flex flex-col min-w-0">
                    <span class="font-headline-sm text-headline-sm text-on-surface leading-none truncate">${esc(w.name)}</span>
                    <span class="font-body-sm text-body-sm text-on-surface-variant mt-1 truncate">${esc(w.subtitle || 'Dompet Aktif')}</span>
                  </div>
                </div>
                <div class="flex flex-col items-end shrink-0 pl-2">
                  <span class="font-numeric-table text-numeric-table text-on-surface">Rp ${formatRp(w.balance)}</span>
                  <span class="font-label-sm text-label-sm text-primary mt-0.5">${esc(w.badge || 'Aktif')}</span>
                </div>
              </div>
            `).join('')}
            <button id="add-wallet-btn" type="button" class="w-full py-3.5 px-space-md rounded-xl bg-surface-container-low hover:bg-surface-container-high text-primary font-label-lg text-label-lg flex items-center justify-center gap-space-xs transition-colors active:scale-[0.99]">
              <span class="material-symbols-outlined text-[20px]">add_circle</span>
              <span>Tambah Sumber Dana</span>
            </button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('edit-budgets-btn').onclick = () => {
      openModal(`
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-headline-sm text-headline-sm text-on-surface">Atur Batas Anggaran</h3>
          <button id="modal-close-btn" type="button" class="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant">
            <span class="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
        <div class="space-y-3">
          ${EXPENSE_CATEGORIES.map((c) => `
            <div class="flex items-center justify-between gap-3">
              <label class="font-body-sm text-body-sm text-on-surface font-medium flex-1" for="bgt-${esc(c.id)}">${esc(c.name)}</label>
              <input id="bgt-${esc(c.id)}" data-bgt-id="${esc(c.id)}" type="number" min="0" step="50000" value="${Number(state.budgets[c.id]) || 0}" class="w-36 px-3 py-2 rounded-lg bg-surface-container-low text-right font-numeric-table text-on-surface focus:outline-none">
            </div>
          `).join('')}
        </div>
        <button id="save-budgets-btn" type="button" class="mt-5 w-full py-3 rounded-xl bg-primary text-on-primary font-label-md font-bold">Simpan Perubahan</button>
      `);
      document.getElementById('modal-close-btn').onclick = closeModal;
      document.getElementById('save-budgets-btn').onclick = () => {
        document.querySelectorAll('[data-bgt-id]').forEach((inp) => {
          state.budgets[inp.dataset.bgtId] = Math.max(0, Number(inp.value) || 0);
        });
        saveState();
        syncCloudAction({ type: 'upsert_budgets', payload: { ...state.budgets } });
        closeModal();
        showToast('Batas anggaran berhasil diperbarui');
        renderBudget();
      };
    };

    document.getElementById('add-wallet-btn').onclick = () => {
      openModal(`
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-headline-sm text-headline-sm text-on-surface">Tambah Sumber Dana</h3>
          <button id="modal-close-btn" type="button" class="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant">
            <span class="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
        <div class="space-y-3">
          <div>
            <label class="font-label-sm text-label-sm text-on-surface-variant" for="new-w-name">Nama Dompet / Bank</label>
            <input id="new-w-name" type="text" placeholder="Contoh: Bank Mandiri / DANA" class="mt-1 w-full px-3 py-2.5 rounded-lg bg-surface-container-low text-on-surface focus:outline-none">
          </div>
          <div>
            <label class="font-label-sm text-label-sm text-on-surface-variant" for="new-w-sub">Keterangan</label>
            <input id="new-w-sub" type="text" placeholder="Contoh: Tabungan Darurat" class="mt-1 w-full px-3 py-2.5 rounded-lg bg-surface-container-low text-on-surface focus:outline-none">
          </div>
          <div>
            <label class="font-label-sm text-label-sm text-on-surface-variant" for="new-w-bal">Saldo Awal (Rp)</label>
            <input id="new-w-bal" type="number" min="0" value="0" class="mt-1 w-full px-3 py-2.5 rounded-lg bg-surface-container-low text-on-surface focus:outline-none">
          </div>
        </div>
        <button id="save-wallet-btn" type="button" class="mt-5 w-full py-3 rounded-xl bg-primary text-on-primary font-label-md font-bold">Tambah Dompet</button>
      `);
      document.getElementById('modal-close-btn').onclick = closeModal;
      document.getElementById('save-wallet-btn').onclick = () => {
        const name = document.getElementById('new-w-name').value.trim();
        const sub = document.getElementById('new-w-sub').value.trim();
        const bal = Math.max(0, Number(document.getElementById('new-w-bal').value) || 0);
        if (!name) {
          showToast('Nama dompet wajib diisi', 'error');
          return;
        }
        const newWallet = {
          id: `w-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name,
          subtitle: sub || 'Sumber Dana',
          icon: 'account_balance_wallet',
          badge: 'Aktif',
          balance: bal
        };
        state.wallets.push(newWallet);
        saveState();
        syncCloudAction({
          type: 'upsert_wallet',
          payload: { ...newWallet, sortOrder: state.wallets.length - 1 }
        });
        closeModal();
        showToast('Sumber dana baru ditambahkan');
        renderBudget();
      };
    };
  }

  function getReportData() {
    const now = new Date();
    let startISO = '';
    let endISO = '';
    let label = 'Semua Periode';

    if (reportRange === 'weekly') {
      const end = new Date(now);
      end.setDate(end.getDate() + reportOffset * 7);
      const start = new Date(end);
      start.setDate(start.getDate() - 6);
      startISO = toISODate(start);
      endISO = toISODate(end);
      label = `${start.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} - ${end.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    } else if (reportRange === 'monthly') {
      const target = new Date(now.getFullYear(), now.getMonth() + reportOffset, 1);
      const end = new Date(target.getFullYear(), target.getMonth() + 1, 0);
      startISO = toISODate(target);
      endISO = toISODate(end);
      label = target.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    }

    const txs = sortedTransactions().filter((tx) => {
      if (reportRange === 'all') return true;
      return tx.date >= startISO && tx.date <= endISO;
    });

    return { label, txs };
  }

  function triggerFileDownload(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportCSV(txs) {
    const rows = [
      ['Tanggal', 'Jam', 'Tipe', 'Kategori', 'Keterangan', 'Dompet', 'Label', 'Jumlah (Rp)']
    ];
    for (const tx of txs) {
      const cat = getCategory(tx.categoryId);
      const wal = getWallet(tx.walletId);
      rows.push([
        tx.date,
        tx.time,
        tx.type === 'income' ? 'Masuk' : 'Keluar',
        cat.name,
        tx.note || '',
        wal.name,
        tx.tag || '',
        tx.type === 'income' ? tx.amount : -tx.amount
      ]);
    }
    const csv = '\uFEFF' + rows
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const filename = `Finora_Laporan_${toISODate(new Date())}.csv`;
    triggerFileDownload(filename, csv, 'text/csv;charset=utf-8;');
    showToast(`File ${filename} berhasil diunduh!`);
  }

  function exportExcel(txs) {
    const bodyRows = txs.map((tx) => {
      const cat = getCategory(tx.categoryId);
      const wal = getWallet(tx.walletId);
      return `
        <tr>
          <td>${esc(tx.date)}</td>
          <td>${esc(tx.time)}</td>
          <td>${tx.type === 'income' ? 'Masuk' : 'Keluar'}</td>
          <td>${esc(cat.name)}</td>
          <td>${esc(tx.note || '')}</td>
          <td>${esc(wal.name)}</td>
          <td>${esc(tx.tag || '')}</td>
          <td>${tx.type === 'income' ? tx.amount : -tx.amount}</td>
        </tr>
      `;
    }).join('');

    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="UTF-8"></head>
      <body>
        <table border="1">
          <thead>
            <tr>
              <th>Tanggal</th><th>Jam</th><th>Tipe</th><th>Kategori</th>
              <th>Keterangan</th><th>Dompet</th><th>Label</th><th>Jumlah (Rp)</th>
            </tr>
          </thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </body>
      </html>
    `;
    const filename = `Finora_Laporan_${toISODate(new Date())}.xls`;
    triggerFileDownload(filename, html, 'application/vnd.ms-excel;charset=utf-8;');
    showToast(`File ${filename} berhasil diunduh!`);
  }

  function renderLaporan() {
    const { label, txs } = getReportData();
    const totalIn = txs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const totalOut = txs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const net = totalIn - totalOut;

    const expByCat = new Map();
    for (const tx of txs.filter((t) => t.type === 'expense')) {
      expByCat.set(tx.categoryId, (expByCat.get(tx.categoryId) || 0) + tx.amount);
    }
    const breakdown = Array.from(expByCat.entries())
      .map(([catId, amount]) => ({ cat: getCategory(catId), amount }))
      .sort((a, b) => b.amount - a.amount);

    const palette = ['bg-primary', 'bg-tertiary', 'bg-secondary-container', 'bg-outline'];

    mainEl.innerHTML = `
      <div class="flex flex-col w-full pb-space-lg">
        <div class="px-margin-mobile pt-2 pb-2 flex flex-col">
          <div class="flex items-center justify-between">
            <div class="flex flex-col">
              <h1 class="font-headline-sm text-headline-sm text-on-surface tracking-tight">Rekap Transaksi</h1>
              <p class="font-body-sm text-body-sm text-on-surface-variant">Rekapitulasi Uang Masuk & Keluar Lengkap</p>
            </div>
          </div>

          <div class="mt-4 p-1 bg-surface-container rounded-xl flex items-center shadow-sm">
            ${[
              { id: 'weekly', label: 'Mingguan' },
              { id: 'monthly', label: 'Bulanan' },
              { id: 'all', label: 'Semua' }
            ].map((t) => `
              <button data-range="${t.id}" type="button" class="flex-1 py-1.5 px-3 rounded-lg ${reportRange === t.id ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant'} font-label-md text-label-md text-center transition-all">
                ${t.label}
              </button>
            `).join('')}
          </div>

          <div class="mt-3 flex items-center justify-between bg-surface-container-lowest rounded-xl p-2 shadow-sm">
            <button id="report-prev" type="button" ${reportRange === 'all' ? 'disabled' : ''} class="w-9 h-9 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container disabled:opacity-30">
              <span class="material-symbols-outlined text-[20px]">chevron_left</span>
            </button>
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-primary text-[18px]">calendar_today</span>
              <span class="font-label-md text-label-md text-on-surface text-center">${esc(label)}</span>
            </div>
            <button id="report-next" type="button" ${reportRange === 'all' || reportOffset >= 0 ? 'disabled' : ''} class="w-9 h-9 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container disabled:opacity-30">
              <span class="material-symbols-outlined text-[20px]">chevron_right</span>
            </button>
          </div>
        </div>

        <div class="px-margin-mobile mt-3">
          <div class="relative overflow-hidden rounded-xl bg-surface-container-lowest p-space-md shadow-md">
            <div class="flex items-start gap-3">
              <div class="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-on-primary shrink-0 shadow-sm">
                <span class="material-symbols-outlined text-[26px]">table_view</span>
              </div>
              <div class="flex flex-col min-w-0 flex-1">
                <div class="flex items-center gap-1.5">
                  <h2 class="font-headline-sm text-headline-sm text-on-surface truncate">Download Spreadsheet</h2>
                  <span class="px-2 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed font-label-sm text-label-sm">Siap Olah</span>
                </div>
                <p class="font-body-sm text-body-sm text-on-surface-variant mt-1 leading-relaxed">
                  Ekspor ${txs.length} transaksi pada periode terpilih untuk Excel, Numbers, atau Google Sheets.
                </p>
              </div>
            </div>
            <div class="mt-4 flex flex-col gap-2.5">
              <button id="btn-dl-xls" type="button" class="w-full h-12 px-4 rounded-lg bg-primary hover:bg-primary-container active:scale-[0.99] transition-all flex items-center justify-between text-on-primary shadow-sm">
                <div class="flex items-center gap-2.5 min-w-0">
                  <span class="material-symbols-outlined text-[22px]">bar_chart</span>
                  <span class="font-label-lg text-label-lg truncate">Unduh Excel (.XLS)</span>
                </div>
                <span class="px-2 py-0.5 rounded bg-on-primary/20 text-on-primary font-label-sm text-label-sm shrink-0">${txs.length} Baris</span>
              </button>
              <button id="btn-dl-csv" type="button" class="w-full h-12 px-4 rounded-lg bg-surface-container hover:bg-surface-container-high active:scale-[0.99] transition-all flex items-center justify-between text-on-surface shadow-sm">
                <div class="flex items-center gap-2.5 min-w-0">
                  <span class="material-symbols-outlined text-tertiary text-[22px]">description</span>
                  <span class="font-label-lg text-label-lg truncate">Unduh Spreadsheet (.CSV)</span>
                </div>
                <span class="px-2 py-0.5 rounded bg-surface-container-highest text-on-surface-variant font-label-sm text-label-sm shrink-0">UTF-8</span>
              </button>
            </div>
          </div>
        </div>

        <div class="px-margin-mobile mt-4">
          <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <span class="font-label-sm text-label-sm text-on-surface-variant tracking-wider uppercase">Ringkasan Periode Ini</span>
              <span class="font-label-sm text-label-sm font-bold ${net >= 0 ? 'text-primary' : 'text-secondary'}">${net >= 0 ? 'Surplus Sehat' : 'Defisit'}</span>
            </div>
            <div class="grid grid-cols-3 gap-2 pt-1">
              <div class="flex flex-col p-2.5 rounded-lg bg-surface-container-low">
                <span class="font-label-sm text-label-sm text-on-surface-variant">Total Masuk</span>
                <span class="font-numeric-table text-numeric-table text-primary mt-1 truncate">+${formatShortRp(totalIn)}</span>
              </div>
              <div class="flex flex-col p-2.5 rounded-lg bg-surface-container-low">
                <span class="font-label-sm text-label-sm text-on-surface-variant">Total Keluar</span>
                <span class="font-numeric-table text-numeric-table text-secondary mt-1 truncate">-${formatShortRp(totalOut)}</span>
              </div>
              <div class="flex flex-col p-2.5 rounded-lg bg-primary-fixed/30">
                <span class="font-label-sm text-label-sm text-on-primary-fixed-variant">Selisih</span>
                <span class="font-numeric-table text-numeric-table ${net >= 0 ? 'text-primary' : 'text-secondary'} font-bold mt-1 truncate">${net >= 0 ? '+' : '-'}${formatShortRp(net)}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="px-margin-mobile mt-4">
          <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-secondary text-[20px]">pie_chart</span>
                <h3 class="font-headline-sm text-headline-sm text-on-surface">Distribusi Pengeluaran</h3>
              </div>
              <span class="font-label-sm text-label-sm text-on-surface-variant">Total: Rp ${formatRp(totalOut)}</span>
            </div>
            ${breakdown.length === 0 ? `
              <p class="font-body-sm text-body-sm text-on-surface-variant py-2">Belum ada pengeluaran pada periode ini.</p>
            ` : `
              <div class="w-full h-2.5 rounded-full bg-surface-container flex overflow-hidden mb-4">
                ${breakdown.map((b, idx) => {
                  const pct = totalOut > 0 ? Math.max(4, Math.round((b.amount / totalOut) * 100)) : 0;
                  return `<div class="${palette[idx % palette.length]} h-full" style="width: ${pct}%;"></div>`;
                }).join('')}
              </div>
              <div class="flex flex-col gap-3">
                ${breakdown.map((b, idx) => {
                  const pct = totalOut > 0 ? Math.round((b.amount / totalOut) * 100) : 0;
                  const barCol = palette[idx % palette.length];
                  return `
                    <div class="flex flex-col gap-1">
                      <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                          <div class="w-7 h-7 rounded-lg bg-surface-container-low flex items-center justify-center text-on-surface">
                            <span class="material-symbols-outlined text-[16px]">${esc(b.cat.icon)}</span>
                          </div>
                          <span class="font-body-md text-body-md text-on-surface font-medium">${esc(b.cat.name)}</span>
                        </div>
                        <div class="flex items-center gap-2">
                          <span class="font-numeric-table text-numeric-table text-on-surface">Rp ${formatRp(b.amount)}</span>
                          <span class="w-10 text-right font-label-sm text-label-sm text-on-surface-variant font-bold">${pct}%</span>
                        </div>
                      </div>
                      <div class="w-full h-1.5 rounded-full bg-surface-container-low overflow-hidden">
                        <div class="${barCol} h-full rounded-full" style="width: ${pct}%;"></div>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            `}
          </div>
        </div>

        <div class="px-margin-mobile mt-4">
          <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-primary text-[20px]">view_column</span>
                <h3 class="font-headline-sm text-headline-sm text-on-surface">Preview Baris Spreadsheet</h3>
              </div>
              <span class="px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-label-sm text-label-sm">${Math.min(5, txs.length)} dari ${txs.length} Baris</span>
            </div>
            <div class="overflow-x-auto rounded-lg bg-surface-container-low p-1 -mx-1">
              <table class="w-full text-left min-w-[460px]">
                <thead>
                  <tr class="bg-surface-container text-on-surface-variant font-label-sm text-label-sm">
                    <th class="py-2 px-2.5 rounded-l">Tgl</th>
                    <th class="py-2 px-2">Kategori</th>
                    <th class="py-2 px-2">Keterangan</th>
                    <th class="py-2 px-2 text-right">Jumlah</th>
                    <th class="py-2 px-2.5 rounded-r text-center">Dompet</th>
                  </tr>
                </thead>
                <tbody class="font-body-sm text-body-sm text-on-surface">
                  ${txs.slice(0, 5).map((tx) => {
                    const cat = getCategory(tx.categoryId);
                    const wal = getWallet(tx.walletId);
                    const isInc = tx.type === 'income';
                    return `
                      <tr class="border-t border-surface-container/60">
                        <td class="py-2.5 px-2.5 font-numeric-table text-on-surface-variant">${esc(tx.date.slice(5))}</td>
                        <td class="py-2.5 px-2 font-medium">${esc(cat.name)}</td>
                        <td class="py-2.5 px-2 text-on-surface-variant truncate max-w-[130px]">${esc(tx.note)}</td>
                        <td class="py-2.5 px-2 text-right font-numeric-table ${isInc ? 'text-primary' : 'text-secondary'}">${isInc ? '+' : '-'}Rp ${formatRp(tx.amount)}</td>
                        <td class="py-2.5 px-2.5 text-center"><span class="px-1.5 py-0.5 rounded bg-surface-container font-label-sm">${esc(wal.name)}</span></td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;

    document.querySelectorAll('[data-range]').forEach((b) => {
      b.onclick = () => {
        reportRange = b.dataset.range;
        reportOffset = 0;
        renderLaporan();
      };
    });

    document.getElementById('report-prev').onclick = () => {
      reportOffset -= 1;
      renderLaporan();
    };

    document.getElementById('report-next').onclick = () => {
      if (reportOffset < 0) {
        reportOffset += 1;
        renderLaporan();
      }
    };

    document.getElementById('btn-dl-xls').onclick = () => exportExcel(txs);
    document.getElementById('btn-dl-csv').onclick = () => exportCSV(txs);
  }

  // ==================== ACCOUNT SETTINGS MODAL ====================
  function getSyncBadgeMeta() {
    if (syncStatus === 'synced') {
      return { label: 'Cloud Sync', cls: 'bg-primary text-on-primary' };
    }
    if (syncStatus === 'syncing') {
      return { label: 'Menyinkronkan', cls: 'bg-tertiary text-on-tertiary' };
    }
    if (syncStatus === 'local-only') {
      return { label: 'Lokal Saja', cls: 'bg-tertiary-fixed text-on-tertiary-fixed' };
    }
    if (syncStatus === 'schema-missing') {
      return { label: 'Perlu Setup SQL', cls: 'bg-error-container text-on-error-container' };
    }
    return { label: 'Offline Cache', cls: 'bg-surface-container-highest text-on-surface' };
  }

  function openResetDataConfirmModal() {
    if (!state?.pinHash || !state?.pinSalt) {
      openModal(`
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <div class="w-9 h-9 rounded-xl bg-error-container text-on-error-container flex items-center justify-center">
              <span class="material-symbols-outlined text-[20px]">pin</span>
            </div>
            <h3 class="font-headline-sm text-headline-sm text-on-surface">PIN Belum Diatur</h3>
          </div>
          <button id="modal-close-btn" type="button" class="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant">
            <span class="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
        <p class="font-body-sm text-body-sm text-on-surface-variant mb-4">
          Untuk keamanan, fitur <strong>Reset Semua Data ke Nol (Rp 0)</strong> mewajibkan verifikasi <strong>Email Pengguna</strong> dan <strong>PIN 6 digit</strong>. Silakan buat PIN Keamanan Anda terlebih dahulu di menu Pengaturan Akun.
        </p>
        <div class="flex gap-2">
          <button id="reset-go-pin-btn" type="button" class="flex-1 py-2.5 rounded-xl bg-primary text-on-primary font-label-md font-bold">
            Buat PIN Sekarang
          </button>
          <button id="reset-cancel-btn" type="button" class="py-2.5 px-4 rounded-xl bg-surface-container text-on-surface font-label-md font-semibold">
            Batal
          </button>
        </div>
      `);
      document.getElementById('modal-close-btn').onclick = closeModal;
      document.getElementById('reset-cancel-btn').onclick = closeModal;
      document.getElementById('reset-go-pin-btn').onclick = () => {
        openAccountSettingsModal();
        setTimeout(() => {
          const pinInp = document.getElementById('acc-new-pin');
          if (pinInp) {
            pinInp.scrollIntoView({ behavior: 'smooth', block: 'center' });
            pinInp.focus();
          }
        }, 60);
      };
      return;
    }

    openModal(`
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <div class="w-9 h-9 rounded-xl bg-error-container text-on-error-container flex items-center justify-center">
            <span class="material-symbols-outlined text-[20px]">warning</span>
          </div>
          <div>
            <h3 class="font-headline-sm text-headline-sm text-on-surface">Reset Semua Data ke Nol</h3>
            <p class="font-body-sm text-body-sm text-secondary">Tindakan ini tidak dapat dibatalkan</p>
          </div>
        </div>
        <button id="modal-close-btn" type="button" class="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant">
          <span class="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>

      <div class="p-3 rounded-xl bg-error-container/40 text-on-error-container text-body-sm mb-4">
        Seluruh riwayat transaksi, dompet tambahan, dan batas anggaran akan dihapus serta saldo direset menjadi <strong>Rp 0</strong>.
      </div>

      <form id="reset-confirm-form" class="space-y-3" novalidate>
        <div>
          <label class="font-label-sm text-label-sm text-on-surface-variant" for="reset-confirm-email">Email Pengguna</label>
          <input id="reset-confirm-email" type="email" autocomplete="off" placeholder="Ketik email akun Anda" class="mt-1 w-full px-3 py-2.5 rounded-xl bg-surface-container-low text-on-surface font-body-md focus:outline-none focus:ring-2 focus:ring-error/30" required>
        </div>
        <div>
          <label class="font-label-sm text-label-sm text-on-surface-variant" for="reset-confirm-pin">PIN Keamanan (6 digit)</label>
          <input id="reset-confirm-pin" type="password" inputmode="numeric" maxlength="6" autocomplete="off" placeholder="••••••" class="mt-1 w-full px-3 py-2.5 rounded-xl bg-surface-container-low text-on-surface font-numeric-table tracking-widest focus:outline-none focus:ring-2 focus:ring-error/30" required>
        </div>
        <div class="flex gap-2 pt-1">
          <button id="reset-cancel-btn" type="button" class="py-2.5 px-4 rounded-xl bg-surface-container text-on-surface font-label-md font-semibold">
            Batal
          </button>
          <button type="submit" class="flex-1 py-2.5 rounded-xl bg-error text-on-error font-label-md font-bold flex items-center justify-center gap-1.5">
            <span class="material-symbols-outlined text-[18px]">delete_forever</span>
            <span>Reset ke Nol (Rp 0)</span>
          </button>
        </div>
      </form>
    `);

    document.getElementById('modal-close-btn').onclick = closeModal;
    document.getElementById('reset-cancel-btn').onclick = closeModal;
    document.getElementById('reset-confirm-form').onsubmit = async (e) => {
      e.preventDefault();
      const emailInput = normalizeEmail(document.getElementById('reset-confirm-email').value);
      const pinInput = String(document.getElementById('reset-confirm-pin').value || '').trim();

      if (!emailInput || emailInput !== normalizeEmail(currentEmail)) {
        showToast('Email pengguna tidak sesuai dengan akun aktif', 'error');
        return;
      }
      if (!/^\d{6}$/.test(pinInput)) {
        showToast('PIN harus terdiri dari 6 digit angka', 'error');
        return;
      }
      const attemptPinHash = await hashPassword(pinInput, state.pinSalt);
      if (attemptPinHash !== state.pinHash) {
        showToast('PIN keamanan salah. Reset data dibatalkan.', 'error');
        return;
      }

      state = createEmptyUserData(state.userName, {
        pinSalt: state.pinSalt,
        pinHash: state.pinHash
      });
      saveState();
      syncCloudAction({ type: 'reset_data' });
      closeModal();
      showToast('Semua data berhasil direset ke nol (Rp 0)');
      render();
    };
  }

  function openAccountSettingsModal() {
    const acc = vault.accounts[currentEmail];
    const initial = (state.userName || currentEmail || 'U').trim().charAt(0).toUpperCase();
    const installed = isAppInstalled();
    const badge = getSyncBadgeMeta();
    const hasPin = Boolean(state.pinHash && state.pinSalt);

    openModal(`
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-headline-sm text-headline-sm text-on-surface">Pengaturan Akun</h3>
        <button id="modal-close-btn" type="button" class="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant">
          <span class="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>

      <!-- Connected Email Banner -->
      <div class="p-3.5 rounded-xl bg-primary-fixed/30 flex items-center gap-3 mb-4">
        <div class="w-11 h-11 rounded-full bg-primary text-on-primary font-headline-sm font-bold flex items-center justify-center shrink-0">
          ${esc(initial)}
        </div>
        <div class="min-w-0 flex-1">
          <p class="font-label-lg text-on-surface font-bold truncate">${esc(state.userName)}</p>
          <p class="font-body-sm text-on-primary-fixed-variant truncate flex items-center gap-1">
            <span class="material-symbols-outlined text-[14px]">mail</span>
            <span>${esc(currentEmail)}</span>
          </p>
        </div>
        <span class="px-2 py-0.5 rounded-full ${badge.cls} font-label-sm text-[10px] font-bold shrink-0">${esc(badge.label)}</span>
      </div>

      <div class="space-y-4">
        <!-- Cloud Sync Action -->
        <button id="acc-sync-now" type="button" class="w-full py-2.5 px-3 rounded-xl bg-primary-fixed/40 text-on-primary-fixed font-label-sm font-bold flex items-center justify-center gap-1.5 hover:opacity-90">
          <span class="material-symbols-outlined text-[18px]">cloud_sync</span>
          <span>${cloudUser ? 'Sinkronkan Data Cloud Sekarang' : 'Hubungkan Akun ke Cloud (Sync HP)'}</span>
        </button>

        <!-- Edit Display Name -->
        <div class="space-y-1.5">
          <label class="font-label-sm text-label-sm text-on-surface-variant" for="acc-name">Nama Panggilan</label>
          <div class="flex gap-2">
            <input id="acc-name" type="text" value="${esc(state.userName)}" class="flex-1 px-3 py-2 rounded-lg bg-surface-container-low text-on-surface focus:outline-none">
            <button id="acc-save-name" type="button" class="px-3.5 py-2 rounded-lg bg-primary text-on-primary font-label-sm font-bold">Simpan</button>
          </div>
        </div>

        <!-- Security PIN (6 Digit) -->
        <div class="p-3 rounded-xl bg-surface-container-low space-y-2">
          <div class="flex items-center justify-between">
            <p class="font-label-md text-on-surface font-semibold flex items-center gap-1.5">
              <span class="material-symbols-outlined text-[17px] text-primary">pin</span>
              <span>PIN Keamanan (6 Digit)</span>
            </p>
            <span class="px-2 py-0.5 rounded-full ${hasPin ? 'bg-primary/10 text-primary' : 'bg-surface-container-highest text-on-surface-variant'} font-label-sm text-[10px] font-bold">
              ${hasPin ? 'PIN Aktif' : 'Belum Diatur'}
            </span>
          </div>
          ${hasPin ? `
            <input id="acc-old-pin" type="password" inputmode="numeric" maxlength="6" placeholder="PIN saat ini (6 digit)" class="w-full px-3 py-2 rounded-lg bg-surface-container-lowest text-on-surface text-body-sm tracking-widest focus:outline-none">
            <input id="acc-new-pin" type="password" inputmode="numeric" maxlength="6" placeholder="PIN baru (6 digit angka)" class="w-full px-3 py-2 rounded-lg bg-surface-container-lowest text-on-surface text-body-sm tracking-widest focus:outline-none">
          ` : `
            <input id="acc-new-pin" type="password" inputmode="numeric" maxlength="6" placeholder="Buat PIN 6 digit angka" class="w-full px-3 py-2 rounded-lg bg-surface-container-lowest text-on-surface text-body-sm tracking-widest focus:outline-none">
            <input id="acc-confirm-pin" type="password" inputmode="numeric" maxlength="6" placeholder="Ulangi PIN 6 digit" class="w-full px-3 py-2 rounded-lg bg-surface-container-lowest text-on-surface text-body-sm tracking-widest focus:outline-none">
          `}
          <button id="acc-save-pin" type="button" class="w-full py-2 rounded-lg bg-surface-container-highest text-on-surface font-label-sm font-bold hover:opacity-90">
            ${hasPin ? 'Ubah PIN Keamanan' : 'Simpan PIN Keamanan'}
          </button>
        </div>

        <!-- Change Password -->
        <div class="p-3 rounded-xl bg-surface-container-low space-y-2">
          <p class="font-label-md text-on-surface font-semibold flex items-center gap-1.5">
            <span class="material-symbols-outlined text-[17px] text-primary">lock</span>
            <span>Keamanan Password</span>
          </p>
          <input id="acc-old-pw" type="password" placeholder="Password saat ini" class="w-full px-3 py-2 rounded-lg bg-surface-container-lowest text-on-surface text-body-sm focus:outline-none">
          <input id="acc-new-pw" type="password" placeholder="Password baru (min. 6 karakter)" class="w-full px-3 py-2 rounded-lg bg-surface-container-lowest text-on-surface text-body-sm focus:outline-none">
          <button id="acc-save-pw" type="button" class="w-full py-2 rounded-lg bg-surface-container-highest text-on-surface font-label-sm font-bold hover:opacity-90">
            Ubah Password
          </button>
        </div>

        <!-- Backup & Restore -->
        <div class="space-y-2">
          <p class="font-label-sm text-label-sm text-on-surface-variant">Cadangan Data Email (${state.transactions.length} transaksi)</p>
          <div class="grid grid-cols-2 gap-2">
            <button id="acc-export-backup" type="button" class="py-2.5 px-3 rounded-xl bg-surface-container text-on-surface font-label-sm font-bold flex items-center justify-center gap-1">
              <span class="material-symbols-outlined text-[17px]">download</span>
              <span>Backup JSON</span>
            </button>
            <button id="acc-import-backup" type="button" class="py-2.5 px-3 rounded-xl bg-surface-container text-on-surface font-label-sm font-bold flex items-center justify-center gap-1">
              <span class="material-symbols-outlined text-[17px]">upload</span>
              <span>Pulihkan JSON</span>
            </button>
          </div>
        </div>

        ${!installed ? `
          <button id="acc-install-btn" type="button" class="w-full py-2.5 rounded-xl bg-primary-fixed/50 text-on-primary-fixed font-label-md font-bold flex items-center justify-center gap-1.5">
            <span class="material-symbols-outlined text-[18px]">install_mobile</span>
            <span>Pasang Aplikasi di HP</span>
          </button>
        ` : ''}

        <button id="acc-clear-data" type="button" class="w-full py-2.5 px-3 rounded-xl bg-surface-container-low text-secondary font-label-sm font-semibold">Reset Semua Data ke Nol (Rp 0)</button>

        <!-- Logout -->
        <button id="acc-logout-btn" type="button" class="w-full py-3 rounded-xl bg-error-container text-on-error-container font-label-md font-bold flex items-center justify-center gap-2 hover:opacity-90">
          <span class="material-symbols-outlined text-[19px]">logout</span>
          <span>Keluar / Ganti Akun</span>
        </button>
      </div>
      ${acc ? `<p class="text-center font-label-sm text-outline mt-3">Terdaftar sejak ${esc(new Date(acc.createdAt).toLocaleDateString('id-ID'))}</p>` : ''}
    `);

    document.getElementById('modal-close-btn').onclick = closeModal;

    document.getElementById('acc-sync-now').onclick = async () => {
      if (!cloudUser) {
        closeModal();
        openLinkCloudModal();
        return;
      }
      closeModal();
      await refreshFromCloud({ silent: false });
    };

    document.getElementById('acc-save-name').onclick = () => {
      const val = document.getElementById('acc-name').value.trim();
      if (!val) {
        showToast('Nama tidak boleh kosong', 'error');
        return;
      }
      state.userName = val;
      saveState();
      syncCloudAction({
        type: 'update_profile',
        payload: { userName: state.userName, hideBalance: state.hideBalance }
      });
      showToast('Nama akun diperbarui');
      closeModal();
      render();
    };

    document.getElementById('acc-save-pin').onclick = async () => {
      const newPin = String(document.getElementById('acc-new-pin').value || '').trim();
      if (hasPin) {
        const oldPin = String(document.getElementById('acc-old-pin')?.value || '').trim();
        if (!/^\d{6}$/.test(oldPin)) {
          showToast('Masukkan PIN saat ini (6 digit angka)', 'error');
          return;
        }
        const oldPinHash = await hashPassword(oldPin, state.pinSalt);
        if (oldPinHash !== state.pinHash) {
          showToast('PIN saat ini salah', 'error');
          return;
        }
      } else {
        const confirmPin = String(document.getElementById('acc-confirm-pin')?.value || '').trim();
        if (newPin !== confirmPin) {
          showToast('Konfirmasi PIN tidak cocok', 'error');
          return;
        }
      }

      if (!/^\d{6}$/.test(newPin)) {
        showToast('PIN harus 6 digit angka', 'error');
        return;
      }

      const savePinBtn = document.getElementById('acc-save-pin');
      if (savePinBtn) {
        savePinBtn.disabled = true;
        savePinBtn.textContent = 'Menyimpan...';
      }

      const pinSalt = generateSalt();
      const pinHash = await hashPassword(newPin, pinSalt);
      state.pinSalt = pinSalt;
      state.pinHash = pinHash;
      saveState();

      if (sb) {
        try {
          const { data: upData, error: upErr } = await sb.auth.updateUser({
            data: {
              pin_salt: pinSalt,
              pin_hash: pinHash
            }
          });
          if (upData?.user) cloudUser = upData.user;
          if (upErr) console.warn('Update user metadata pin error:', upErr);
        } catch (e) {
          console.warn('Update user metadata pin failed:', e);
        }

        if (cloudUser?.id) {
          sb.from('profiles').update({
            pin_salt: pinSalt,
            pin_hash: pinHash
          }).eq('id', cloudUser.id).then(() => {}).catch(() => {});
        }

        if (realtimeChannel) {
          realtimeChannel.send({
            type: 'broadcast',
            event: 'pin_updated',
            payload: { pinSalt, pinHash }
          }).catch(() => {});
        }
      }

      syncCloudAction({
        type: 'update_pin',
        payload: { pinSalt, pinHash }
      });
      showToast(hasPin ? 'PIN keamanan berhasil diubah & tersinkron ke semua perangkat' : 'PIN keamanan berhasil dibuat & tersinkron ke semua perangkat');
      openAccountSettingsModal();
    };

    document.getElementById('acc-save-pw').onclick = async () => {
      const oldPw = document.getElementById('acc-old-pw').value;
      const newPw = document.getElementById('acc-new-pw').value;
      if (newPw.length < 6) {
        showToast('Password baru minimal 6 karakter', 'error');
        return;
      }

      if (sb && cloudUser) {
        if (!oldPw) {
          showToast('Masukkan password saat ini', 'error');
          return;
        }
        const verifyRes = await sb.auth.signInWithPassword({ email: currentEmail, password: oldPw });
        if (verifyRes.error) {
          showToast('Password saat ini salah', 'error');
          return;
        }
        const { error } = await sb.auth.updateUser({ password: newPw });
        if (error) {
          showToast(mapAuthErrorMessage(error), 'error');
          return;
        }
        showToast('Password akun Cloud berhasil diubah');
        closeModal();
        return;
      }

      const account = vault.accounts[currentEmail];
      if (!account) return;
      const oldHash = await hashPassword(oldPw, account.salt);
      if (oldHash !== account.passwordHash) {
        showToast('Password saat ini salah', 'error');
        return;
      }
      const newSalt = generateSalt();
      account.salt = newSalt;
      account.passwordHash = await hashPassword(newPw, newSalt);
      saveVault();
      showToast('Password berhasil diubah');
      closeModal();
    };

    document.getElementById('acc-export-backup').onclick = exportAccountBackup;
    document.getElementById('acc-import-backup').onclick = () => {
      closeModal();
      openRestoreBackupModal(false);
    };

    const accInstallBtn = document.getElementById('acc-install-btn');
    if (accInstallBtn) {
      accInstallBtn.onclick = () => {
        closeModal();
        triggerInstall();
      };
    }

    document.getElementById('acc-clear-data').onclick = openResetDataConfirmModal;

    document.getElementById('acc-logout-btn').onclick = async () => {
      saveState();
      if (sb) {
        await sb.auth.signOut().catch(() => {});
      }
      clearActiveSession();
      state = null;
      syncStatus = 'idle';
      closeModal();
      authMode = 'login';
      showToast('Anda telah keluar. Data akun tetap tersimpan aman di Cloud.');
      render();
    };
  }

  function render() {
    if (isBootstrapping || !currentEmail || !state) {
      renderAuthScreen();
      return;
    }
    authScreenEl.classList.add('hidden');
    appShellEl.classList.remove('hidden');

    updateNavChrome();
    if (activeTab === 'beranda') renderBeranda();
    else if (activeTab === 'mutasi') renderMutasi();
    else if (activeTab === 'catat') renderCatat();
    else if (activeTab === 'budget') renderBudget();
    else if (activeTab === 'laporan') renderLaporan();
  }

  document.getElementById('header-brand-btn').onclick = () => setActiveTab('beranda');
  headerInstallBtn.onclick = triggerInstall;
  document.getElementById('btn-profile').onclick = openAccountSettingsModal;

  document.getElementById('btn-notif').onclick = () => {
    document.getElementById('notif-dot').classList.add('hidden');
    const syncText = syncStatus === 'synced'
      ? 'Sinkronisasi Cloud aktif — data di MacBook dan HP otomatis mengikuti.'
      : syncStatus === 'local-only'
        ? 'Akun masih lokal. Klik "Hubungkan" di Beranda agar data sinkron ke HP.'
        : syncStatus === 'schema-missing'
          ? 'Tabel Supabase belum disiapkan. Jalankan supabase/schema.sql di SQL Editor.'
          : 'Mode offline aktif — perubahan akan disinkronkan saat koneksi kembali.';

    openModal(`
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-headline-sm text-headline-sm text-on-surface">Notifikasi Finora</h3>
        <button id="modal-close-btn" type="button" class="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant">
          <span class="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>
      <div class="space-y-2.5 text-body-sm">
        <div class="p-3 rounded-xl bg-primary-fixed/30">
          <p class="font-semibold text-on-surface">Terhubung ke ${esc(currentEmail)}</p>
          <p class="text-on-surface-variant mt-0.5">${esc(syncText)}</p>
        </div>
        <div class="p-3 rounded-xl bg-surface-container-low">
          <p class="font-semibold text-on-surface">Tips Keamanan & Backup</p>
          <p class="text-on-surface-variant mt-0.5">Anda tetap dapat mengunduh Backup JSON kapan saja melalui menu Pengaturan Akun.</p>
        </div>
      </div>
    `);
    document.getElementById('modal-close-btn').onclick = closeModal;
  };

  document.querySelectorAll('.nav-tab').forEach((btn) => {
    btn.onclick = () => setActiveTab(btn.dataset.tab);
  });

  window.addEventListener('hashchange', () => {
    activeTab = getInitialTab();
    render();
  });

  window.addEventListener('online', () => {
    if (cloudUser) refreshFromCloud({ silent: true });
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && cloudUser) {
      refreshFromCloud({ silent: true });
    }
  });

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    localStorage.removeItem(INSTALLED_KEY);
    deferredInstallPrompt = e;
    updateInstallButtonVisibility();
    render();
  });

  window.addEventListener('appinstalled', () => {
    localStorage.setItem(INSTALLED_KEY, '1');
    deferredInstallPrompt = null;
    updateInstallButtonVisibility();
    showToast('Finora berhasil dipasang!');
    render();
  });

  if (navigator.getInstalledRelatedApps) {
    navigator.getInstalledRelatedApps().then((apps) => {
      if (apps && apps.length > 0) {
        localStorage.setItem(INSTALLED_KEY, '1');
        updateInstallButtonVisibility();
        render();
      }
    }).catch(() => {});
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }

  async function bootstrapApp() {
    updateInstallButtonVisibility();
    render();

    if (!sb) {
      isBootstrapping = false;
      if (currentEmail && state) syncStatus = 'offline';
      render();
      return;
    }

    try {
      const { data } = await sb.auth.getSession();
      const sessionUser = data?.session?.user || null;

      if (sessionUser) {
        await hydrateSession(sessionUser, { remember: true, silent: true });
      } else if (currentEmail && state) {
        // Existing local MacBook account without cloud session yet
        syncStatus = 'local-only';
      }
    } catch {
      if (currentEmail && state) syncStatus = 'offline';
    } finally {
      isBootstrapping = false;
      render();
    }

    sb.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        if (session?.user) {
          await hydrateSession(session.user, { remember: true, silent: true });
          render();
        }
        openNewPasswordModal();
        return;
      }

      if (event === 'SIGNED_IN' && session?.user) {
        const nextEmail = normalizeEmail(session.user.email);
        if (!cloudUser || normalizeEmail(cloudUser.email) !== nextEmail) {
          await hydrateSession(session.user, { remember: true, silent: true });
          render();
        }
        return;
      }

      if (event === 'SIGNED_OUT') {
        if (cloudUser) {
          clearActiveSession();
          state = null;
          syncStatus = 'idle';
          render();
        }
      }
    });
  }

  bootstrapApp();
})();
