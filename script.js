/**
 * script.js
 * Handles frontend logic for AI Financial Advisor
 * - Tab switching
 * - API calls to backend
 * - Result formatting and display
 * - Stock & Mutual Fund support
 * - Chart.js interactive graphs
 */

const BASE_URL = "https://ai-financial-production.up.railway.app";
let currentStockData = null;
let currentStockAnalysis = null;
//let priceChartInstance = null; // Used to track and update the Chart.js instance
let navChartInstance = null;
let compChartInstance = null;

// ---------- Tab Switching ----------
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tabName = btn.getAttribute('data-tab');

    // Deactivate all tabs and buttons
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

    // Activate selected tab and button
    document.getElementById(tabName).classList.add('active');
    btn.classList.add('active');
  });
});

// ── Autocomplete ──────────────────────────────────────────
const symbolInput    = document.getElementById('stock-symbol');
const suggestionBox  = document.getElementById('stock-suggestions');
let debounceTimer    = null;
let selectedSymbol   = null;  // stores the exact symbol user picked

symbolInput.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  selectedSymbol = null;  // reset on new typing

  const query = symbolInput.value.trim();
  if (query.length < 2) {
    hideSuggestions();
    return;
  }

  debounceTimer = setTimeout(() => fetchSuggestions(query), 300);
});

async function fetchSuggestions(query) {
  try {
    const res  = await fetch(`${BASE_URL}/api/search-stocks?q=${encodeURIComponent(query)}`);
    const data = await res.json();

    if (!data.length) { hideSuggestions(); return; }

    suggestionBox.innerHTML = '';
    data.forEach(item => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="sug-name">${item.name}</span>
                      <span class="sug-symbol">${item.symbol}</span>`;
      li.addEventListener('mousedown', () => {
        symbolInput.value = item.symbol;   // fill input with clean symbol
        selectedSymbol    = item.symbol;
        hideSuggestions();
      });
      suggestionBox.appendChild(li);
    });

    suggestionBox.classList.remove('hidden');
  } catch (e) {
    hideSuggestions();
  }
}

function hideSuggestions() {
  suggestionBox.classList.add('hidden');
  suggestionBox.innerHTML = '';
}

// Hide when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('.autocomplete-wrapper')) hideSuggestions();
});

// ---------- Stock & Mutual Fund Analysis ----------
document.getElementById('analyze-stock-btn').addEventListener('click', async () => {
  const symbol = document.getElementById('stock-symbol').value.trim();
  const assetTypeInput = document.querySelector('input[name="asset_type"]:checked');
  const assetType = assetTypeInput ? assetTypeInput.value : 'stock';
  const exchange = document.getElementById('stock-exchange').value;
  const question = document.getElementById('stock-question').value.trim();

  if (!symbol) {
    showError('stock', 'Please enter a symbol or ticker');
    return;
  }

  showLoading('stock');
  try {
    const endpoint = assetType === 'stock' ? '/api/analyze-stock' : '/api/analyze-fund';
    const payload = assetType === 'stock'
      ? { symbol, exchange, question: question || undefined }
      : { ticker: symbol, question: question || undefined };

    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      showError('stock', data.error || `Failed to analyze ${assetType}`);
      return;
    }

    if (assetType === 'stock') {
      renderStockAnalysis(data);
    } else {
      renderFundAnalysis(data);
    }

    currentStockData = data.stock_data;
    currentStockAnalysis = data.analysis;

    document.getElementById('stock-chat-container').classList.remove('hidden');
    document.getElementById('stock-chat-history').innerHTML = '';

  } catch (error) {
    showError('stock', `Error: ${error.message}`);
  }
});

// ---------- Portfolio Analysis ----------

// ── Portfolio Auth ──────────────────────────────────────────────────────────
const PORTFOLIO_TOKEN_KEY = 'portfolio_jwt';

function getPortfolioToken() { return localStorage.getItem(PORTFOLIO_TOKEN_KEY); }

function isPortfolioUnlocked() {
    const token = getPortfolioToken();
    if (!token) return false;
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.exp * 1000 > Date.now();
    } catch { return false; }
}

function showPortfolioUnlocked() {
    document.getElementById('portfolio-locked').classList.add('hidden');
    document.getElementById('portfolio-unlocked').classList.remove('hidden');
}

function showPortfolioLocked() {
    document.getElementById('portfolio-locked').classList.remove('hidden');
    document.getElementById('portfolio-unlocked').classList.add('hidden');
    localStorage.removeItem(PORTFOLIO_TOKEN_KEY);
}

// Check on tab switch
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        if (btn.dataset.tab === 'analyze-portfolio') {
            if (isPortfolioUnlocked()) showPortfolioUnlocked();
            else showPortfolioLocked();
        }
    });
});

// Unlock button → show modal
document.getElementById('unlock-portfolio-btn').addEventListener('click', () => {
    document.getElementById('portfolio-modal').classList.remove('hidden');
    document.getElementById('portfolio-password').value = '';
    document.getElementById('modal-error').classList.add('hidden');
    setTimeout(() => document.getElementById('portfolio-password').focus(), 100);
});

document.getElementById('modal-cancel-btn').addEventListener('click', () => {
    document.getElementById('portfolio-modal').classList.add('hidden');
});

document.getElementById('portfolio-password').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('modal-login-btn').click();
});

// Login
document.getElementById('modal-login-btn').addEventListener('click', async () => {
    const password = document.getElementById('portfolio-password').value.trim();
    if (!password) return;
    try {
        const res = await fetch(`${BASE_URL}/api/portfolio-auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        const data = await res.json();
        if (res.ok && data.token) {
            localStorage.setItem(PORTFOLIO_TOKEN_KEY, data.token);
            document.getElementById('portfolio-modal').classList.add('hidden');
            showPortfolioUnlocked();
        } else {
            document.getElementById('modal-error').classList.remove('hidden');
        }
    } catch (e) {
        document.getElementById('modal-error').classList.remove('hidden');
    }
});

