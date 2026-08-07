import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

export const AuthModal = ({ isOpen, onClose, onAuthSuccess, onDemoMode, initialMode = 'login' }) => {
  // mode can be: 'login' | 'signup' | 'forgot' | 'reset_password'
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleSwitchMode = (newMode) => {
    setMode(newMode);
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!isSupabaseConfigured || !supabase) {
      setErrorMsg('Supabase no está configurado en las variables de entorno.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signup') {
        if (!email || !password) return;
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.session) {
          onAuthSuccess(data.session.user);
          onClose();
        } else {
          setSuccessMsg('¡Cuenta creada! Si requieres verificación, revisa tu correo electrónico.');
        }
      } else if (mode === 'login') {
        if (!email || !password) return;
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onAuthSuccess(data.user);
        onClose();
      } else if (mode === 'forgot') {
        if (!email) return;
        const redirectUrl = `${window.location.origin}/portfolio`;
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: redirectUrl,
        });
        if (error) throw error;
        setSuccessMsg('Te hemos enviado un correo electrónico con el enlace para restablecer tu contraseña.');
      } else if (mode === 'reset_password') {
        if (!newPassword) return;
        const { data, error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
        setSuccessMsg('¡Tu contraseña se ha actualizado correctamente!');
        setTimeout(() => {
          if (data?.user) onAuthSuccess(data.user);
          onClose();
        }, 1500);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Error al procesar la solicitud');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      className="modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="modal-card"
        style={{ maxWidth: '420px', width: '90%' }}
        initial={{ scale: 0.9, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 30 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ textAlign: 'center', marginBottom: '1.2rem' }}>
          <h2 style={{ fontSize: '1.6rem', margin: '0 0 6px 0', color: '#f8fafc' }}>
            {mode === 'signup' && '✨ Crear Cuenta'}
            {mode === 'login' && '🔑 Iniciar Sesión'}
            {mode === 'forgot' && '📧 Recuperar Contraseña'}
            {mode === 'reset_password' && '🔒 Nueva Contraseña'}
          </h2>
          <p className="modal-sub" style={{ margin: 0 }}>
            {mode === 'signup' && 'Guarda tu portafolio personal de forma privada en tu cuenta'}
            {mode === 'login' && 'Accede a tu portafolio personal sincronizado'}
            {mode === 'forgot' && 'Ingresa tu correo para recibir un enlace de restablecimiento'}
            {mode === 'reset_password' && 'Ingresa tu nueva contraseña para actualizar tu acceso'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {mode !== 'reset_password' && (
            <div className="form-group">
              <label>Correo Electrónico</label>
              <input
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          )}

          {(mode === 'login' || mode === 'signup') && (
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label>Contraseña</label>
                {mode === 'login' && (
                  <button
                    type="button"
                    style={{ background: 'none', border: 'none', color: '#60a5fa', fontSize: '0.78rem', cursor: 'pointer', padding: 0 }}
                    onClick={() => handleSwitchMode('forgot')}
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                )}
              </div>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>
          )}

          {mode === 'reset_password' && (
            <div className="form-group">
              <label>Nueva Contraseña</label>
              <input
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>
          )}

          {errorMsg && (
            <div style={{ color: '#ef4444', fontSize: '0.85rem', background: 'rgba(239, 68, 68, 0.1)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
              ⚠️ {errorMsg}
            </div>
          )}

          {successMsg && (
            <div style={{ color: '#10b981', fontSize: '0.85rem', background: 'rgba(16, 185, 129, 0.1)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
              ✅ {successMsg}
            </div>
          )}

          <button type="submit" className="btn-save" style={{ width: '100%', marginTop: '8px' }} disabled={loading}>
            {loading
              ? 'Procesando...'
              : mode === 'signup'
              ? 'Registrarme'
              : mode === 'login'
              ? 'Entrar a Mi Cuenta'
              : mode === 'forgot'
              ? 'Enviar Enlace de Recuperación'
              : 'Guardar Nueva Contraseña'}
          </button>
        </form>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '16px 0 0 0', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px', textAlign: 'center' }}>
          {mode === 'login' && (
            <button
              type="button"
              style={{ background: 'none', border: 'none', color: '#60a5fa', fontSize: '0.85rem', cursor: 'pointer' }}
              onClick={() => handleSwitchMode('signup')}
            >
              ¿No tienes cuenta? Regístrate gratis
            </button>
          )}

          {mode === 'signup' && (
            <button
              type="button"
              style={{ background: 'none', border: 'none', color: '#60a5fa', fontSize: '0.85rem', cursor: 'pointer' }}
              onClick={() => handleSwitchMode('login')}
            >
              ¿Ya tienes cuenta? Inicia sesión
            </button>
          )}

          {(mode === 'forgot' || mode === 'reset_password') && (
            <button
              type="button"
              style={{ background: 'none', border: 'none', color: '#60a5fa', fontSize: '0.85rem', cursor: 'pointer' }}
              onClick={() => handleSwitchMode('login')}
            >
              ← Volver al inicio de sesión
            </button>
          )}
        </div>

        {mode !== 'reset_password' && (
          <div style={{ textAlign: 'center', background: 'rgba(30, 41, 59, 0.5)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', marginTop: '12px' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '8px' }}>
              ¿Quieres explorar sin registrarte?
            </span>
            <button
              type="button"
              className="btn-cancel"
              style={{ width: '100%', borderColor: '#eab308', color: '#eab308', background: 'rgba(234,179,8,0.1)' }}
              onClick={() => { onDemoMode(); onClose(); }}
            >
              ⚡ Explorar en Modo Demo / Invitado
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

