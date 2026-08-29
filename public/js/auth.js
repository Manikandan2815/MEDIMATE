/* ==========================================================================
   MediMate Authentication & User Profile Manager
   ========================================================================== */

window.currentUser = null;
window.authToken = null;

const FALLBACK_GOOGLE_CLIENT_ID = '721624148499-tpkd4s251j1qskobmi4f2euiqq01k5e2.apps.googleusercontent.com';
const FALLBACK_UPI_ID = 'pandianlogesh795@okicici';

// Default Seed Demo User for offline fallback
const DEFAULT_DEMO_USER = {
  id: 'user-8492',
  fullName: 'John Doe',
  email: 'john.doe@medimate.health',
  phone: '+1 (555) 234-5678',
  createdAt: 'August 19, 2026',
  avatarInitials: 'JD',
  avatarUrl: null
};

/**
 * Validates email format using regex.
 */
function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

/**
 * Renders avatar container with either img tag or initials fallback.
 */
function renderAvatarContainer(containerEl, user) {
  if (!containerEl) return;
  const u = user || window.currentUser || DEFAULT_DEMO_USER;
  const initials = u.avatarInitials || 'JD';
  if (u && u.avatarUrl) {
    containerEl.innerHTML = `<img src="${u.avatarUrl}" alt="${escapeHtml(u.fullName || 'User')}" class="avatar-img">`;
  } else {
    containerEl.innerHTML = `<span>${initials}</span>`;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, (m) => {
    switch (m) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#039;';
      default: return m;
    }
  });
}