// Lock button
document.getElementById('lock-portfolio-btn').addEventListener('click', () => {
    showPortfolioLocked();
});

// ── Load Holdings ──────────────────────────────────────────────────────────
document.getElementById('load-holdings-btn').addEventListener('click', loadHoldings);

async function loadHoldings() {
    const token = getPortfolioToken();
    document.getElementById('holdings-loading').classList.remove('hidden');
    document.getElementById('equity-holdings-section').classList.add('hidden');
    document.getElementById('funds-holdings-section').classList.add('hidden');
    document.getElementById('portfolio-summary-cards').classList.add('hidden');
    document.getElementById('portfolio-analyze-section').classList.add('hidden');

    try {
        const res = await fetch(`${BASE_URL}/api/portfolio-data`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (!res.ok) {
            alert(data.message || 'Failed to load holdings.');
            return;
        }

        renderEquityTable(data.equity || []);
        renderFundsTable(data.mutual_funds || []);
        renderSummaryCards(data.equity || [], data.mutual_funds || []);

        document.getElementById('portfolio-summary-cards').classList.remove('hidden');
        document.getElementById('portfolio-analyze-section').classList.remove('hidden');

    } catch (e) {
        alert('Error loading holdings: ' + e.message);
    } finally {
        document.getElementById('holdings-loading').classList.add('hidden');
    }
}

function renderSummaryCards(equity, funds) {
    document.getElementById('summary-stock-count').textContent = equity.length;
    document.getElementById('summary-fund-count').textContent = funds.length;

    const equityInvested = equity.reduce((sum, h) => {
        const val = (h.purchase_price || 0) * (h.quantity || 0);
        return sum + val;
    }, 0);

    const mfInvested = funds.reduce((sum, f) => sum + (f.amount_invested || 0), 0);

    document.getElementById('summary-equity-invested').textContent =
        equityInvested > 0 ? '₹' + equityInvested.toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '—';
    document.getElementById('summary-mf-invested').textContent =
        mfInvested > 0 ? '₹' + mfInvested.toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '—';
}

function renderEquityTable(holdings) {
    const tbody = document.getElementById('equity-table-body');
    tbody.innerHTML = '';

    if (!holdings.length) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:20px;">No equity holdings found.</td></tr>`;
        document.getElementById('equity-holdings-section').classList.remove('hidden');
        return;
    }

    holdings.forEach(h => {
        const buyPrice   = h.purchase_price || 0;
        const currPrice  = h.current_price  || 0;
        const qty        = h.quantity        || 0;
        const invested   = buyPrice * qty;
        const currVal    = currPrice * qty;
        const pnl        = currPrice ? currVal - invested : null;
        const pnlPct     = (pnl !== null && invested) ? (pnl / invested * 100) : null;

        let pnlHtml = '<span class="pnl-neutral">—</span>';
        if (pnl !== null) {
            const cls   = pnl >= 0 ? 'pnl-positive' : 'pnl-negative';
            const sign  = pnl >= 0 ? '+' : '';
            pnlHtml = `<span class="${cls}">${sign}₹${Math.abs(pnl).toLocaleString('en-IN', {maximumFractionDigits:0})} (${sign}${pnlPct.toFixed(1)}%)</span>`;
        }

        const row = document.createElement('tr');
        row.innerHTML = `
            <td><span class="symbol-badge">${h.symbol}</span></td>
            <td>${h.company_name || '—'}</td>
            <td>${h.sector || '—'}</td>
            <td>${h.broker || '—'}</td>
            <td>${qty}</td>
            <td>${buyPrice ? '₹' + buyPrice.toLocaleString('en-IN') : '—'}</td>
            <td>${currPrice ? '₹' + currPrice.toLocaleString('en-IN') : '—'}</td>
            <td>${pnlHtml}</td>
            <td style="color:var(--text-muted);font-size:0.8rem;">${h.notes || '—'}</td>
        `;
        tbody.appendChild(row);
    });

    document.getElementById('equity-holdings-section').classList.remove('hidden');
}

