'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { 
  LayoutDashboard, 
  LineChart, 
  BrainCircuit, 
  PhoneCall, 
  AlertTriangle,
  Settings,
  BookOpen,
  LogOut,
  ChevronLeft,
  ChevronRight,
  User as UserIcon,
  Bot,
  Menu,
  ClipboardList,
  Sun,
  Moon
} from 'lucide-react';
import { auth } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { logoutUser } from '../lib/auth';
import SegmentToggle from './SegmentToggle';
import styles from './Sidebar.module.css';

export default function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const segment = searchParams.get('segment') || 'dealer';

  const [isOpen, setIsOpen] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [userEmail, setUserEmail] = useState(null);
  const [userRole, setUserRole] = useState('viewer');
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || document.documentElement.getAttribute('data-theme') || 'dark';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);

    const handleThemeChange = () => {
      setTheme(localStorage.getItem('theme') || 'dark');
    };
    window.addEventListener('themechange', handleThemeChange);
    return () => window.removeEventListener('themechange', handleThemeChange);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('theme', nextTheme);
    document.cookie = `theme=${nextTheme}; path=/; max-age=31536000; SameSite=Lax`;
    window.dispatchEvent(new Event('themechange'));
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserEmail(user.email);
        try {
          const res = await fetch('/api/auth/session');
          if (res.ok) {
            const data = await res.json();
            if (data.user && data.user.role) {
              setUserRole(data.user.role);
            }
          }
        } catch (e) {
          console.error("Failed to fetch user role:", e);
        }
      } else {
        setUserEmail(null);
        setUserRole('viewer');
      }
    });
    return () => unsubscribe();
  }, []);

  if (pathname === '/login' || pathname === '/access-denied' || pathname === '/about') {
    return null;
  }

  const handleLogout = async () => {
    await logoutUser();
    window.location.href = '/login';
  };

  const navItems = [
    { href: '/', label: 'Operations Hub', icon: LayoutDashboard },
    { href: '/intelligence', label: 'Business Intelligence', icon: LineChart },
    { href: '/predictive-ai', label: 'Predictive AI', icon: BrainCircuit },
    { href: '/proactive', label: 'Proactive Calling', icon: PhoneCall },
    { href: '/risk', label: 'Risk & Churn', icon: AlertTriangle },
    { href: '/gemini-ai', label: 'Gemini AI', icon: Bot },
    { href: '/admin', label: 'Admin Logs', icon: ClipboardList },
    { href: '/settings', label: 'Settings', icon: Settings },
    { href: '/logic', label: 'Logic', icon: BookOpen },
  ];


  return (
    <>
      {/* Mobile Header */}
      <div className={styles.mobileHeader}>
        <div className="gradient-text" style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>AGY</div>
        <button onClick={() => setIsMobileOpen(true)} style={{ color: '#fff', padding: '8px' }}>
          <Menu size={24} />
        </button>
      </div>

      {/* Mobile Overlay */}
      <div 
        className={`${styles.overlay} ${isMobileOpen ? styles.open : ''}`} 
        onClick={() => setIsMobileOpen(false)}
      />

      <aside className={`${styles.sidebar} ${isMobileOpen ? styles.open : ''}`} style={{ width: isOpen ? '260px' : '80px' }}>
        {/* Header / Brand */}
        <div className={styles.headerBrand} style={{ padding: isOpen ? '0 24px' : '0 0', justifyContent: isOpen ? 'flex-start' : 'center' }}>
          {isOpen ? (
            <div className="gradient-text" style={{ fontSize: '1.25rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Antigravity AGY</div>
          ) : (
            <div className="gradient-text" style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>AGY</div>
          )}
        </div>

        {/* Toggle Button (Desktop only) */}
        <button 
          className={styles.toggleBtn}
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>

        {/* Navigation Links */}
        <nav className={styles.navMenu}>
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link 
                key={item.href} 
                href={`${item.href}?segment=${segment}`}
                className={styles.navLink}
                style={{
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  backgroundColor: isActive ? 'var(--surface-hover)' : 'transparent',
                  justifyContent: isOpen ? 'flex-start' : 'center',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'var(--surface-hover)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }
                }}
                onClick={() => setIsMobileOpen(false)}
              >
                <Icon size={20} style={{ minWidth: '20px' }} />
                {isOpen && <span style={{ fontSize: '0.9rem', fontWeight: 500, whiteSpace: 'nowrap' }}>{item.label}</span>}
              </Link>
            );
          })}

          {isOpen && (
            <div style={{ marginTop: '24px', padding: '0 4px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', fontWeight: 'bold' }}>
                Segment
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                 <SegmentToggle />
              </div>
            </div>
          )}
        </nav>

        {/* User Info & Logout */}
        <div className={styles.userInfo} style={{ justifyContent: isOpen ? 'space-between' : 'center', flexDirection: isOpen ? 'row' : 'column', gap: isOpen ? '0' : '16px' }}>
          {isOpen ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <UserIcon size={16} color="#fff" />
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: '120px' }}>
                  {userEmail || 'Loading...'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Authorized User</div>
              </div>
            </div>
          ) : (
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UserIcon size={16} color="#fff" />
            </div>
          )}
          
          <div style={{ display: 'flex', gap: '4px', flexDirection: isOpen ? 'row' : 'column', alignItems: 'center' }}>
            <button
              onClick={toggleTheme}
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px',
                borderRadius: '8px',
                transition: 'background-color 0.2s, color 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--surface-hover)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <button 
              onClick={handleLogout}
              title="Sign Out"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px',
                borderRadius: '8px',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.15)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
