const trimTrailingSlash = (value) => value.replace(/\/$/, '');

const getEnvValue = (key) => {
  const value = import.meta.env[key];
  return typeof value === 'string' ? value.trim() : '';
};

const apiOrigin = trimTrailingSlash(getEnvValue('VITE_API_ORIGIN') || 'http://localhost:3001');
const mediaOrigin = trimTrailingSlash(getEnvValue('VITE_MEDIA_ORIGIN') || 'http://localhost:5001');

export const API_ORIGIN = apiOrigin;
export const MEDIA_ORIGIN = mediaOrigin;
export const API_BASE_URL = `${apiOrigin}/api`;
export const MEDIA_API_BASE_URL = `${mediaOrigin}/api`;

export const toAbsoluteApiUrl = (path) => {
  if (!path) return apiOrigin;
  if (/^https?:\/\//i.test(path)) return path;
  return `${apiOrigin}${path.startsWith('/') ? path : `/${path}`}`;
};