function renderFundsTable(funds) {
    const tbody = document.getElementById('funds-table-body');
    tbody.innerHTML = '';

    if (!funds.length) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:20px;">No mutual fund holdings found.</td></tr>`;
        document.getElementById('funds-holdings-section').classList.remove('hidden');
        return;
    }

    funds.forEach(f => {
        const nav      = f.current_nav     || 0;
        const units    = f.units_purchased || 0;
        const invested = f.amount_invested || 0;
        const currVal  = nav && units ? nav * units : null;
        const pnl      = currVal ? currVal - invested : null;

        let currValHtml = '—';
        if (currVal) {
            const cls  = pnl >= 0 ? 'pnl-positive' : 'pnl-negative';
            const sign = pnl >= 0 ? '+' : '';
            currValHtml = `<span class="${cls}">₹${currVal.toLocaleString('en-IN', {maximumFractionDigits:0})}<br><small>${sign}₹${Math.abs(pnl).toLocaleString('en-IN',{maximumFractionDigits:0})}</small></span>`;
        }

        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="max-width:200px;white-space:normal;">${f.fund_name}</td>
            <td>${f.amc || '—'}</td>
            <td>${f.fund_type || '—'}</td>
            <td>${invested ? '₹' + invested.toLocaleString('en-IN') : '—'}</td>
            <td>${units || '—'}</td>
            <td>${nav ? '₹' + nav : '—'}</td>
            <td>${currValHtml}</td>
            <td>${f.sip_amount ? '₹' + f.sip_amount.toLocaleString('en-IN') : '—'}</td>
            <td>${f.expense_ratio ? f.expense_ratio + '%' : '—'}</td>
        `;
        tbody.appendChild(row);
    });

    document.getElementById('funds-holdings-section').classList.remove('hidden');
}

// ── Analyze Portfolio ──────────────────────────────────────────────────────

// Both buttons (top-level and below holdings) trigger same function
document.getElementById('analyze-portfolio-btn').addEventListener('click', runPortfolioAnalysis);
document.getElementById('analyze-portfolio-btn-2').addEventListener('click', runPortfolioAnalysis);

async function runPortfolioAnalysis() {
    const token    = getPortfolioToken();
    const question = document.getElementById('portfolio-question')?.value.trim() || '';

    showLoading('portfolio');

    try {
        const res = await fetch(`${BASE_URL}/api/analyze-portfolio`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ question: question || undefined })
        });

        const data = await res.json();

        if (!res.ok) {
            showError('portfolio', data.error || 'Analysis failed.');
            return;
        }

        renderPortfolioAnalysis(data);

    } catch (e) {
        showError('portfolio', 'Error: ' + e.message);
    }
}

// ---------- Chart Drawing Function ----------
// Keep track of chart instances so we can destroy them on new searches

function drawChart(chartData, assetName, currency, isMutualFund = false) {
    const container = document.getElementById('chart-container');
    
    // If there is no data, hide the chart container
    if (!chartData || !chartData.prices || chartData.prices.length === 0) {
        container.classList.add('hidden');
        return;
    }

    container.classList.remove('hidden');

    // ... inside drawChart ...
    const dates = chartData.dates;
    const actualPrices = chartData.prices;
    
    // SAFELY GET NIFTY PRICES
    let niftyPrices = [];
    if (chartData.benchmark_prices && chartData.benchmark_prices.length > 0) {
        niftyPrices = chartData.benchmark_prices;
    } else {
        niftyPrices = new Array(dates.length).fill(null);
    }

    // ---1. Calculate Percentage Changes ---
    // Safely find the first non-null, non-zero price to use as the base
    const baseNav = actualPrices.find(p => p !== null && p !== 0) || 1;
    const baseNifty = niftyPrices.find(p => p !== null && p !== 0) || 1; 

    const assetPercent = actualPrices.map(p => {
        if (p === null || p === undefined) return null;
        return ((p - baseNav) / baseNav) * 100;
    });

    const niftyPercent = niftyPrices.map(p => {
        if (p === null || p === undefined) return null;
        return ((p - baseNifty) / baseNifty) * 100;
    });

    // --- 2. Destroy Old Charts to Prevent Glitches ---
    if (navChartInstance) navChartInstance.destroy();
    if (compChartInstance) compChartInstance.destroy();

    // --- 3. Left Chart: Actual Price / NAV ---
    const ctxNav = document.getElementById('navChart').getContext('2d');
    const yAxisLabel = isMutualFund ? 'NAV' : 'Price';
    
    navChartInstance = new Chart(ctxNav, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: `${yAxisLabel} (${currency || 'INR'})`,
                data: actualPrices,
                borderColor: '#2563eb', // Professional blue
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                borderWidth: 2,
                fill: true,
                pointRadius: 0, 
                pointHoverRadius: 5,
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: { 
                title: { display: true, text: `Actual ${yAxisLabel} Trend` },
                legend: { display: false }
            },
            scales: { 
                x: { ticks: { maxTicksLimit: 6 } },
                y: { title: { display: true, text: `${yAxisLabel} (${currency || 'INR'})` } } 
            }
        }
    });

    // --- 4. Right Chart: Percentage Comparison vs Nifty 50 ---
    const ctxComp = document.getElementById('comparisonChart').getContext('2d');
    
    compChartInstance = new Chart(ctxComp, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [
                {
                    label: assetName,
                    data: assetPercent,
                    borderColor: '#10b981', // Green for Asset
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    tension: 0.1
                },
                {
                    label: 'Nifty 50',
                    data: niftyPercent,
                    borderColor: '#ffffff', // Gray for Benchmark
                    borderDash: [5, 5],     // Dashed line!
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    tension: 0.1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: { 
                title: { display: true, text: 'Growth vs Nifty 50 (%)' },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + context.parsed.y.toFixed(2) + '%';
                        }
                    }
                }
            },
            scales: { 
                x: { ticks: { maxTicksLimit: 6 } },
                y: { 
                    ticks: { callback: function(value) { return value + "%" } } 
                } 
            }
        }
    });
}

// ---------- Render Stock Analysis ----------
function renderStockAnalysis(data) {
  const { stock_data, analysis, chart_data } = data;

  // Draw the chart!
  //drawChart(chart_data, stock_data.company_name || stock_data.ticker, stock_data.currency);
  drawChart(data.chart_data, data.stock_data.company_name, data.stock_data.currency, false);

  let html = '<div class="analysis-card">';
  html += `<h3>${stock_data.company_name || stock_data.ticker}</h3>`;

  html += '<table class="stock-data-table">';
  html += '<thead><tr><th>Metric</th><th>Value</th></tr></thead>';
  html += '<tbody>';
  html += `<tr><td>Current Price</td><td>${formatValue(stock_data.current_price)} ${stock_data.currency || ''}</td></tr>`;
  html += `<tr><td>Day Change</td><td>${formatValue(stock_data.day_change_pct)}%</td></tr>`;
  html += `<tr><td>P/E Ratio</td><td>${formatValue(stock_data.pe_ratio)}</td></tr>`;
  html += `<tr><td>EPS</td><td>${formatValue(stock_data.eps)}</td></tr>`;
  html += `<tr><td>Market Cap</td><td>${formatValue(stock_data.market_cap)}</td></tr>`;
  html += `<tr><td>52W High/Low</td><td>${formatValue(stock_data['52_week_high'])} / ${formatValue(stock_data['52_week_low'])}</td></tr>`;
  html += '</tbody></table>';

  if (analysis.error) {
    html += `<p><strong>Error:</strong> ${analysis.error}</p>`;
  } else {
    html += `<p><strong>Executive Summary:</strong></p><p>${analysis.executive_summary}</p>`;
    html += `<p><strong>Key Metrics Commentary:</strong></p><p>${analysis.key_metrics_commentary}</p>`;

    if (analysis.risks && analysis.risks.length) {
      html += '<p><strong>Risks:</strong></p><ul>';
      analysis.risks.forEach(r => {
        const severity = r.severity ? ` <span class="risk-${r.severity.toLowerCase()}">[${r.severity}]</span>` : '';
        html += `<li>${r.risk}${severity}: ${r.detail}</li>`;
      });
      html += '</ul>';
    }

    if (analysis.opportunities && analysis.opportunities.length) {
      html += '<p><strong>Opportunities:</strong></p><ul>';
      analysis.opportunities.forEach(o => {
        html += `<li>${o.opportunity}: ${o.detail}</li>`;
      });
      html += '</ul>';
    }

    if (analysis.scenario_analysis) {
      html += '<p><strong>Scenario Analysis:</strong></p>';
      html += `<p><strong>Bull Case:</strong> ${analysis.scenario_analysis.bull_case}</p>`;
      html += `<p><strong>Base Case:</strong> ${analysis.scenario_analysis.base_case}</p>`;
      html += `<p><strong>Bear Case:</strong> ${analysis.scenario_analysis.bear_case}</p>`;
    }

    html += `<div class="recommendation">${analysis.recommendation}</div>`;
    html += `<p><strong>Rationale:</strong></p><p>${analysis.rationale}</p>`;
    html += `<p><strong>Confidence:</strong> ${analysis.confidence_level}</p>`;
  }

  html += '</div>';
  showResult('stock', html);
}

// ---------- Render Mutual Fund Analysis ----------
function renderFundAnalysis(data) {
  const { stock_data, analysis, chart_data } = data;

  // Draw the chart!
  //drawChart(chart_data, stock_data.longName || stock_data.symbol, stock_data.currency || 'INR');
  drawChart(data.chart_data, data.stock_data.longName, data.stock_data.currency, true);

  let html = '<div class="analysis-card">';
  html += `<h3>${stock_data.longName || stock_data.shortName || stock_data.symbol} (Mutual Fund/ETF)</h3>`;

  html += '<table class="stock-data-table">';
  html += '<thead><tr><th>Metric</th><th>Value</th></tr></thead>';
  html += '<tbody>';

  const currentPrice = stock_data.regularMarketPrice || stock_data.previousClose || stock_data.navPrice;
  html += `<tr><td>Current NAV</td><td>${formatValue(currentPrice)} ${stock_data.currency || 'INR'}</td></tr>`;

  if (stock_data.navDate && stock_data.navDate !== "N/A") {
    html += `<tr><td>NAV Date</td><td>${stock_data.navDate}</td></tr>`;
  }

  if (stock_data.fundHouse && stock_data.fundHouse !== "Unknown") {
    html += `<tr><td>Fund House</td><td>${stock_data.fundHouse}</td></tr>`;
  }

  // --- NEW: Display the mstarpy data directly in the table ---
  if (stock_data.category && stock_data.category !== "N/A") {
    html += `<tr><td>Category</td><td>${stock_data.category}</td></tr>`;
  }
  
  if (stock_data.aum && stock_data.aum !== "N/A") {
    html += `<tr><td>AUM (Fund Size)</td><td>${stock_data.aum}</td></tr>`;
  }
  
  if (stock_data.expense_ratio && stock_data.expense_ratio !== "N/A") {
    html += `<tr><td>Expense Ratio</td><td>${stock_data.expense_ratio}</td></tr>`;
  }
  
  if (stock_data['1y_return'] && stock_data['1y_return'] !== "N/A") {
    html += `<tr><td>1-Year Return</td><td>${stock_data['1y_return']}</td></tr>`;
  }
  
  if (stock_data['3y_return'] && stock_data['3y_return'] !== "N/A") {
    html += `<tr><td>3-Year Return</td><td>${stock_data['3y_return']}</td></tr>`;
  }
  
  if (stock_data.top_holdings && stock_data.top_holdings !== "N/A") {
    html += `<tr><td>Top Holdings</td><td>${stock_data.top_holdings}</td></tr>`;
  }
  
  html += '</tbody></table>';

  // --- Display the AI Analysis below the table ---
  if (analysis.error) {
    html += `<p><strong>Error:</strong> ${analysis.error}</p>`;
  } else {
    html += `<p><strong>AI Summary:</strong></p><p>${analysis.summary || 'No summary available'}</p>`;

    if (analysis.fund_profile) {
      html += '<p><strong>AI Fund Profile:</strong></p>';
      if (analysis.fund_profile.category) {
        html += `<p>- <strong>Category:</strong> ${analysis.fund_profile.category}</p>`;
      }
      if (analysis.fund_profile.expense_ratio) {
        html += `<p>- <strong>Expense Ratio Context:</strong> ${analysis.fund_profile.expense_ratio}</p>`;
      }
      if (analysis.fund_profile.aum) {
        html += `<p>- <strong>AUM Context:</strong> ${analysis.fund_profile.aum}</p>`;
      }
    }

    if (analysis.pros && analysis.pros.length) {
      html += '<p><strong>Pros:</strong></p><ul>';
      analysis.pros.forEach(pro => {
        html += `<li>${pro}</li>`;
      });
      html += '</ul>';
    }

    if (analysis.cons && analysis.cons.length) {
      html += '<p><strong>Cons:</strong></p><ul>';
      analysis.cons.forEach(con => {
        html += `<li>${con}</li>`;
      });
      html += '</ul>';
    }

    if (analysis.verdict) {
      html += `<div class="recommendation">${analysis.verdict}</div>`;
    }
  }

  html += '</div>';
  showResult('stock', html);
}

// ---------- Render Portfolio Analysis ----------
function renderPortfolioAnalysis(data) {
  const { portfolio_data, analysis } = data;

  let html = '<div class="analysis-card">';
  html += '<h2>Portfolio Analysis</h2>';

  html += '<table class="stock-data-table">';
  html += '<thead><tr><th>Ticker</th><th>Qty</th><th>Buy Price</th><th>Current Value</th><th>P&L</th><th>P&L %</th></tr></thead>';
  html += '<tbody>';
  portfolio_data.forEach(h => {
    const pnl = h.pnl !== 'Not available' ? formatValue(h.pnl) : 'N/A';
    const pnlPct = h.pnl_pct !== null ? `${formatValue(h.pnl_pct)}%` : 'N/A';
    html += `<tr><td>${h.ticker}</td><td>${h.quantity}</td><td>${formatValue(h.buy_price)}</td><td>${formatValue(h.current_value)}</td><td>${pnl}</td><td>${pnlPct}</td></tr>`;
  });
  html += '</tbody></table>';

  if (analysis.error) {
    html += `<p><strong>Error:</strong> ${analysis.error}</p>`;
  } else {
    html += `<p><strong>Executive Summary:</strong></p><p>${analysis.executive_summary}</p>`;
    html += `<p><strong>Diversification Assessment:</strong></p><p>${analysis.diversification_assessment}</p>`;

    if (analysis.risks && analysis.risks.length) {
      html += '<p><strong>Portfolio Risks:</strong></p><ul>';
      analysis.risks.forEach(r => {
        const severity = r.severity ? ` <span class="risk-${r.severity.toLowerCase()}">[${r.severity}]</span>` : '';
        html += `<li>${r.risk}${severity}: ${r.detail}</li>`;
      });
      html += '</ul>';
    }

    if (analysis.top_performers && analysis.top_performers.length) {
      html += '<p><strong>Top Performers:</strong></p><ul>';
      analysis.top_performers.forEach(p => {
        html += `<li><strong>${p.ticker}:</strong> ${p.reason}</li>`;
      });
      html += '</ul>';
    }

    if (analysis.underperformers && analysis.underperformers.length) {
      html += '<p><strong>Underperformers:</strong></p><ul>';
      analysis.underperformers.forEach(u => {
        html += `<li><strong>${u.ticker}:</strong> ${u.reason} → ${u.action_suggested}</li>`;
      });
      html += '</ul>';
    }

    if (analysis.rebalancing_suggestions && analysis.rebalancing_suggestions.length) {
      html += '<p><strong>Rebalancing Suggestions:</strong></p><ul>';
      analysis.rebalancing_suggestions.forEach(s => {
        html += `<li>${s.suggestion}: ${s.rationale}</li>`;
      });
      html += '</ul>';
    }

    html += `<div class="recommendation">${analysis.overall_recommendation}</div>`;
    html += `<p><strong>Confidence:</strong> ${analysis.confidence_level}</p>`;
  }

  html += '</div>';
  showResult('portfolio', html);
}

// ---------- Helper Functions ----------
function showLoading(type) {
  document.getElementById(`${type}-loading`).classList.remove('hidden');
  document.getElementById(`${type}-error`).classList.add('hidden');
  document.getElementById(`${type}-result`).classList.add('hidden');
  
  // Hide chart container during loading
  if(type === 'stock') {
      document.getElementById('chart-container').classList.add('hidden');
  }
}

function showError(type, message) {
  document.getElementById(`${type}-loading`).classList.add('hidden');
  document.getElementById(`${type}-error`).textContent = message;
  document.getElementById(`${type}-error`).classList.remove('hidden');
  document.getElementById(`${type}-result`).classList.add('hidden');
}

function showResult(type, html) {
  document.getElementById(`${type}-loading`).classList.add('hidden');
  document.getElementById(`${type}-error`).classList.add('hidden');
  document.getElementById(`${type}-result`).innerHTML = html;
  document.getElementById(`${type}-result`).classList.remove('hidden');
}

function formatValue(value) {
  if (value === null || value === undefined || value === 'Not available') {
    return '—';
  }
  if (typeof value === 'number') {
    return value.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  }
  return value;
}

// ---------- Market Movers Ticker ----------

// Helper function to trigger an analysis programmatically
function triggerStockAnalysis(symbol) {
    // 1. Switch to the Asset tab if we aren't there already
    document.querySelector('[data-tab="analyze-asset"]').click();
    
    // 2. Select the "Stock" radio button
    const stockRadio = document.getElementById('asset-stock');
    stockRadio.checked = true;
    
    // If you have a toggleUI function, call it so the exchange dropdown appears
    if (typeof toggleUI === 'function') {
        toggleUI();
    }
    
    // 3. Fill in the input fields
    document.getElementById('stock-symbol').value = symbol;
    document.getElementById('stock-exchange').value = 'NSE'; // Default to NSE
    document.getElementById('stock-question').value = ''; // Clear question
    
    // 4. Click the analyze button!
    document.getElementById('analyze-stock-btn').click();
    
    // 5. Scroll down to the loading indicator
    document.getElementById('stock-loading').scrollIntoView({ behavior: 'smooth' });
}

// ==========================================
// NEW: SECTOR MARKET SCANNER
// ==========================================

// Fetch and render gainers/losers for the selected sector
async function loadSectorMovers(sector = 'NIFTY_50') {
    try {
        const response = await fetch(`${BASE_URL}/api/market-movers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sector: sector })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            console.error("Failed to fetch sector data:", data);
            document.getElementById('sector-gainers-list').innerHTML = '<span class="scanner-loading">Error loading data</span>';
            document.getElementById('sector-losers-list').innerHTML = '<span class="scanner-loading">Error loading data</span>';
            return;
        }
        
        const gainersContainer = document.getElementById('sector-gainers-list');
        const losersContainer = document.getElementById('sector-losers-list');
        
        gainersContainer.innerHTML = '';
        losersContainer.innerHTML = '';
        
        // Helper function to truncate long company names
        const truncateName = (name) => name.length > 18 ? name.substring(0, 18) + '...' : name;
        
        // Render Gainers
        if (data.gainers && data.gainers.length > 0) {
            data.gainers.forEach(stock => {
                const btn = document.createElement('button');
                btn.className = 'sector-mover-btn gainer';
                btn.title = stock.name;
                
                btn.innerHTML = `
                    <div class="sm-content">
                        <div class="sm-row">
                            <strong class="sm-symbol">${stock.symbol}</strong>
                            <span class="sm-change sm-change-up">+${stock.change}%</span>
                        </div>
                        <div class="sm-name">${truncateName(stock.name)}</div>
                    </div>
                `;
                btn.onclick = () => triggerStockAnalysis(stock.symbol);
                gainersContainer.appendChild(btn);
            });
        }
        
        // Render Losers
        if (data.losers && data.losers.length > 0) {
            data.losers.forEach(stock => {
                const btn = document.createElement('button');
                btn.className = 'sector-mover-btn loser';
                btn.title = stock.name;
                
                btn.innerHTML = `
                    <div class="sm-content">
                        <div class="sm-row">
                            <strong class="sm-symbol">${stock.symbol}</strong>
                            <span class="sm-change sm-change-down">${stock.change}%</span>
                        </div>
                        <div class="sm-name">${truncateName(stock.name)}</div>
                    </div>
                `;
                btn.onclick = () => triggerStockAnalysis(stock.symbol);
                losersContainer.appendChild(btn);
            });
        }
    } catch (error) {
        console.error("Failed to load sector movers:", error);
        document.getElementById('sector-gainers-list').innerHTML = '<span class="scanner-loading">Unavailable</span>';
        document.getElementById('sector-losers-list').innerHTML = '<span class="scanner-loading">Unavailable</span>';
    }
}

