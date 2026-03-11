'use client';

import { useState, useEffect } from 'react';

const UID_KEY     = 'mtg_uid';
const NAME_KEY    = 'mtg_name';
const COMPANY_KEY = 'mtg_company';

export function useUserId(): {
  userId:         string;
  userName:       string | null;
  companyName:    string;
  setUserName:    (name: string) => void;
  setCompanyName: (company: string) => void;
} {
  const [userId,      setUserId]        = useState<string>('');
  const [userName,    setUserNameState] = useState<string | null>(null);
  const [companyName, setCompanyState]  = useState<string>('');

  useEffect(() => {
    let uid = localStorage.getItem(UID_KEY);
    if (!uid) {
      uid = crypto.randomUUID();
      localStorage.setItem(UID_KEY, uid);
    }
    setUserId(uid);
    setUserNameState(localStorage.getItem(NAME_KEY));
    setCompanyState(localStorage.getItem(COMPANY_KEY) ?? '');
  }, []);

  const setCompanyName = (company: string) => {
    localStorage.setItem(COMPANY_KEY, company);
    setCompanyState(company);
    const uid  = localStorage.getItem(UID_KEY);
    const name = localStorage.getItem(NAME_KEY);
    if (uid && name) {
      fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: uid, userName: name, companyName: company }),
      }).catch(() => {});
    }
  };

  const setUserName = (name: string) => {
    localStorage.setItem(NAME_KEY, name);
    setUserNameState(name);
    const uid     = localStorage.getItem(UID_KEY);
    const company = localStorage.getItem(COMPANY_KEY) ?? '';
    if (uid) {
      fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: uid, userName: name, companyName: company }),
      }).catch(() => {});
    }
  };

  return { userId, userName, companyName, setUserName, setCompanyName };
}
