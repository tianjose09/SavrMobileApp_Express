const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const authMiddleware = require('../middleware/auth');
const authController = require('../controllers/authController');
const donationController = require('../controllers/donationController');
const inventoryController = require('../controllers/inventoryController');
const mealController = require('../controllers/mealController');
const notificationController = require('../controllers/notificationController');

// ─── Multer Storage ───────────────────────────────────────────────────────────

function makeStorage(dest) {
  const fullPath = path.join(__dirname, '../../public', dest);
  fs.mkdirSync(fullPath, { recursive: true });
  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, fullPath),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
  });
}

const uploadFood = multer({ storage: makeStorage('donations/food') });
const uploadReceipt = multer({ storage: makeStorage('donations/receipts') });

// ─── Auth (public) ────────────────────────────────────────────────────────────

router.post('/register/donor',           authController.registerDonor);
router.post('/register/organization',    authController.registerOrganization);
router.post('/register/partner-kitchen', authController.registerPartnerKitchen);
router.post('/register/beneficiary',     authController.registerBeneficiary);
router.post('/login',                    authController.login);
router.post('/verify/send',              authController.sendVerificationEmail);
router.post('/verify/code',              authController.verifyCode);
router.post('/verify/resend',            authController.resendCode);
router.post('/password/forgot',          authController.forgotPassword);
router.post('/password/verify-code',     authController.verifyResetCode);
router.post('/password/reset',           authController.resetPassword);

// ─── PayMongo Webhook (public) ────────────────────────────────────────────────

router.post('/webhook/paymongo', donationController.paymongoWebhook);

// ─── PayMongo Redirects ───────────────────────────────────────────────────────

router.get('/payment/success', donationController.paymentSuccess);
router.get('/payment/cancel',  donationController.paymentCancel);

// ─── Protected ────────────────────────────────────────────────────────────────

router.use(authMiddleware);

router.get('/profile',               authController.profile);
router.put('/profile',               donationController.updateProfile);
router.post('/profile/deactivate',   donationController.deactivateAccount);
router.post('/logout',               authController.logout);
router.get('/dashboard',             authController.dashboard);

// Donations
router.post('/donation/paymongo',                      donationController.createPaymongoCheckout);
router.get('/donation/status/:id',                     donationController.checkPaymentStatus);
router.post('/donation/food',   uploadFood.array('food_images'), donationController.submitFood);
router.post('/donation/schedule',                      donationController.submitSchedule);
router.post('/donation/service',                       donationController.submitService);
router.post('/donation/request',                       donationController.submitBeneficiaryRequest);
router.get('/donation/my-requests',                    donationController.getBeneficiaryRequests);
router.post('/donation/my-requests/:id/cancel',        donationController.cancelBeneficiaryRequest);
router.put('/donation/requests/:id/status',            donationController.updateRequestStatus);
router.get('/donation/stats',                          donationController.getDonationStats);
router.get('/donation/upcoming',                       donationController.getUpcomingPickups);
router.put('/donation/pickup/:id',                     donationController.updatePickup);
router.delete('/donation/pickup/:id',                  donationController.deletePickup);

// Badges & Activities
router.get('/badges',     donationController.getBadges);
router.get('/activities', donationController.getActivities);

// Notifications
router.get('/notifications',         notificationController.getNotifications);
router.delete('/notifications/:id',  notificationController.deleteNotification);
router.delete('/notifications',      notificationController.deleteAllNotifications);

// Inventory
router.get('/inventory',            inventoryController.index);
router.get('/inventory/categories', inventoryController.categories);
router.post('/inventory/store',     inventoryController.store);
router.post('/inventory/deduct',    inventoryController.deduct);

// Meal Optimization
router.post('/meals/optimize', mealController.optimizeMeals);

module.exports = router;