// Add event listener to sector dropdown
document.getElementById('sector-select').addEventListener('change', (e) => {
    loadSectorMovers(e.target.value);
});



// ---------- Follow-up Chat ----------
document.getElementById('ask-followup-btn').addEventListener('click', async () => {
  const inputEl = document.getElementById('followup-question');
  const question = inputEl.value.trim();
  if (!question) return;

  const historyBox = document.getElementById('stock-chat-history');

  historyBox.innerHTML += `<p><strong>You:</strong> ${question}</p>`;
  inputEl.value = '';

  document.getElementById('followup-loading').classList.remove('hidden');

  try {
    const response = await fetch(`${BASE_URL}/api/ask-stock-question`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stock_data: currentStockData,
        analysis: currentStockAnalysis,
        question: question
      })
    });

    const result = await response.json();
    document.getElementById('followup-loading').classList.add('hidden');

    if (!response.ok) {
      historyBox.innerHTML += `<p><strong>Error:</strong> ${result.error}</p>`;
      return;
    }

    const formattedAnswer = result.answer.replace(/\n/g, '<br>');
    historyBox.innerHTML += `<p><strong>AI:</strong> ${formattedAnswer}</p>`;
    historyBox.scrollTop = historyBox.scrollHeight;

    } catch (error) {
    document.getElementById('followup-loading').classList.add('hidden');
    historyBox.innerHTML += `<p><strong>Error:</strong> ${error.message}</p>`;
  }
});
// ── Market Ticker ──────────────────────────────────────
async function loadMarketTicker() {
    try {
        const res  = await fetch(`${BASE_URL}/api/market-ticker`);
        const data = await res.json();

        if (!data.indices || data.indices.length === 0) return;

        // Build items (duplicate for seamless infinite scroll)
        const items = data.indices.map(idx => {
            const sign      = idx.change >= 0 ? "+" : "";
            const direction = idx.direction;
            return `
                <span class="ticker-item">
                    <span class="ticker-label">${idx.emoji} ${idx.label}</span>
                    <span class="ticker-price">${idx.closing.toLocaleString('en-IN')}</span>
                    <span class="ticker-change ${direction}">
                        ${sign}${idx.change} (${sign}${idx.change_pct}%)
                    </span>
                </span>
            `;
        }).join('<span class="ticker-divider">|</span>');

        // Duplicate content for seamless loop
        const track = document.getElementById('tickerTrack');
        track.innerHTML = items + items;

    } catch (err) {
        console.error('Ticker load failed:', err);
        document.getElementById('tickerTrack').innerHTML =
            '<span class="ticker-loading">Market data unavailable</span>';
    }
}