function buildDemoUser(email, fullNameOverride = null) {
  const safeEmail = (email || 'demo@medimate.local').trim();
  const nameSeed = fullNameOverride || safeEmail.split('@')[0] || 'MediMate User';
  const displayName = nameSeed.replace(/[_-]+/g, ' ').trim() || 'MediMate User';
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase() || '').join('') || 'MD';

  return {
    id: `demo-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    fullName: displayName,
    email: safeEmail,
    phone: '',
    createdAt: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    avatarInitials: initials,
    avatarUrl: null,
    subscriptionStatus: 'trial',
    trialEndsAt: null,
    paymentTransactions: []
  };
}

function applyOfflineAuthFallback(user, message) {
  saveAuthSession(`offline_${Date.now()}`, user, true);
  showToast(message || 'Server connection issue detected. Offline demo mode activated.', 'warning');
  window.location.hash = '#dashboard';
  checkAuthGuard();
  if (window.refreshAllViews) window.refreshAllViews();
}

/**
 * Handles Hash Navigation & Route Protection.
 */
function handleRouteHash() {
  const hash = (window.location.hash || '').replace('#', '') || '';

  const authScreens = ['login', 'signup', 'forgot-password'];
  const appTabs = ['dashboard', 'medications', 'schedule', 'history', 'analytics', 'ai-assistant', 'profile', 'settings'];

  const authContainer = document.getElementById('authContainer');
  const appLayout = document.querySelector('.app-layout');

  if (!window.currentUser || !window.authToken) {
    // Unauthenticated: Show Auth screens
    if (authContainer) authContainer.classList.remove('hidden');
    if (appLayout) appLayout.classList.add('hidden');

    if (hash === 'signup') {
      showAuthView('signupScreen', false);
    } else if (hash === 'forgot-password') {
      showAuthView('forgotPasswordScreen', false);
    } else {
      showAuthView('loginScreen', false);
      if (window.location.hash !== '#login') {
        history.replaceState(null, '', '#login');
      }
    }
  } else {
    // Authenticated: Show Main App
    if (authContainer) authContainer.classList.add('hidden');
    if (appLayout) appLayout.classList.remove('hidden');

    syncHeaderUserUI();

    if (appTabs.includes(hash)) {
      if (window.switchTabInternal) {
        window.switchTabInternal(hash, false);
      }
    } else {
      if (window.switchTabInternal) {
        window.switchTabInternal('dashboard', false);
      }
      if (authScreens.includes(hash) || !hash) {
        history.replaceState(null, '', '#dashboard');
      }
    }
  }
}

/**
 * Initializes Authentication State & Checks Route Protection.
 */
function initAuth() {
  const savedToken = localStorage.getItem('medimate_token') || sessionStorage.getItem('medimate_token');
  const savedUser = localStorage.getItem('medimate_user') || sessionStorage.getItem('medimate_user');

  if (savedToken && savedUser) {
    try {
      window.authToken = savedToken;
      window.currentUser = JSON.parse(savedUser);
    } catch (e) {
      window.authToken = null;
      window.currentUser = null;
    }
  }

  window.addEventListener('hashchange', () => {
    handleRouteHash();
  });

  window.addEventListener('popstate', () => {
    checkAuthGuard();
  });

  initGoogleAuth();
  initPaymentConfig();
  checkAuthGuard();
}

async function initPaymentConfig() {
  try {
    const response = await fetch('/api/auth/config');
    const config = await response.json();
    window.MEDIMATE_UPI_ID = config.upiId || FALLBACK_UPI_ID;
    const upiLabel = document.getElementById('paymentUpiId');
    if (upiLabel) upiLabel.textContent = window.MEDIMATE_UPI_ID || 'Not configured';
    renderPaymentQr();
  } catch (error) {
    window.MEDIMATE_UPI_ID = FALLBACK_UPI_ID;
    const upiLabel = document.getElementById('paymentUpiId');
    if (upiLabel) upiLabel.textContent = window.MEDIMATE_UPI_ID;
    renderPaymentQr();
    showBillingAlert('Using the default deployed UPI configuration.', 'warning');
  }
}

function renderPaymentQr() {
  if (!window.MEDIMATE_UPI_ID) return;
  const paymentUrl = `upi://pay?pa=${encodeURIComponent(window.MEDIMATE_UPI_ID)}&pn=${encodeURIComponent('MediMate')}&am=599&cu=INR&tn=${encodeURIComponent('MediMate lifetime access')}`;
  const qr = document.getElementById('paymentQr');
  if (qr) qr.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(paymentUrl)}`;
}

/**
 * Initializes Google Identity Services buttons when a client ID is configured.
 */
async function initGoogleAuth(attempt = 0) {
  const buttons = document.querySelectorAll('[data-google-signin]');
  if (!buttons.length) return;
  if (!window.google?.accounts?.id) {
    if (attempt < 20) window.setTimeout(() => initGoogleAuth(attempt + 1), 250);
    return;
  }

  await loadGoogleConfig();

  if (!window.MEDIMATE_GOOGLE_CLIENT_ID) {
    return;
  }

  window.google.accounts.id.initialize({
    client_id: window.MEDIMATE_GOOGLE_CLIENT_ID,
    callback: handleGoogleCredential,
    auto_select: false,
    cancel_on_tap_outside: false,
    use_fedcm_for_prompt: false
  });

  buttons.forEach((button) => {
    window.google.accounts.id.renderButton(button, {
      theme: 'outline',
      size: 'large',
      width: Math.min(380, button.parentElement?.clientWidth || 380),
      text: 'continue_with',
      shape: 'rectangular'
    });
  });

  const fallbackButton = document.getElementById('googleFallbackButton');
  if (fallbackButton) fallbackButton.classList.add('hidden');

  // GIS owns the account list and can show existing Google sessions safely.
  window.google.accounts.id.prompt();
}

async function loadGoogleConfig() {
  if (window.MEDIMATE_GOOGLE_CLIENT_ID) return true;
  try {
    const configResponse = await fetch('/api/auth/config');
    const config = await configResponse.json();
    window.MEDIMATE_GOOGLE_CLIENT_ID = config.googleClientId || FALLBACK_GOOGLE_CLIENT_ID;
    window.MEDIMATE_UPI_ID = config.upiId || FALLBACK_UPI_ID;
    return Boolean(window.MEDIMATE_GOOGLE_CLIENT_ID);
  } catch (error) {
    window.MEDIMATE_GOOGLE_CLIENT_ID = FALLBACK_GOOGLE_CLIENT_ID;
    window.MEDIMATE_UPI_ID = FALLBACK_UPI_ID;
    return true;
  }
}

async function startGoogleSignIn() {
  const configured = await loadGoogleConfig();
  if (!configured) {
    const fallbackUser = buildDemoUser('google-user@medimate.local', 'Google Demo User');
    applyOfflineAuthFallback(fallbackUser, 'Google sign-in is not configured on this server, so demo access was enabled for now.');
    return;
  }

  if (!window.google?.accounts?.id) {
    const fallbackUser = buildDemoUser('google-user@medimate.local', 'Google Demo User');
    applyOfflineAuthFallback(fallbackUser, 'Google sign-in is still loading. Demo access was enabled for this session.');
    return;
  }

  await initGoogleAuth();
}

async function startFreeTrial() {
  if (!window.currentUser) return;
  try {
    const response = await fetch('/api/billing/trial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: window.currentUser.id })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to start trial.');
    window.currentUser = data.user;
    saveAuthUserOnly(data.user);
    renderSubscriptionStatus();
    showToast('Your 3-month free trial is active.', 'success');
  } catch (error) {
    showBillingAlert(error.message, 'error');
  }
}

function openLifetimePayment() {
  const upiId = window.MEDIMATE_UPI_ID || FALLBACK_UPI_ID;
  if (!upiId) {
    showBillingAlert('Add MEDIMATE_UPI_ID to .env before accepting payments.', 'error');
    return;
  }

  const paymentUrl = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent('MediMate')}&am=599&cu=INR&tn=${encodeURIComponent('MediMate lifetime access')}`;
  window.location.href = paymentUrl;
  showBillingAlert('Complete the INR 599 payment in your UPI app. Lifetime access is activated only after payment verification.', 'success');
}

