import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useStore } from './store/useStore';
import { supabase } from './lib/supabase';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import AgentDashboard from './pages/AgentDashboard';
import Layout from './components/Layout';

function App() {
  const { user, role, setUser, setRole } = useStore();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchRole(session.user.id);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchRole(session.user.id);
      } else {
        setRole(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const [fetchError, setFetchError] = React.useState<string | null>(null);

  const fetchRole = async (userId: string, retries = 3) => {
    // maybeSingle() prevents the "Cannot coerce result" crash and cleanly returns null if 0 rows exist
    const { data, error } = await supabase.from('users').select('role').eq('id', userId).maybeSingle();
    
    if (error) {
      console.error("fetchRole error:", error);
      setFetchError(error.message);
      return;
    }

    if (data && data.role) {
      setRole(data.role);
    } else if (retries > 0) {
      // Race Condition Fix: Wait 1 second and retry querying if the Login UI hasn't finished the INSERT yet
      console.log(`Role not found yet. Retrying in 1s... (${retries} left)`);
      setTimeout(() => fetchRole(userId, retries - 1), 1000);
    } else {
      setFetchError("Profile not synchronized in database. This happens if you missed running the SQL policies or network crashed.");
    }
  };

  if (user && !role) {
    if (fetchError) {
      return (
        <div className="flex flex-col justify-center items-center min-h-screen text-danger p-8">
          <h2 className="text-2xl font-bold mb-4">Database Connection Error</h2>
          <p className="mb-4">We are authenticated successfully, but cannot fetch your role profile.</p>
          <div className="bg-black/50 p-4 rounded text-white font-mono">{fetchError}</div>
          <button className="btn btn-primary mt-6" onClick={() => supabase.auth.signOut()}>Logout</button>
        </div>
      );
    }
    return <div className="flex justify-center items-center min-h-screen">Loading Profile...</div>;
  }

  return (
    <BrowserRouter basename="/nageologistic/">
      <Routes>
        <Route 
          path="/login" 
          element={!user ? <Login /> : <Navigate to="/" replace />} 
        />
        
        <Route element={<Layout />}>
          <Route 
            path="/" 
            element={
              !user ? <Navigate to="/login" replace /> :
              role === 'admin' ? <AdminDashboard /> : <AgentDashboard />
            } 
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
