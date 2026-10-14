import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, type User } from './api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  activeStoreId: string;
  setActiveStoreId: (storeId: string) => void;
  login: (email: string, pass: string, totp?: string) => Promise<{ mfaRequired?: boolean }>;
  loginWithSso: (provider: 'okta' | 'auth0', targetEmail?: string) => Promise<void>;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
  hasRole: (...roles: string[]) => boolean;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeStoreId, setActiveStoreId] = useState<string>(() => {
    return localStorage.getItem('rp_active_store') || 'LOC-001';
  });

  useEffect(() => {
    const token = api.getToken();
    if (token) {
      api.getMe()
        .then(u => {
          setUser(u);
          if (u.storeId && u.storeId !== 'ALL') {
            setActiveStoreId(u.storeId);
          }
        })
        .catch(() => {
          api.setToken(null);
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const handleSetActiveStore = (storeId: string) => {
    setActiveStoreId(storeId);
    localStorage.setItem('rp_active_store', storeId);
  };

  const login = async (email: string, pass: string, totp?: string) => {
    const res = await api.login(email, pass, totp);
    if (res.mfaRequired) {
      return { mfaRequired: true };
    }

    if (res.token && res.user) {
      api.setToken(res.token);
      setUser(res.user);
      if (res.user.storeId && res.user.storeId !== 'ALL') {
        handleSetActiveStore(res.user.storeId);
      }
    }
    return { mfaRequired: false };
  };

  const loginWithSso = async (provider: 'okta' | 'auth0', targetEmail?: string) => {
    const authRes = await api.oauthAuthorize(provider, targetEmail);
    const tokenRes = await api.exchangeOauthCode(authRes.code, authRes.redirect_uri);
    api.setToken(tokenRes.access_token);
    const profile = await api.getMe();
    setUser(profile);
    if (profile.storeId && profile.storeId !== 'ALL') {
      handleSetActiveStore(profile.storeId);
    }
  };

  const logout = () => {
    api.setToken(null);
    setUser(null);
  };

  const hasPermission = (perm: string): boolean => {
    if (!user) return false;
    if (user.role === 'super_admin' || user.permissions.includes('*')) return true;
    return user.permissions.includes(perm);
  };

  const hasRole = (...roles: string[]): boolean => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        activeStoreId,
        setActiveStoreId: handleSetActiveStore,
        login,
        loginWithSso,
        logout,
        hasPermission,
        hasRole
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