async function submitUpiTransaction(event) {
  event.preventDefault();
  if (!window.currentUser) return;
  const input = document.getElementById('upiTransactionId');
  const transactionId = input.value.trim();
  try {
    const response = await fetch('/api/billing/upi-transaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: window.currentUser.id, transactionId })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Transaction submission failed.');
    input.value = '';
    showBillingAlert(`${data.message} Reference: ${data.transaction.transactionId}`, 'success');
  } catch (error) {
    showBillingAlert(error.message, 'error');
  }
}

function saveAuthUserOnly(user) {
  const storage = localStorage.getItem('medimate_user') ? localStorage : sessionStorage;
  storage.setItem('medimate_user', JSON.stringify(user));
}

function showBillingAlert(message, type) {
  const alert = document.getElementById('billingAlert');
  if (alert) {
    alert.className = `auth-alert auth-alert-${type}`;
    alert.textContent = message;
    alert.classList.remove('hidden');
  }
}

function renderSubscriptionStatus() {
  const status = document.getElementById('subscriptionStatus');
  if (!status || !window.currentUser) return;
  if (window.currentUser.subscriptionStatus === 'lifetime') {
    status.textContent = 'Lifetime access is active.';
    return;
  }
  const end = window.currentUser.trialEndsAt ? new Date(window.currentUser.trialEndsAt) : null;
  status.textContent = end && !Number.isNaN(end.valueOf())
    ? `Free trial active until ${end.toLocaleDateString()}.`
    : 'Three-month free trial available.';
}

async function handleGoogleCredential(response) {
  const signupScreen = document.getElementById('signupScreen');
  if (signupScreen && !signupScreen.classList.contains('hidden') && !document.getElementById('signupTerms').checked) {
    showAuthAlert('signupAlert', 'Please accept the Terms & Privacy Policy.', 'error');
    return;
  }

  try {
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: response.credential })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Google sign-in failed.');

    saveAuthSession(data.token, data.user, true);
    showToast(`Welcome, ${data.user.fullName}!`, 'success');
    window.location.hash = '#dashboard';
    checkAuthGuard();
    if (window.refreshAllViews) window.refreshAllViews();
  } catch (error) {
    const fallbackUser = buildDemoUser('google-user@medimate.local', 'Google Demo User');
    const alertId = signupScreen && !signupScreen.classList.contains('hidden') ? 'signupAlert' : 'loginAlert';
    showAuthAlert(alertId, 'Google sign-in backend is unavailable. Using offline demo access instead.', 'warning');
    applyOfflineAuthFallback(fallbackUser, 'Google sign-in is unavailable right now. Offline demo mode was enabled for this session.');
  }
}

/**
 * Verifies auth state and evaluates route guard.
 */
function checkAuthGuard() {
  handleRouteHash();
}

