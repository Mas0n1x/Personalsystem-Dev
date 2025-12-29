import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const hasRun = useRef(false);

  useEffect(() => {
    // Prevent double execution in React Strict Mode
    if (hasRun.current) return;
    hasRun.current = true;

    const code = searchParams.get('code');

    if (!code) {
      setError('Kein Authentifizierungscode erhalten');
      return;
    }

    const handleCallback = async () => {
      try {
        await authApi.callback(code);
        await refreshUser();
        navigate('/', { replace: true });
      } catch (err) {
        console.error('Auth callback error:', err);
        setError('Authentifizierung fehlgeschlagen. Bitte versuche es erneut.');
      }
    };

    handleCallback();
  }, [searchParams, navigate, refreshUser]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900">
        <div className="text-red-500 text-xl mb-4">{error}</div>
        <a href="/login" className="btn-primary">
          Zurück zum Login
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500 mb-4"></div>
      <p className="text-slate-400">Authentifizierung läuft...</p>
    </div>
  );
}