// ── AI Market Advisor Chat ──────────────────────────────
const advisorHistory = []; // Stores full conversation

function toggleAdvisorChat() {
    const chat = document.getElementById('advisorChat');
    chat.classList.toggle('open');
    if (chat.classList.contains('open')) {
        document.getElementById('advisorInput').focus();
    }
}

function appendAdvisorMessage(role, text, stocks = []) {
    const container = document.getElementById('advisorMessages');

    const msgDiv = document.createElement('div');
    msgDiv.className = `advisor-msg ${role}`;

    const bubble = document.createElement('div');
    bubble.className = 'advisor-bubble';
    bubble.innerHTML = text.replace(/\n/g, '<br>');
    msgDiv.appendChild(bubble);

    // If stocks are provided, render clickable cards below bubble
    if (stocks && stocks.length > 0) {
        const listDiv = document.createElement('div');
        listDiv.className = 'advisor-stock-list';

        stocks.forEach(stock => {
            const card = document.createElement('div');
            card.className = 'advisor-stock-card';
            card.innerHTML = `
                <div>
                    <div class="advisor-stock-symbol">📈 ${stock.symbol}</div>
                    <div class="advisor-stock-name">${stock.name}</div>
                    <div class="advisor-stock-reason">✦ ${stock.reason}</div>
                </div>
                <div class="advisor-stock-arrow">↗</div>
            `;
          card.addEventListener('click', () => {
              analyzeStockFromAdvisor(stock.symbol);
            });

            listDiv.appendChild(card);
        });

        msgDiv.appendChild(listDiv);
    }

    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
}