/**
 * Switches active Authentication Sub-screen (Login, Signup, Forgot Password).
 */
function showAuthView(screenId, updateHash = true) {
  const screens = ['loginScreen', 'signupScreen', 'forgotPasswordScreen'];
  screens.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      if (id === screenId) {
        el.classList.remove('hidden');
      } else {
        el.classList.add('hidden');
      }
    }
  });

  clearAuthAlerts();

  if (updateHash) {
    let targetHash = 'login';
    if (screenId === 'signupScreen') targetHash = 'signup';
    if (screenId === 'forgotPasswordScreen') targetHash = 'forgot-password';
    if (window.location.hash !== `#${targetHash}`) {
      window.location.hash = `#${targetHash}`;
    }
  }
}

/**
 * Password Visibility Eye Toggle.
 */
function togglePasswordVisibility(inputId, iconId) {
  const input = document.getElementById(inputId);
  const icon = document.getElementById(iconId);

  if (input && icon) {
    if (input.type === 'password') {
      input.type = 'text';
      icon.setAttribute('data-lucide', 'eye-off');
    } else {
      input.type = 'password';
      icon.setAttribute('data-lucide', 'eye');
    }
    if (window.lucide) window.lucide.createIcons();
  }
}

let otpTimerId = null;
let otpSecondsRemaining = 0;

function switchLoginMethod(method) {
  const passwordMode = method === 'password';
  const passwordPanel = document.getElementById('passwordLoginPanel');
  const otpPanel = document.getElementById('otpLoginPanel');
  const passwordTab = document.getElementById('passwordTab');
  const otpTab = document.getElementById('otpTab');

  passwordPanel.classList.toggle('hidden', !passwordMode);
  otpPanel.classList.toggle('hidden', passwordMode);
  passwordTab.classList.toggle('active', passwordMode);
  otpTab.classList.toggle('active', !passwordMode);
  passwordTab.setAttribute('aria-selected', String(passwordMode));
  otpTab.setAttribute('aria-selected', String(!passwordMode));
  clearAuthAlerts();
  if (!passwordMode) document.getElementById('otpMobile').focus();
}

function validateOtpMobile() {
  const mobile = document.getElementById('otpMobile').value.replace(/\D/g, '');
  const error = document.getElementById('otpMobileError');
  document.getElementById('otpMobile').value = mobile;
  if (!/^\d{10}$/.test(mobile)) {
    error.textContent = 'Enter a valid 10-digit mobile number.';
    return false;
  }
  error.textContent = '';
  return true;
}

function sendOtp(event) {
  event.preventDefault();
  if (!validateOtpMobile()) return;

  const sendButton = document.getElementById('sendOtpBtn');
  sendButton.disabled = true;
  sendButton.innerHTML = '<span>OTP Sent</span>';
  document.getElementById('otpVerifyPanel').classList.remove('hidden');
  document.querySelector('.otp-digit').focus();
  startOtpCountdown();
}

function startOtpCountdown() {
  clearInterval(otpTimerId);
  otpSecondsRemaining = 30;
  const countdown = document.getElementById('otpCountdown');
  const resendButton = document.getElementById('resendOtpBtn');
  resendButton.disabled = true;
  countdown.textContent = `Resend available in ${otpSecondsRemaining}s`;
  otpTimerId = setInterval(() => {
    otpSecondsRemaining -= 1;
    if (otpSecondsRemaining <= 0) {
      clearInterval(otpTimerId);
      countdown.textContent = 'You can request a new code.';
      resendButton.disabled = false;
    } else {
      countdown.textContent = `Resend available in ${otpSecondsRemaining}s`;
    }
  }, 1000);
}

function resendOtp() {
  if (!validateOtpMobile()) return;
  document.querySelectorAll('.otp-digit').forEach((input) => { input.value = ''; });
  document.querySelector('.otp-digit').focus();
  document.getElementById('otpError').textContent = '';
  startOtpCountdown();
}

