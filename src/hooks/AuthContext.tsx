import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { loginDoctor, logoutDoctor, getCurrentDoctor } from '../services/authService';
import { Doctor } from '../types';
export type AuthContextType = {
  user: Doctor | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<Doctor | null>;
  logout: () => Promise<void>;
};
const AuthContext = createContext<AuthContextType | undefined>(undefined);
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Doctor | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setIsLoading(true);
      try {
        if (firebaseUser) {
          const doctor = await getCurrentDoctor(firebaseUser);
          setUser(doctor);
        } else {
          setUser(null);
        }
      } catch (err) {
        ;
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);
  const login = async (email: string, password: string): Promise<Doctor | null> => {
    setIsLoading(true);
    try {
      const doctor = await loginDoctor(email, password);
      setUser(doctor);
      return doctor;
    } finally {
      setIsLoading(false);
    }
  };
  const logout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await logoutDoctor();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
