import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import {
  LayoutDashboard, Server, CalendarDays, ShieldAlert, Activity, LogOut, Menu, X, Sun, Moon
} from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', roles: ['boss', 'server_manager', 'smtp_manager'] },
  { to: '/servers', icon: Server, label: 'Servers', roles: ['boss', 'server_manager'] },
  { to: '/smtp', icon: CalendarDays, label: 'SMTP Health', roles: ['boss', 'server_manager', 'smtp_manager'] },
  { to: '/delistings', icon: ShieldAlert, label: 'Delistings', roles: ['boss', 'server_manager', 'smtp_manager'] },
  { to: '/activity', icon: Activity, label: 'Activity Log', roles: ['boss'] },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const roleLabel = user?.role === 'boss' ? 'Boss' : user?.role === 'server_manager' ? 'Server Manager' : 'SMTP Manager';

  const filteredNav = navItems.filter(n => user && n.roles.includes(user.role));

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center glass-button">
          <Server className="w-4 h-4 text-primary" />
        </div>
        {!collapsed && <span className="font-mono font-bold text-foreground text-sm">SMTP Manager</span>}
      </div>

      {!collapsed && user && (
        <div className="px-4 py-3 border-b border-border">
          <p className="text-sm font-medium text-foreground">{user.name}</p>
          <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold glass-button">
            {roleLabel}
          </span>
        </div>
      )}

      <nav className="flex-1 p-2 space-y-1">
        {filteredNav.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                isActive
                  ? 'glass-button font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              }`
            }
          >
            <item.icon className="w-4 h-4 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="p-2 border-t border-border space-y-1">
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 shrink-0" /> : <Moon className="w-4 h-4 shrink-0" />}
          {!collapsed && <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
        </button>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex flex-col border-r border-border bg-card transition-all duration-300 ${
          collapsed ? 'w-16' : 'w-56'
        }`}
      >
        {sidebarContent}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute top-4 right-0 translate-x-1/2 w-5 h-5 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground z-10 hidden md:flex"
          style={{ position: 'absolute', top: 60, left: collapsed ? 52 : 212 }}
        >
          <Menu className="w-3 h-3" />
        </button>
      </aside>

      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-3 left-3 z-50 p-2 rounded-lg glass-button"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="w-64 bg-card border-r border-border relative">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>
            {sidebarContent}
          </div>
          <div className="flex-1 bg-background/50" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      <main className="flex-1 overflow-auto">
        <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