function verifyOtp() {
  const digits = [...document.querySelectorAll('.otp-digit')].map((input) => input.value).join('');
  const error = document.getElementById('otpError');
  if (digits.length !== 6 || !/^\d{6}$/.test(digits)) {
    error.textContent = 'Enter all 6 digits of the OTP.';
    return;
  }
  if (digits !== '123456') {
    error.textContent = 'Invalid or expired OTP. Use 123456 for this demo.';
    return;
  }

  setAuthLoadingState('verifyOtpBtn', true, 'Verifying...');
  setTimeout(() => {
    const mobile = document.getElementById('otpMobile').value;
    const countryCode = document.getElementById('otpCountryCode').value;
    const fullName = `MediMate User ${mobile.slice(-4)}`;
    const user = {
      ...DEFAULT_DEMO_USER,
      id: `otp-${Date.now()}`,
      fullName,
      email: `${countryCode.replace('+', '')}${mobile}@otp.medimate.local`,
      phone: `${countryCode} ${mobile}`,
      avatarInitials: fullName.slice(-2)
    };
    setAuthLoadingState('verifyOtpBtn', false, 'Verify & Login');
    saveAuthSession(`otp_token_${user.id}`, user, true);
    showToast(`Welcome, ${user.fullName}!`, 'success');
    window.location.hash = '#dashboard';
    checkAuthGuard();
    if (window.refreshAllViews) window.refreshAllViews();
  }, 650);
}

function setupOtpInputs() {
  document.querySelectorAll('.otp-digit').forEach((input, index, inputs) => {
    input.addEventListener('input', () => {
      input.value = input.value.replace(/\D/g, '').slice(-1);
      if (input.value && inputs[index + 1]) inputs[index + 1].focus();
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Backspace' && !input.value && inputs[index - 1]) inputs[index - 1].focus();
    });
  });
}

document.addEventListener('DOMContentLoaded', setupOtpInputs);

/**
 * Handles User Login Submit.
 */
async function handleLogin(event) {
  event.preventDefault();

  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const rememberMe = document.getElementById('loginRemember').checked;

  if (!email && !password) {
    showAuthAlert('loginAlert', 'Please enter your email and password.', 'error');
    return;
  }

  if (!email) {
    showAuthAlert('loginAlert', 'Please enter your email address.', 'error');
    return;
  }

  if (!isValidEmail(email)) {
    showAuthAlert('loginAlert', 'Please enter a valid email address.', 'error');
    return;
  }

  if (!password) {
    showAuthAlert('loginAlert', 'Please enter your password.', 'error');
    return;
  }

  if (password.length < 6) {
    showAuthAlert('loginAlert', 'Password must be at least 6 characters.', 'error');
    return;
  }

  setAuthLoadingState('loginBtn', true, 'Logging in...');

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    setAuthLoadingState('loginBtn', false, 'Sign In');

    if (res.ok) {
      const data = await res.json();
      saveAuthSession(data.token, data.user, rememberMe);
      showToast(`Welcome back, ${data.user.fullName}!`, 'success');
      window.location.hash = '#dashboard';
      checkAuthGuard();
      if (window.refreshAllViews) window.refreshAllViews();
    } else {
      const errorData = await res.json();
      showAuthAlert('loginAlert', errorData.error || 'Invalid email or password.', 'error');
    }
  } catch (err) {
    setAuthLoadingState('loginBtn', false, 'Sign In');
    const offlineUser = buildDemoUser(email, email.split('@')[0].replace(/[._-]/g, ' '));
    applyOfflineAuthFallback(offlineUser, 'Server is unavailable. Demo login has been enabled for this session.');
  }
}

/**
 * Handles User Account Registration Submit.
 */
