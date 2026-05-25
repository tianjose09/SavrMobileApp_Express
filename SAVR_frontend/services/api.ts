import axios from 'axios';
import { StorageUtils, StorageKeys } from '../utils/storage';

// In Expo, use the IP address of your machine for the emulator, or localhost if strictly on emulator.
// The default React Native Android emulator alias for localhost is 10.0.2.2
// IMPORTANT: If you are testing on your PHYSICAL PHONE via Expo Go, you MUST change this
// to your computer's local Wi-Fi IP address (e.g., 'http://192.168.1.100:8000/').
const BASE_URL = 'https://blurb-perm-stalling.ngrok-free.dev/';

export const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    Accept: 'application/json',
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
  deactivateAccount: () => api.post('api/profile/deactivate'),
  getDashboard: () => api.get('api/dashboard'),

  // Email Verification
  sendVerificationEmail: (data: any) => api.post('api/verify/send', data),
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
      headers: { 'Content-Type': 'multipart/form-data' }
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
  getMyRequests: () => api.get('api/donation/my-requests'),
  cancelBeneficiaryRequest: (id: number) => api.post(`api/donation/my-requests/${id}/cancel`),
  completeBeneficiaryRequest: (id: number) => api.post(`api/donation/my-requests/${id}/complete`),
  // Staff-only: change status to 'Pending' | 'Allocated' | 'Urgent'
  updateRequestStatus: (id: number, status: 'Pending' | 'Allocated' | 'Urgent' | 'Approved' | 'Accepted' | 'Rejected' | 'Denied') =>
    api.put(`api/donation/requests/${id}/status`, { status }),

  // PayMongo
  createPaymongoCheckout: (data: any) => api.post('api/donation/paymongo', data),
  checkPaymentStatus: (id: number) => api.get(`api/donation/status/${id}`),

  // Inventory Integration
  getInventory: () => api.get('api/inventory'),
  getInventoryCategories: () => api.get('api/inventory/categories'),
  addInventory: (data: any) => api.post('api/inventory/store', data),
  deductInventory: (data: any) => api.post('api/inventory/deduct', data),

  // Optimization & Meal Planning Engine
  optimizeMeals: (payload: any) => api.post('api/meals/optimize', payload),

  // Notifications
  getNotifications: () => api.get('api/notifications'),
  getCriticalNotifications: () => api.get('api/notifications?critical=true'),
  deleteNotification: (id: number) => api.delete(`api/notifications/${id}`),
  deleteAllNotifications: () => api.delete('api/notifications'),
};
