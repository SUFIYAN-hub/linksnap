import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || '', // empty = same origin, goes through the rewrite
  withCredentials: true,
});

export default api;