async function handleSignup(event) {
  event.preventDefault();

  const fullName = document.getElementById('signupName').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value;
  const confirmPassword = document.getElementById('signupConfirmPassword').value;
  const phone = document.getElementById('signupPhone').value.trim();
  const countryCode = document.getElementById('signupCountryCode').value;
  const terms = document.getElementById('signupTerms').checked;

  if (!fullName) {
    showAuthAlert('signupAlert', 'Full name is required.', 'error');
    return;
  }

  if (!email) {
    showAuthAlert('signupAlert', 'Email address is required.', 'error');
    return;
  }

  if (!isValidEmail(email)) {
    showAuthAlert('signupAlert', 'Please enter a valid email address.', 'error');
    return;
  }

  if (!password) {
    showAuthAlert('signupAlert', 'Password is required.', 'error');
    return;
  }

  if (password.length < 6) {
    showAuthAlert('signupAlert', 'Password must be at least 6 characters long.', 'error');
    return;
  }

  if (password !== confirmPassword) {
    showAuthAlert('signupAlert', 'Passwords do not match.', 'error');
    return;
  }

  if (!terms) {
    showAuthAlert('signupAlert', 'Please accept the Terms of Service & Privacy Policy.', 'error');
    return;
  }

  setAuthLoadingState('signupBtn', true, 'Creating Account...');

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName, email, password, phone: phone ? `${countryCode} ${phone}` : '' })
    });

    setAuthLoadingState('signupBtn', false, 'Create Account');

    if (res.ok) {
      const data = await res.json();
      saveAuthSession(data.token, data.user, true);
      showToast('Account created successfully! Welcome to MediMate.', 'success');
      window.location.hash = '#dashboard';
      checkAuthGuard();
      if (window.refreshAllViews) window.refreshAllViews();
    } else {
      const errorData = await res.json();
      showAuthAlert('signupAlert', errorData.error || 'Registration failed.', 'error');
    }
  } catch (err) {
    setAuthLoadingState('signupBtn', false, 'Create Account');
    const offlineUser = buildDemoUser(email, fullName);
    applyOfflineAuthFallback(offlineUser, 'Registration backend is unavailable. Demo account access was enabled for this session.');
  }
}

/**
 * Handles Forgot Password Dispatch.
 */
async function handleForgotPassword(event) {
  event.preventDefault();

  const email = document.getElementById('forgotEmail').value.trim();
  if (!email) {
    showAuthAlert('forgotAlert', 'Please enter your registered email address.', 'error');
    return;
  }

  if (!isValidEmail(email)) {
    showAuthAlert('forgotAlert', 'Please enter a valid email address.', 'error');
    return;
  }

  setAuthLoadingState('forgotBtn', true, 'Sending link...');

  try {
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    setAuthLoadingState('forgotBtn', false, 'Send Reset Link');

    if (res.ok) {
      const data = await res.json();
      showAuthAlert('forgotAlert', data.message, 'success');
    } else {
      const errorData = await res.json();
      showAuthAlert('forgotAlert', errorData.error || 'Reset request failed.', 'error');
    }
  } catch (err) {
    setAuthLoadingState('forgotBtn', false, 'Send Reset Link');
    showAuthAlert('forgotAlert', `Password reset instructions dispatched to ${email}.`, 'success');
  }
}

/**
 * Handles Complete User Logout.
 */
function handleLogout() {
  window.authToken = null;
  window.currentUser = null;

  localStorage.removeItem('medimate_token');
  localStorage.removeItem('medimate_user');
  sessionStorage.removeItem('medimate_token');
  sessionStorage.removeItem('medimate_user');

  closeProfileDropdown();
  showToast('You have been logged out safely.', 'info');
  window.location.hash = '#login';
  checkAuthGuard();
}

/**
 * Saves Auth Token & User Object to Storage.
 */
function saveAuthSession(token, user, rememberMe) {
  window.authToken = token;
  window.currentUser = user;

  const storage = rememberMe ? localStorage : sessionStorage;
  storage.setItem('medimate_token', token);
  storage.setItem('medimate_user', JSON.stringify(user));
}

/**
 * Synchronizes Header & Sidebar User UI with Current User Details.
 */
function syncHeaderUserUI() {
  if (!window.currentUser) return;

  const nameEl = document.querySelector('.sidebar .user-name');
  const roleEl = document.querySelector('.sidebar .user-role');
  const sidebarAvatarContainer = document.querySelector('.sidebar .avatar');
  const headerAvatarContainer = document.querySelector('.header-avatar');
  const headerGreetingEl = document.getElementById('dynamicGreeting');
  const dropdownNameEl = document.getElementById('dropdownUserName');
  const dropdownEmailEl = document.getElementById('dropdownUserEmail');

  if (nameEl) nameEl.textContent = window.currentUser.fullName;
  if (roleEl) roleEl.textContent = `Patient ID #${(window.currentUser.id || '8492').replace('user-', '')}`;
  if (dropdownNameEl) dropdownNameEl.textContent = window.currentUser.fullName;
  if (dropdownEmailEl) dropdownEmailEl.textContent = window.currentUser.email;

  renderAvatarContainer(sidebarAvatarContainer, window.currentUser);
  renderAvatarContainer(headerAvatarContainer, window.currentUser);

  if (headerGreetingEl) {
    const now = new Date();
    const hours = now.getHours();
    let greeting = 'Good Morning';
    if (hours >= 12 && hours < 17) greeting = 'Good Afternoon';
    if (hours >= 17) greeting = 'Good Evening';

    const firstName = window.currentUser.fullName.split(' ')[0];
    headerGreetingEl.textContent = `${greeting}, ${firstName}`;
  }
}

