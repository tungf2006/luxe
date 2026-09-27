/**
 * @file Onboarding page view — renders the 4-step onboarding flow
 * and manages step navigation, state, and submission.
 */

import {
  onboardingHTML,
  completeOnboarding,
} from './onboardingView.js';
import { getCurrentUser, getProfile } from '../../services/authService.js';

let _container = null;
let _state = {};

function render(currentStep) {
  _state._step = currentStep;
  _container.innerHTML = onboardingHTML(_state);
  attachStepEvents();
}

function attachStepEvents() {
  const step = _state._step || 0;
  const maxStep = 3;

  /* ---- Back button ---- */
  const backBtn = _container.querySelector('#onboarding-back');
  if (backBtn) {
    backBtn.onclick = () => {
      if (step > 0) render(step - 1);
    };
  }

  /* ---- Skip link ---- */
  const skipLink = _container.querySelector('#onboarding-skip');
  if (skipLink) {
    skipLink.onclick = async (e) => {
      e.preventDefault();
      await submitOnboarding();
    };
  }

  /* ---- Next / Complete button ---- */
  const nextBtn = _container.querySelector('#onboarding-next');
  const nextBtnText = nextBtn.querySelector('.btn-text');

  if (step === maxStep) {
    nextBtnText.textContent = 'Hoàn thành';
    nextBtn.onclick = async () => {
      nextBtn.disabled = true;
      await submitOnboarding();
    };
  } else {
    nextBtnText.textContent = 'Tiếp theo';
    nextBtn.onclick = () => {
      saveStep(step);
      render(step + 1);
    };
  }
}

function saveStep(step) {
  if (step === 0) {
    _state.fullName = _container.querySelector('#onboarding-name')?.value || '';
    const termsChecked = _container.querySelector('#onboarding-onboarding-complete')?.checked || false;
    _state.onboardingComplete = termsChecked;
  }
  if (step === 1) {
    _state.currency = _container.querySelector('#onboarding-currency')?.value || 'VND';
  }
  if (step === 2) {
    const skipAccount = _container.querySelector('#onboarding-skip-account')?.checked || false;
    if (!skipAccount) {
      _state.accountName = _container.querySelector('#onboarding-account-name')?.value || '';
      _state.initialAccountType = _container.querySelector('#onboarding-account-type')?.value || 'checking';
      _state.initialBalance = _container.querySelector('#onboarding-account-balance')?.value || '';
    }
  }
  if (step === 3) {
    _state.useGoal = _container.querySelector('#onboarding-selected-goal')?.value || '';
  }
}

async function submitOnboarding() {
  const user = getCurrentUser();
  if (!user?.id) {
    _container.innerHTML = '<p class="auth-subtitle">Vui lòng đăng nhập lại.</p>';
    return;
  }

  const { errors } = await completeOnboarding(user.id, _state);
  if (errors.length > 0) {
    console.error('[onboarding] Errors:', errors);
  }

  localStorage.setItem('luxe-onboarding-complete', 'true');
  window.location.hash = '#dashboard';
  window.location.reload();
}

export async function renderOnboarding(container) {
  _container = container;
  _state = {};

  const saved = localStorage.getItem('luxe-onboarding');
  if (saved) {
    try { _state = JSON.parse(saved); } catch {}
  }

  const user = getCurrentUser();
  if (user?.id) {
    const { profile } = await getProfile();
    if (profile?.full_name) _state.fullName = profile.full_name;
    if (profile?.currency) _state.currency = profile.currency;
    if (profile?.payday) _state.payDay = profile.payday;
    if (profile?.budget_period) _state.budgetPeriod = profile.budget_period;
  }

  render(0);
}
