/**
 * script.js
 * Handles frontend logic for AI Financial Advisor
 * - Tab switching
 * - API calls to backend
 * - Result formatting and display
 * - Stock & Mutual Fund support
 */

const BASE_URL = "https://ai-financial-production.up.railway.app";
let currentStockData = null;
let currentStockAnalysis = null;

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
document.getElementById('analyze-portfolio-btn').addEventListener('click', async () => {
  const question = document.getElementById('portfolio-question').value.trim();

  showLoading('portfolio');
  try {
    const response = await fetch(`${BASE_URL}/api/analyze-portfolio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: question || undefined })
    });

    const data = await response.json();

    if (!response.ok) {
      showError('portfolio', data.error || 'Failed to analyze portfolio');
      return;
    }

    renderPortfolioAnalysis(data);
  } catch (error) {
    showError('portfolio', `Error: ${error.message}`);
  }
});

// ---------- Render Stock Analysis ----------
function renderStockAnalysis(data) {
  const { stock_data, analysis } = data;

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
  const { stock_data, analysis } = data;

  let html = '<div class="analysis-card">';
  html += `<h3>${stock_data.longName || stock_data.shortName || stock_data.symbol} (Mutual Fund/ETF)</h3>`;

  html += '<table class="stock-data-table">';
  html += '<thead><tr><th>Metric</th><th>Value</th></tr></thead>';
  html += '<tbody>';

  const currentPrice = stock_data.regularMarketPrice || stock_data.previousClose || stock_data.navPrice;
  html += `<tr><td>Current Price / NAV</td><td>${formatValue(currentPrice)} ${stock_data.currency || 'USD'}</td></tr>`;

  const yieldPct = stock_data.yield ? (stock_data.yield * 100).toFixed(2) + '%' : 'N/A';
  html += `<tr><td>Yield</td><td>${yieldPct}</td></tr>`;

  const ytdReturn = stock_data.ytdReturn ? (stock_data.ytdReturn * 100).toFixed(2) + '%' : 'N/A';
  html += `<tr><td>YTD Return</td><td>${ytdReturn}</td></tr>`;

  html += `<tr><td>Total Assets</td><td>${formatValue(stock_data.totalAssets)}</td></tr>`;
  html += '</tbody></table>';

  if (analysis.error) {
    html += `<p><strong>Error:</strong> ${analysis.error}</p>`;
  } else {
    html += `<p><strong>Summary:</strong></p><p>${analysis.summary}</p>`;

    if (analysis.fund_profile) {
      html += '<p><strong>Fund Profile:</strong></p>';
      html += `<p>- <strong>Category:</strong> ${analysis.fund_profile.category}</p>`;
      html += `<p>- <strong>Expense Ratio:</strong> ${analysis.fund_profile.expense_ratio}</p>`;
      html += `<p>- <strong>AUM Context:</strong> ${analysis.fund_profile.aum}</p>`;
    }

    html += `<p><strong>Top Holdings:</strong></p><p>${analysis.top_holdings}</p>`;

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

    html += `<div class="recommendation">${analysis.verdict}</div>`;
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