function showTypingIndicator() {
    const container = document.getElementById('advisorMessages');
    const typing = document.createElement('div');
    typing.className = 'advisor-msg bot advisor-typing';
    typing.id = 'advisorTyping';
    typing.innerHTML = '<div class="advisor-bubble">⏳ Thinking...</div>';
    container.appendChild(typing);
    container.scrollTop = container.scrollHeight;
}

function removeTypingIndicator() {
    const el = document.getElementById('advisorTyping');
    if (el) el.remove();
}

async function sendAdvisorMessage() {
    const input = document.getElementById('advisorInput');
    const text = input.value.trim();
    if (!text) return;

    // Show user message
    appendAdvisorMessage('user', text);
    advisorHistory.push({ role: 'user', content: text });
    input.value = '';

    // Show typing
    showTypingIndicator();

    try {
        const res = await fetch(`${BASE_URL}/api/market-advisor`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: advisorHistory })
        });

        const data = await res.json();
        removeTypingIndicator();

        if (data.error) {
            appendAdvisorMessage('bot', '❌ Sorry, something went wrong. Please try again.');
            return;
        }

        // Add bot reply to history
        advisorHistory.push({ role: 'assistant', content: data.message });

        // Show bot message + stock cards if any
        appendAdvisorMessage('bot', data.message, data.stocks);

    } catch (err) {
        removeTypingIndicator();
        appendAdvisorMessage('bot', '❌ Connection error. Please try again.');
        console.error('Advisor error:', err);
    }
}

