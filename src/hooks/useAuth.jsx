import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { setAuthToken } from "../components/AuthForm";

export function useAuth() {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [isAuthenticated, setIsAuthenticated] = useState(!!token);
  const navigate = useNavigate();

  useEffect(() => {
    if (token) {
      setAuthToken(token);
      setIsAuthenticated(true);
    } else {
      localStorage.removeItem("token");
      window.dispatchEvent(new Event("auth:changed"));
      setIsAuthenticated(false);
    }
  }, [token]);

  const logout = () => {
    setAuthToken(null);
    navigate("/");
  };

  return { token, setToken, isAuthenticated, logout };
}

