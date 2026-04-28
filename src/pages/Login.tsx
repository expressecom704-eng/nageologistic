import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { Package, Lock, User, Globe, Phone as PhoneIcon, UserPlus, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Login: React.FC = () => {
  const { t, i18n } = useTranslation();
  
  // View State
  const [isRegistering, setIsRegistering] = useState(false);

  // Form States
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'en' ? 'fr' : 'en');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    let authResponse;

    const isEmail = identifier.includes('@');
    if (isEmail) {
      // Native Email Login (Admins/Agents)
      authResponse = await supabase.auth.signInWithPassword({ email: identifier, password });
    } else {
      // Native Phone Login (Agents/Admins) - Enforce E.164 by stripping spaces and ensuring a '+'
      let cleanPhone = identifier.replace(/[\s-()]/g, '');
      if (!cleanPhone.startsWith('+')) {
         cleanPhone = '+' + cleanPhone.replace(/^0+/, ''); // Very basic fallback strategy, but best practice is telling them
      }
      authResponse = await supabase.auth.signInWithPassword({ phone: cleanPhone, password });
    }

    if (authResponse.error) {
       setError(authResponse.error.message.includes('E.164') ? "Phone Number must include your Country Code (e.g., +225...)" : authResponse.error.message);
    }
    
    setLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (regPassword !== regConfirm) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    if (regPassword.length < 6) {
      setError("Password must be at least 6 characters long");
      setLoading(false);
      return;
    }

    // Natively use Phone if provided, else Email if they entered one (Though UI specifies Phone)
    const isRegEmail = regPhone.includes('@');
    let finalPayloadPhone = '';
    
    if (!isRegEmail) {
       let cleanPhone = regPhone.replace(/[\s-()]/g, '');
       if (!cleanPhone.startsWith('+')) {
         setError("Phone Number must include your Country Code with a '+' (e.g., +22501234567)");
         setLoading(false);
         return;
       }
       finalPayloadPhone = cleanPhone;
    }

    const authPayload = isRegEmail 
       ? { email: regPhone, password: regPassword } 
       : { phone: finalPayloadPhone, password: regPassword };

    const { data: authData, error: signUpError } = await supabase.auth.signUp(authPayload);

    if (signUpError) {
      setError(signUpError.message.includes('E.164') ? "Phone Number must include Country Code (e.g., +225...)" : signUpError.message);
      setLoading(false);
      return;
    }

    if (authData.user) {
      const { error: profileError } = await supabase.from('users').insert([
        { 
          id: authData.user.id, 
          name: regName, 
          phone: isRegEmail ? regPhone : finalPayloadPhone, 
          role: 'agent' 
        }
      ]);

      if (profileError) {
        console.error("Profile Error:", profileError);
        setError("Account created but failed to bind profile. Contact Admin.");
        setLoading(false);
        return;
      }

      setSuccess("Account Registered Successfully! Logging you in...");
    }
    
    setLoading(false);
  };

  return (
    <div className="flex items-center justify-center min-h-screen relative overflow-hidden" style={{ background: 'var(--bg-color)' }}>
      {/* Dynamic Animated Background Gradients */}
      <motion.div 
        animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
        style={{
          position: 'absolute', top: '-10%', left: '-10%', width: '600px', height: '600px',
          background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, rgba(255,255,255,0) 70%)',
          borderRadius: '50%', filter: 'blur(40px)', zIndex: 0
        }}
      />
      <motion.div 
        animate={{ scale: [1, 1.3, 1], rotate: [0, -90, 0] }}
        transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
        style={{
          position: 'absolute', bottom: '-20%', right: '-10%', width: '800px', height: '800px',
          background: 'radial-gradient(circle, rgba(14,165,233,0.1) 0%, rgba(255,255,255,0) 70%)',
          borderRadius: '50%', filter: 'blur(60px)', zIndex: 0
        }}
      />

      <div className="absolute top-8 right-8 z-10">
        <button onClick={toggleLanguage} className="btn btn-secondary" style={{ borderRadius: '9999px', padding: '0.5rem 1rem' }}>
          <Globe size={18} />
          {i18n.language === 'en' ? 'FR' : 'EN'}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {!isRegistering ? (
          <motion.div 
            key="login"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
            className="card w-full max-w-md relative z-10" 
            style={{ padding: '2.5rem', background: 'rgba(30, 41, 59, 0.85)' }}
          >
            <div className="flex flex-col items-center mb-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center mb-4 shadow-lg shadow-primary/30" style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))' }}>
                <Package size={32} color="white" />
              </div>
              <h2 className="text-2xl font-bold text-center" style={{ color: 'var(--text-main)' }}>Welcome to Nageo Management</h2>
              <p className="text-muted mt-2 text-center text-sm">Secure Admin Access</p>
            </div>

            {error && (
              <div className="mb-6 p-3 rounded-lg text-sm text-center" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: 'var(--status-returned)' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label" htmlFor="identifier">Phone / Email</label>
                <div className="relative">
                  <User size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted" />
                  <input 
                    id="identifier"
                    type="text" 
                    className="input-field w-full pl-10" 
                    value={identifier}
                    onChange={e => setIdentifier(e.target.value)}
                    placeholder="e.g. 0540001000 or admin@..."
                    required
                  />
                </div>
              </div>

              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label" htmlFor="password">{t('password')}</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted" />
                  <input 
                    id="password"
                    type="password" 
                    className="input-field w-full pl-10" 
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-primary w-full mt-4 py-3" disabled={loading}>
                {loading ? <span className="animate-spin mr-2">⟳</span> : null}
                {t('login')}
              </button>

              <div className="text-center mt-4 border-t border-[var(--border-color)] pt-4">
                 <p className="text-sm text-muted mb-3">Delivery Agent without an account?</p>
                 <button type="button" onClick={() => { setIsRegistering(true); setError(null); }} className="btn btn-secondary w-full py-2">
                   <UserPlus size={18} className="mr-2" /> Register Now
                 </button>
              </div>
            </form>
          </motion.div>

        ) : (

          <motion.div 
            key="register"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="card w-full max-w-md relative z-10" 
            style={{ padding: '2.5rem', background: 'rgba(30, 41, 59, 0.85)' }}
          >
            <button type="button" onClick={() => { setIsRegistering(false); setError(null); }} className="absolute top-6 left-6 text-muted hover:text-white transition-colors">
              <ArrowLeft size={24} />
            </button>

            <div className="flex flex-col items-center mb-6 mt-4">
              <h2 className="text-2xl font-bold text-center" style={{ color: 'var(--text-main)' }}>Agent Registration</h2>
              <p className="text-muted mt-2 text-center text-sm">Create your delivery profile</p>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-lg text-sm text-center" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: 'var(--status-returned)' }}>{error}</div>
            )}
            {success && (
              <div className="mb-4 p-3 rounded-lg text-sm text-center" style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', color: 'var(--status-delivered)' }}>{success}</div>
            )}

            <form onSubmit={handleRegister} className="flex flex-col gap-4">
              <div className="input-group mb-0">
                <label className="input-label">Full Name</label>
                <div className="relative">
                  <User size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted" />
                  <input type="text" className="input-field w-full pl-10" value={regName} onChange={e => setRegName(e.target.value)} placeholder="John Doe" required />
                </div>
              </div>

              <div className="input-group mb-0">
                <label className="input-label">Phone / Email (Unique)</label>
                <div className="relative">
                  <PhoneIcon size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted" />
                  <input type="text" className="input-field w-full pl-10" value={regPhone} onChange={e => setRegPhone(e.target.value)} placeholder="0540002000 or delivery@company.com" required />
                </div>
              </div>

              <div className="input-group mb-0">
                <label className="input-label">{t('password')}</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted" />
                  <input type="password" className="input-field w-full pl-10" value={regPassword} onChange={e => setRegPassword(e.target.value)} placeholder="••••••••" required />
                </div>
              </div>

              <div className="input-group mb-0">
                <label className="input-label">Confirm Password</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted" />
                  <input type="password" className="input-field w-full pl-10" value={regConfirm} onChange={e => setRegConfirm(e.target.value)} placeholder="••••••••" required />
                </div>
              </div>

              <button type="submit" className="btn btn-primary w-full mt-4 py-3" disabled={loading}>
                {loading ? <span className="animate-spin mr-2">⟳</span> : null}
                Create Account
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Login;