// ── Auto-analyze if opened via stock card click ──────────
window.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const symbol   = params.get('symbol');
    const exchange = params.get('exchange');
    const auto     = params.get('autoanalyze');

    if (symbol && auto === 'true') {
        // Fill in the stock input fields and trigger analysis
        const symbolInput   = document.getElementById('stockSymbol');
        const exchangeSelect = document.getElementById('exchangeSelect');
        if (symbolInput)    symbolInput.value = symbol;
        if (exchangeSelect) exchangeSelect.value = exchange || 'NSE';

        // Trigger the analyze button after short delay
        setTimeout(() => {
            const analyzeBtn = document.getElementById('analyzeBtn');
            if (analyzeBtn) analyzeBtn.click();
        }, 800);
    }
});

function analyzeStockFromAdvisor(symbol) {
    // 1. Close the advisor chat
    const chat = document.getElementById('advisorChat');
    if (chat) chat.classList.remove('open');

    // 2. Switch to "Analyze an Asset" tab
    const assetTab = document.querySelector('[data-tab="analyze-asset"]');
    if (assetTab) assetTab.click();

    // 3. Make sure Stock radio is selected
    const stockRadio = document.getElementById('asset-stock');
    if (stockRadio) {
        stockRadio.checked = true;
        toggleUI(); // show exchange dropdown
    }

    // 4. Fill symbol input
    const symbolInput = document.getElementById('stock-symbol');
    if (symbolInput) symbolInput.value = symbol;

    // 5. Set exchange to NSE
    const exchangeSelect = document.getElementById('stock-exchange');
    if (exchangeSelect) exchangeSelect.value = 'NSE';

    // 6. Scroll to the analyzer section
    const analyzerSection = document.getElementById('analyze-asset');
    if (analyzerSection) {
        analyzerSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // 7. Trigger analysis after scroll settles
    setTimeout(() => {
        const analyzeBtn = document.getElementById('analyze-stock-btn');
        if (analyzeBtn) analyzeBtn.click();
    }, 600);
}

// Call on page load
loadSectorMovers('NIFTY_50');
document.addEventListener('DOMContentLoaded', () => {
    loadMarketTicker();
});


