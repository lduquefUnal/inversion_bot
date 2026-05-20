import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const session = localStorage.getItem('ib_session');
        if (session === 'active') {
            setIsAuthenticated(true);
        }
        setLoading(false);
    }, []);

    const login = (pin) => {
        // En un MVP real, esto se validaría contra una variable de entorno en el backend.
        // Por ahora lo manejamos localmente para la arquitectura inicial.
        // El PIN se configurará en el backend en la siguiente etapa.
        if (pin === '1234') { // PIN por defecto para pruebas iniciales
            localStorage.setItem('ib_session', 'active');
            setIsAuthenticated(true);
            return true;
        }
        return false;
    };

    const logout = () => {
        localStorage.removeItem('ib_session');
        setIsAuthenticated(false);
    };

    return (
        <AuthContext.Provider value={{ isAuthenticated, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