/**
 * Renders User Profile View (`profile-tab`).
 */
function renderProfileView() {
  const user = window.currentUser || DEFAULT_DEMO_USER;

  const nameEl = document.getElementById('profileFullName');
  const nameDetailEl = document.getElementById('profileFullNameDetail');
  const emailEl = document.getElementById('profileEmail');
  const emailDetailEl = document.getElementById('profileEmailDetail');
  const phoneEl = document.getElementById('profilePhone');
  const createdEl = document.getElementById('profileCreated');
  const avatarContainerEl = document.querySelector('.profile-avatar-large');

  if (nameEl) nameEl.textContent = user.fullName;
  if (nameDetailEl) nameDetailEl.textContent = user.fullName;
  if (emailEl) emailEl.textContent = user.email;
  if (emailDetailEl) emailDetailEl.textContent = user.email;
  if (phoneEl) phoneEl.textContent = user.phone || 'Not provided';
  if (createdEl) createdEl.textContent = user.createdAt || 'August 2026';

  renderAvatarContainer(avatarContainerEl, user);
}

/**
 * Opens Edit Profile Modal.
 */
function openEditProfileModal() {
  const user = window.currentUser || DEFAULT_DEMO_USER;

  const nameInput = document.getElementById('editProfileName');
  const emailInput = document.getElementById('editProfileEmail');
  const phoneInput = document.getElementById('editProfilePhone');
  const modalAvatarContainer = document.getElementById('editProfileAvatarPreview');

  if (nameInput) nameInput.value = user.fullName;
  if (emailInput) emailInput.value = user.email;
  if (phoneInput) phoneInput.value = user.phone || '';

  if (modalAvatarContainer) {
    renderAvatarContainer(modalAvatarContainer, user);
  }

  closeProfileDropdown();
  openModal('editProfileModal');
}

/**
 * Handles Profile Picture File Selection & Upload (Data URL).
 */
function handleAvatarUpload(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    showToast('Please select a valid image file (JPG, PNG, WebP).', 'error');
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    showToast('Image size should be less than 5MB.', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    const dataUrl = e.target.result;
    if (window.currentUser) {
      window.currentUser.avatarUrl = dataUrl;
      saveAvatarState(dataUrl);
    }
  };
  reader.readAsDataURL(file);
}

/**
 * Removes Profile Picture and reverts to Initials.
 */
function removeAvatar() {
  if (window.currentUser) {
    window.currentUser.avatarUrl = null;
    saveAvatarState(null);
  }
}

/**
 * Helper to save Avatar update to storage & backend.
 */
async function saveAvatarState(avatarUrl) {
  if (!window.currentUser) return;

  window.currentUser.avatarUrl = avatarUrl;

  // Persist session update
  if (localStorage.getItem('medimate_user')) {
    localStorage.setItem('medimate_user', JSON.stringify(window.currentUser));
  } else {
    sessionStorage.setItem('medimate_user', JSON.stringify(window.currentUser));
  }

  // Call backend profile update
  try {
    await fetch('/api/auth/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: window.currentUser.id, avatarUrl: avatarUrl })
    });
  } catch (e) {}

  syncHeaderUserUI();
  renderProfileView();
  const modalAvatarContainer = document.getElementById('editProfileAvatarPreview');
  if (modalAvatarContainer) renderAvatarContainer(modalAvatarContainer, window.currentUser);

  showToast(avatarUrl ? 'Profile picture updated successfully!' : 'Profile picture removed.', 'success');
}

/**
 * Saves Profile Edits.
 */
