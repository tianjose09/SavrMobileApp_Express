import axios from 'axios';
import { StorageUtils, StorageKeys } from '../utils/storage';


// In Expo, use the IP address of your machine for the emulator, or localhost if strictly on emulator.
// The default React Native Android emulator alias for localhost is 10.0.2.2
// IMPORTANT: If you are testing on your PHYSICAL PHONE via Expo Go, you MUST change this
// to your computer's local Wi-Fi IP address (e.g., 'http://192.168.1.100:8000/').
const BASE_URL = 'https://savrmobileappexpress-production.up.railway.app/';
// Local fallback (use when not using ngrok): 'http://192.168.1.3:8000/'

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000, // 15-second timeout so the app doesn't hang when backend is unreachable
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    'ngrok-skip-browser-warning': 'true',
  },
});

// Configure Axios to automatically attach the token if available
api.interceptors.request.use(
  async (config) => {
    // Some API calls might have Authorization set manually, so we don't mess with it if it is.
    if (!config.headers.Authorization) {
      const token = await StorageUtils.getItem(StorageKeys.AUTH_TOKEN);
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: reject 2xx responses where the server explicitly signals failure
api.interceptors.response.use(
  (response) => {
    // If the server returned success: false with a 200 status, treat it as an error
    if (response.data && response.data.success === false) {
      const err: any = new Error(response.data.message || 'Request failed');
      err.response = response;
      return Promise.reject(err);
    }
    return response;
  },
  (error) => {
    if (error?.response?.status === 401) {
      error.silent = true;
      // Suppress 401 console errors for background/polling GET requests 
      // by resolving gracefully instead of rejecting.
      if (error.config?.method === 'get') {
        return Promise.resolve({ data: { success: false, message: 'Unauthorized (silent)' } });
      }
    } else if (error.code === 'ECONNABORTED') {
      error.message = 'Request timed out. Please check your connection and try again.';
    } else if (!error.response) {
      error.message = 'Cannot reach the server. Please check if the backend is running.';
    }
    return Promise.reject(error);
  }
);

export const ApiService = {
  // Auth
  login: (data: any) => api.post('api/login', data),
  registerDonor: (data: any) => api.post('api/register/donor', data),
  registerOrganization: (data: any) => api.post('api/register/organization', data),
  registerPartnerKitchen: (data: any) => api.post('api/register/partner-kitchen', data),
  registerBeneficiary: (data: any) => api.post('api/register/beneficiary', data),
  logout: () => api.post('api/logout'),

  // Profile & Dashboard
  getProfile: () => api.get('api/profile'),
  updateProfile: (data: any) => api.put('api/profile', data),
  deleteAccount: () => api.post('api/profile/delete'),
  getDashboard: () => api.get('api/dashboard'),

  // Email Verification
  sendVerificationEmail: (data: any) => api.post('api/verify/send', data, { timeout: 30000 }),
  verifyCode: (data: any) => api.post('api/verify/code', data),
  resendCode: (data: any) => api.post('api/verify/resend', data),

  // Forgot Password
  forgotPassword: (data: any) => api.post('api/password/forgot', data),
  verifyResetCode: (data: any) => api.post('api/password/verify-code', data),
  resetPassword: (data: any) => api.post('api/password/reset', data),

  // Financial Donation
  submitFinancialDonation: (data: any) =>
    api.post('api/donation/paymongo', data),

  // Food Donation
  submitFoodDonation: (formData: FormData) =>
    api.post('api/donation/food', formData, {
      headers: { 'Content-Type': undefined },
    }),
  submitSchedule: (data: any) => api.post('api/donation/schedule', data),

  // Service Donation
  submitServiceDonation: (data: any) => api.post('api/donation/service', data),

  // Stats, Badges, Activities
  getDonationStats: () => api.get('api/donation/stats'),
  getUpcomingPickups: () => api.get('api/donation/upcoming'),
  updatePickup: (id: number, data: any) => api.put(`api/donation/pickup/${id}`, data),
  deletePickup: (id: number) => api.delete(`api/donation/pickup/${id}`),
  getBadges: () => api.get('api/badges'),
  getActivities: () => api.get('api/activities'),

  submitBeneficiaryRequest: (data: any) => api.post('api/donation/request', data),
  getActiveDrives: () => api.get('api/donation/active-drives'),
  getMyRequests: () => api.get('api/donation/my-requests'),
  autoCancelExpiredRequests: () => api.post('api/donation/my-requests/auto-cancel-expired'),
  cancelBeneficiaryRequest: (id: number) => api.post(`api/donation/my-requests/${id}/cancel`),
  receiveBeneficiaryStop: (id: number, stopId: number) =>
    api.post(`api/donation/requests/${id}/stops/${stopId}/received`),
  completeBeneficiaryRequest: (
    id: number,
    receivedQty?: number,
    receivedItems?: { food_name: string; received_qty: number; unit: string }[],
    remarks?: string
  ) =>
    api.post(`api/donation/my-requests/${id}/complete`,
      receivedItems
        ? { received_items: receivedItems, ...(remarks ? { remarks } : {}) }
        : receivedQty != null
          ? { received_qty: receivedQty, ...(remarks ? { remarks } : {}) }
          : remarks ? { remarks } : {}
    ),
  // Staff-only: change status; optionally pass delivery_date_time (ISO string)
  updateRequestStatus: (id: number, status: 'Pending' | 'Allocated' | 'Urgent' | 'Approved' | 'Accepted' | 'Rejected' | 'Denied' | 'Cancelled', delivery_date_time?: string) =>
    api.put(`api/donation/requests/${id}/status`, { status, ...(delivery_date_time ? { delivery_date_time } : {}) }),

  // PayMongo
  createPaymongoCheckout: (data: any) => api.post('api/donation/paymongo', data),
  checkPaymentStatus: (id: number) => api.get(`api/donation/status/${id}`),

  // Inventory Integration
  getInventory: () => api.get('api/inventory'),
  getPreparedMeals: () => api.get('api/inventory/prepared'),
  getInventoryCategories: () => api.get('api/inventory/categories'),
  addInventory: (data: any) => api.post('api/inventory/store', data),
  deductInventory: (data: any) => api.post('api/inventory/deduct', data),

  // Optimization & Meal Planning Engine
  optimizeMeals: (payload: any) => api.post('api/meals/optimize', payload),

  // Notifications
  getNotifications: () => api.get('api/notifications'),
  getCriticalNotifications: () => api.get('api/notifications?critical=true'),
  markAllNotificationsRead: () => api.post('api/notifications/mark-all-read'),
  markNotificationRead: (id: string) => api.post(`api/notifications/${id}/mark-read`),
  deleteNotification: (id: number) => api.delete(`api/notifications/${id}`),
  deleteAllNotifications: () => api.delete('api/notifications'),

  // Push token
  registerPushToken: (token: string) => api.post('api/push-token', { token }),
  clearPushToken: () => api.post('api/push-token/clear'),
};
