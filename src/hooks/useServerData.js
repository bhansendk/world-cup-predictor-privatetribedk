import { useState, useEffect, useCallback, useRef } from 'react';

const ADMIN_STORAGE_KEY = 'vm2026_admin_password';

async function parseApiResponse(res) {
  const raw = await res.text();
  try {
    const json = raw ? JSON.parse(raw) : {};
    return { ok: res.ok, status: res.status, data: json };
  } catch {
    return {
      ok: res.ok,
      status: res.status,
      data: null,
      parseError: raw || 'Tomt svar fra server'
    };
  }
}

function buildApiError(parsed, fallback) {
  if (parsed?.data?.error) return parsed.data.error;
  if (parsed?.parseError) {
    const short = parsed.parseError.slice(0, 120);
    return `Serverfejl (${parsed.status}): ${short}`;
  }
  return fallback;
}

export default function useServerData() {
  const [serverData, setServerData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState(null);
  const [adminPassword, setAdminPassword] = useState(() => {
    try {
      return localStorage.getItem(ADMIN_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });
  const pollRef = useRef(null);
  const isAdmin = !!adminPassword;

  useEffect(() => {
    const onStorage = (event) => {
      if (event.key !== ADMIN_STORAGE_KEY) return;
      setAdminPassword(event.newValue || '');
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const query = adminPassword ? `?password=${encodeURIComponent(adminPassword)}` : '';
      const res = await fetch('/api/data' + query);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setServerData(data);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, [adminPassword]);

  useEffect(() => {
    fetchData();
    pollRef.current = setInterval(fetchData, 30000);
    return () => clearInterval(pollRef.current);
  }, [fetchData]);

  const submitPrediction = useCallback(async (name, mode, prediction, editCode = '', adminPassword = '') => {
    setLoading(true);
    try {
      const res = await fetch('/api/data?action=submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, mode, prediction, editCode, adminPassword })
      });
      const parsed = await parseApiResponse(res);
      if (!parsed.ok) throw new Error(buildApiError(parsed, 'Fejl ved indsendelse'));
      await fetchData();
      return {
        ok: true,
        editCode: parsed?.data?.editCode || '',
        codeGenerated: !!parsed?.data?.codeGenerated
      };
    } catch (e) {
      return { ok: false, error: e.message };
    } finally {
      setLoading(false);
    }
  }, [fetchData]);

  const fetchMyPrediction = useCallback(async (name, editCode) => {
    setLoading(true);
    try {
      const res = await fetch('/api/data?action=mine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, editCode })
      });
      const parsed = await parseApiResponse(res);
      if (!parsed.ok) throw new Error(buildApiError(parsed, 'Kunne ikke hente forudsigelse'));
      return { ok: true, entry: parsed?.data?.entry || null };
    } catch (e) {
      return { ok: false, error: e.message };
    } finally {
      setLoading(false);
    }
  }, []);

  const adminUpdateResults = useCallback(async (results, password) => {
    setLoading(true);
    try {
      const res = await fetch('/api/data?action=results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results, password })
      });
      const parsed = await parseApiResponse(res);
      if (!parsed.ok) throw new Error(buildApiError(parsed, 'Forkert kode'));
      await fetchData();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    } finally {
      setLoading(false);
    }
  }, [fetchData]);

  const adminImportPrediction = useCallback(async (name, mode, prediction, password) => {
    setLoading(true);
    try {
      const res = await fetch('/api/data?action=adminImport', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, mode, prediction, password })
      });
      const parsed = await parseApiResponse(res);
      if (!parsed.ok) throw new Error(buildApiError(parsed, 'Import fejlede'));
      await fetchData();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    } finally {
      setLoading(false);
    }
  }, [fetchData]);

  const adminVerifyPassword = useCallback(async (password) => {
    setLoading(true);
    try {
      const res = await fetch('/api/data?action=verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const parsed = await parseApiResponse(res);
      if (!parsed.ok) throw new Error(buildApiError(parsed, 'Forkert kode'));
      setAdminPassword(password);
      try {
        localStorage.setItem(ADMIN_STORAGE_KEY, password);
      } catch {}
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    } finally {
      setLoading(false);
    }
  }, []);

  const adminLogout = useCallback(() => {
    setAdminPassword('');
    try {
      localStorage.removeItem(ADMIN_STORAGE_KEY);
    } catch {}
  }, []);

  const adminDeleteOne = useCallback(async (name, password) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/data?name=${encodeURIComponent(name)}&password=${encodeURIComponent(password)}`, { method: 'DELETE' });
      const parsed = await parseApiResponse(res);
      if (!parsed.ok) throw new Error(buildApiError(parsed, 'Forkert kode'));
      setServerData(prev => {
        if (!prev) return prev;
        const current = Array.isArray(prev.colleagues) ? prev.colleagues : [];
        return { ...prev, colleagues: current.filter(c => c.name !== name) };
      });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    } finally {
      setLoading(false);
    }
  }, [fetchData]);

  const adminClearAll = useCallback(async (password) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/data?action=clearAll&password=${encodeURIComponent(password)}`, { method: 'DELETE' });
      const parsed = await parseApiResponse(res);
      if (!parsed.ok) throw new Error(buildApiError(parsed, 'Forkert kode'));
      setServerData(prev => {
        if (!prev) return prev;
        return { ...prev, colleagues: [] };
      });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    } finally {
      setLoading(false);
    }
  }, [fetchData]);

  return {
    serverData, loading, error, fetchData,
    submitPrediction, fetchMyPrediction,
    adminUpdateResults, adminImportPrediction, adminDeleteOne, adminClearAll, adminVerifyPassword,
    adminLogout, isAdmin, adminPassword
  };
}