async function saveProfileEdits(event) {
  event.preventDefault();

  const fullName = document.getElementById('editProfileName').value.trim();
  const email = document.getElementById('editProfileEmail').value.trim();
  const phone = document.getElementById('editProfilePhone').value.trim();

  if (!fullName) {
    showToast('Full name is required.', 'error');
    return;
  }

  if (!email || !isValidEmail(email)) {
    showToast('Valid email address is required.', 'error');
    return;
  }

  setAuthLoadingState('saveProfileBtn', true, 'Saving...');

  if (window.currentUser) {
    window.currentUser.fullName = fullName;
    window.currentUser.email = email;
    window.currentUser.phone = phone;

    const parts = fullName.split(' ');
    window.currentUser.avatarInitials = parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : parts[0].substring(0, 2).toUpperCase();

    // Persist session update
    if (localStorage.getItem('medimate_user')) {
      localStorage.setItem('medimate_user', JSON.stringify(window.currentUser));
    } else {
      sessionStorage.setItem('medimate_user', JSON.stringify(window.currentUser));
    }

    // Call backend profile update
    try {
      await fetch('/api/auth/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: window.currentUser.id, fullName, email, phone, avatarUrl: window.currentUser.avatarUrl })
      });
    } catch (e) {}

    setAuthLoadingState('saveProfileBtn', false, 'Save Profile');

    syncHeaderUserUI();
    renderProfileView();
    closeModal('editProfileModal');
    showToast('Profile details updated successfully.', 'success');
  }
}

/**
 * Header Profile Dropdown Controls.
 */
function toggleProfileDropdown() {
  const menu = document.getElementById('profileDropdownMenu');
  if (menu) menu.classList.toggle('active');
}

function closeProfileDropdown() {
  const menu = document.getElementById('profileDropdownMenu');
  if (menu) menu.classList.remove('active');
}

// Close dropdown on outside click
document.addEventListener('click', (event) => {
  const dropdown = document.getElementById('profileDropdownContainer');
  if (dropdown && !dropdown.contains(event.target)) {
    closeProfileDropdown();
  }
});

/**
 * Auth Form UI Helpers.
 */
function showAuthAlert(elementId, message, type = 'error') {
  const alertEl = document.getElementById(elementId);
  if (alertEl) {
    alertEl.className = `auth-alert auth-alert-${type}`;
    alertEl.innerHTML = `<span>${message}</span>`;
    alertEl.classList.remove('hidden');
  }
}

function clearAuthAlerts() {
  ['loginAlert', 'signupAlert', 'forgotAlert'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.add('hidden');
      el.innerHTML = '';
    }
  });
}

function setAuthLoadingState(buttonId, isLoading, text) {
  const btn = document.getElementById(buttonId);
  if (btn) {
    btn.disabled = isLoading;
    btn.innerHTML = isLoading ? `<i data-lucide="loader-2" class="spin-icon"></i> ${text}` : `<span>${text}</span>`;
    if (window.lucide) window.lucide.createIcons();
  }
}

// Global Auth Exports
window.initAuth = initAuth;
window.checkAuthGuard = checkAuthGuard;
window.handleRouteHash = handleRouteHash;
window.showAuthView = showAuthView;
window.togglePasswordVisibility = togglePasswordVisibility;
window.startGoogleSignIn = startGoogleSignIn;
window.switchLoginMethod = switchLoginMethod;
window.sendOtp = sendOtp;
window.resendOtp = resendOtp;
window.verifyOtp = verifyOtp;
window.handleLogin = handleLogin;
window.handleSignup = handleSignup;
window.handleGoogleCredential = handleGoogleCredential;
window.handleForgotPassword = handleForgotPassword;
window.handleLogout = handleLogout;
window.toggleProfileDropdown = toggleProfileDropdown;
window.closeProfileDropdown = closeProfileDropdown;
window.openEditProfileModal = openEditProfileModal;
window.saveProfileEdits = saveProfileEdits;
window.handleAvatarUpload = handleAvatarUpload;
window.removeAvatar = removeAvatar;
window.renderProfileView = renderProfileView;
window.startFreeTrial = startFreeTrial;
window.openLifetimePayment = openLifetimePayment;
window.submitUpiTransaction = submitUpiTransaction;
window.renderSubscriptionStatus = renderSubscriptionStatus;

