import { Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { LogOut, Globe, Package, LayoutDashboard } from 'lucide-react';

const Layout = ({ children }: { children: React.ReactNode }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'fr' : 'en';
    i18n.changeLanguage(newLang);
  };

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="flex items-center gap-2 mb-8 text-primary">
          <Package size={32} />
          <h2 style={{ color: 'var(--text-main)', fontSize: '1.2rem', fontWeight: 'bold' }}>Nageo Management</h2>
        </div>

        <nav className="flex flex-col gap-2 flex-grow">
          <button className="btn btn-secondary w-full justify-start border-none" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <LayoutDashboard size={20} />
            {t('dashboard')}
          </button>
        </nav>

        <div className="flex flex-col gap-4 mt-auto">
          <button onClick={toggleLanguage} className="btn btn-secondary w-full justify-center">
            <Globe size={18} />
            {i18n.language === 'en' ? 'Français' : 'English'}
          </button>
          
          <button onClick={handleLogout} className="btn w-full justify-center" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--status-returned)' }}>
            <LogOut size={18} />
            {t('sign_out')}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <header className="flex justify-between items-center mb-8 border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Nageo Management – Admin Panel</h1>
            <span className="text-xs px-2 py-0.5 bg-primary/20 text-primary rounded-full">v5.1.8-UNIFIED</span>
          </div>
        </header>

        <section>
          {children}
        </section>
      </main>
    </div>
  );
};

export default Layout;
