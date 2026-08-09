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
let priceChartInstance = null; // Used to track and update the Chart.js instance

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

// ---------- Chart Drawing Function ----------
function drawChart(chartData, assetName, currency) {
    const container = document.getElementById('chart-container');
    const ctx = document.getElementById('priceChart').getContext('2d');

    // If there is no data, hide the chart container
    if (!chartData || !chartData.prices || chartData.prices.length === 0) {
        container.classList.add('hidden');
        return;
    }

    container.classList.remove('hidden');

    // Destroy the old chart if it exists so they don't overlap
    if (priceChartInstance) {
        priceChartInstance.destroy();
    }

    // Create the new beautiful line chart
    priceChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.dates,
            datasets: [{
                label: `${assetName} Price (${currency || 'INR'})`,
                data: chartData.prices,
                borderColor: '#2563eb', // Professional blue
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                borderWidth: 2,
                pointRadius: 0, // Hides the dots to make the line smooth
                pointHoverRadius: 5,
                fill: true,
                tension: 0.1 // Slight curve
            }]
        },
        options: {
            responsive: true,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: { display: false }, // Hide legend to save space
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Price: ${context.parsed.y.toFixed(2)} ${currency || ''}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    ticks: { maxTicksLimit: 6 } // Only show a few dates on the X axis
                },
                y: { display: true }
            }
        }
    });
}

// ---------- Render Stock Analysis ----------
function renderStockAnalysis(data) {
  const { stock_data, analysis, chart_data } = data;

  // Draw the chart!
  drawChart(chart_data, stock_data.company_name || stock_data.ticker, stock_data.currency);

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
  drawChart(chart_data, stock_data.longName || stock_data.symbol, stock_data.currency || 'INR');

  let html = '<div class="analysis-card">';
  html += `<h3>${stock_data.longName || stock_data.shortName || stock_data.symbol} (Mutual Fund/ETF)</h3>`;

  html += '<table class="stock-data-table">';
  html += '<thead><tr><th>Metric</th><th>Value</th></tr></thead>';
  html += '<tbody>';

  const currentPrice = stock_data.regularMarketPrice || stock_data.previousClose || stock_data.navPrice;
  html += `<tr><td>Current Price / NAV</td><td>${formatValue(currentPrice)} ${stock_data.currency || 'INR'}</td></tr>`;

  if (stock_data.yield) {
    const yieldPct = (stock_data.yield * 100).toFixed(2) + '%';
    html += `<tr><td>Yield</td><td>${yieldPct}</td></tr>`;
  }

  if (stock_data.ytdReturn) {
    const ytdReturn = (stock_data.ytdReturn * 100).toFixed(2) + '%';
    html += `<tr><td>YTD Return</td><td>${ytdReturn}</td></tr>`;
  }

  if (stock_data.total
