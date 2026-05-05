const tabs = [...document.querySelectorAll('.flow-tab')];
const panels = [...document.querySelectorAll('.excel-preview')];
const flowStage = document.querySelector('.flow-stage');
const runPanel = document.querySelector('.run-panel');
const runButton = document.querySelector('#runButton');
const runStatus = document.querySelector('#runStatus');
const customerInput = document.querySelector('#customerInput');
const amountInput = document.querySelector('#amountInput');
const dataAmountCell = document.querySelector('#dataAmountCell');
const resultCustomer = document.querySelector('#resultCustomer');
const resultAmount = document.querySelector('#resultAmount');
const resultFormula = document.querySelector('#resultFormula');
const resultStatus = document.querySelector('#resultStatus');

function formatAmount(value) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function updateResult() {
  const customer = customerInput.value.trim() || 'Customer';
  const amount = Number(amountInput.value || 0);
  const formatted = formatAmount(amount);
  resultCustomer.textContent = customer;
  dataAmountCell.textContent = String(Number.isFinite(amount) ? amount : 0);
  resultAmount.textContent = formatted;
  resultFormula.textContent = formatted;
  resultStatus.textContent = amount > 1000 ? 'VIP' : 'Standard';
}

function setStep(step) {
  flowStage.dataset.activeStep = step;
  tabs.forEach((tab) => {
    const active = tab.dataset.step === step;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
  });
  panels.forEach((panel) => {
    panel.classList.toggle('is-active', panel.dataset.panel === step);
  });
}

tabs.forEach((tab) => {
  tab.addEventListener('click', () => setStep(tab.dataset.step));
});

customerInput.addEventListener('input', updateResult);
amountInput.addEventListener('input', updateResult);

runButton.addEventListener('click', async () => {
  runPanel.classList.remove('is-done');
  runStatus.textContent = 'Reading template.xlsx';
  setStep('template');
  await wait(560);
  runStatus.textContent = 'Mapping rows from data.xlsx';
  setStep('data');
  await wait(560);
  updateResult();
  runStatus.textContent = 'Rendered result.xlsx with formatting preserved.';
  runPanel.classList.add('is-done');
  setStep('result');
});

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

updateResult();
