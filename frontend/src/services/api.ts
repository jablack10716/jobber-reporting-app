import axios from "axios";
import { User } from "types/user";

// Choose a sensible default for production: current origin
const envBase = process.env.REACT_APP_API_URL;
const looksLocal = (u?: string) => !!u && /(localhost|127\.0\.0\.1)/i.test(u);
const defaultBase = (typeof window !== 'undefined' && window.location?.origin) || 'http://localhost:3000';
const baseURL = (!envBase || looksLocal(envBase)) ? defaultBase : envBase;

const api = axios.create({
  baseURL,
  withCredentials: true,
});

export function authenticateUser(code: string, state?: string) {
  // Send the authorization code and optional state to backend for exchange
  // Add debug logging to inspect the request/response during development
  console.debug('🚀 Sending auth code to backend', { 
    code: code?.substring(0, 10) + '...', 
    state,
    baseURL: api.defaults.baseURL,
    fullURL: `${api.defaults.baseURL}/auth/token`
  });
  
  return api.post<User>("/auth/token", { code, state })
    .then((resp) => {
      console.debug('✅ Received /auth/token response', resp?.data);
      return resp;
    })
    .catch((error) => {
      console.error('❌ /auth/token request failed:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        config: {
          url: error.config?.url,
          baseURL: error.config?.baseURL,
          method: error.config?.method
        }
      });
      throw error;
    });
}

export function getClients() {
  return api.get("/clients");
}

export function createReport(reportType: string, parameters?: any) {
  return api.post("/reports", { report: { report_type: reportType, parameters } });
}

export function getReports() {
  return api.get("/reports");
}

export function getReport(id: number) {
  return api.get(`/reports/${id}`);
}

export function logout() {
  return api.get("/logout");
}

export default api;
