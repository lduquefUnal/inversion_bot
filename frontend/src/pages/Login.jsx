import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import './Login.css';

const Login = () => {
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const from = location.state?.from?.pathname || '/portfolio';

    const handleSubmit = (e) => {
        e.preventDefault();
        if (login(pin)) {
            navigate(from, { replace: true });
        } else {
            setError('PIN Incorrecto. Intenta de nuevo.');
            setPin('');
        }
    };

    return (
        <div className="login-page">
            <div className="login-card">
                <div className="login-header">
                    <span className="lock-icon">🔒</span>
                    <h1>Acceso Privado</h1>
                    <p>Introduce tu PIN para ver el portafolio</p>
                </div>
                <form onSubmit={handleSubmit} className="login-form">
                    <div className="pin-input-group">
                        <input
                            type="password"
                            value={pin}
                            onChange={(e) => setPin(e.target.value)}
                            placeholder="••••"
                            maxLength={4}
                            autoFocus
                        />
                        {error && <p className="error-message">{error}</p>}
                    </div>
                    <button type="submit" className="login-btn">Desbloquear</button>
                </form>
                <div className="login-footer">
                    <p>InversionBot v3.0 — Secure Mode</p>
                </div>
            </div>
        </div>
    );
};

export default Login;
