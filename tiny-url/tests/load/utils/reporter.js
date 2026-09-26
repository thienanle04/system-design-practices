function getTimestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const h = pad(d.getHours());
  const min = pad(d.getMinutes());
  const s = pad(d.getSeconds());
  return `${y}-${m}-${day}T${h}-${min}-${s}`;
}

function formatDuration(ms) {
  if (ms === undefined || ms === null) return 'N/A';
  if (ms < 1) return `${(ms * 1000).toFixed(0)}µs`;
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatNumber(num) {
  if (num === undefined || num === null) return '0';
  return num.toLocaleString();
}

function formatStages(options) {
  if (!options) return null;
  if (options.stages && options.stages.length) {
    return options.stages.map((s) => `${s.target} VUs (${s.duration})`).join(' ➔ ');
  }
  if (options.scenarios) {
    const parts = [];
    for (const [k, sc] of Object.entries(options.scenarios)) {
      if (sc.stages && sc.stages.length) {
        parts.push(`${k}: ` + sc.stages.map((s) => `${s.target} VUs (${s.duration})`).join(' ➔ '));
      } else if (sc.vus) {
        parts.push(`${k}: ${sc.vus} VUs (${sc.duration || 'N/A'})`);
      }
    }
    if (parts.length) return parts.join(' | ');
  }
  return null;
}

function calculateConfiguredDuration(options) {
  if (!options) return null;
  const parseSec = (d) => {
    if (!d || typeof d !== 'string') return 0;
    const m = d.match(/(\d+)(s|m|h)/);
    if (!m) return 0;
    const val = parseInt(m[1], 10);
    if (m[2] === 's') return val;
    if (m[2] === 'm') return val * 60;
    if (m[2] === 'h') return val * 3600;
    return val;
  };
  let total = 0;
  if (options.stages) {
    total = options.stages.reduce((acc, s) => acc + parseSec(s.duration), 0);
  } else if (options.scenarios) {
    for (const sc of Object.values(options.scenarios)) {
      if (sc.stages) {
        const scTotal = sc.stages.reduce((acc, s) => acc + parseSec(s.duration), 0);
        if (scTotal > total) total = scTotal;
      } else if (sc.duration) {
        const scTotal = parseSec(sc.duration);
        if (scTotal > total) total = scTotal;
      }
    }
  }
  return total > 0 ? `${total}s` : null;
}

export function createSummaryHandler(scenarioName, scenarioMeta = {}) {
  return function handleSummary(data) {
    const timestamp = getTimestamp();
    const networkProfile = (__ENV && __ENV.NETWORK_PROFILE) ? __ENV.NETWORK_PROFILE.toLowerCase() : 'baseline';
    const isWan = networkProfile === 'wan';
    const profileLabel = isWan ? 'WAN' : 'BASELINE';
    const profileSuffix = isWan ? '-wan' : '';
    const baseName = `${scenarioName}${profileSuffix}-${timestamp}`;
    const htmlPath = `/reports/${scenarioName}/${baseName}.html`;
    const jsonPath = `/reports/${scenarioName}/${baseName}.json`;

    const metrics = data.metrics || {};
    const reqDuration = metrics.http_req_duration ? metrics.http_req_duration.values : {};
    const reqs = metrics.http_reqs ? metrics.http_reqs.values : { count: 0, rate: 0 };
    const failedReqs = metrics.http_req_failed ? metrics.http_req_failed.values : { rate: 0 };
    const iterations = metrics.iterations ? metrics.iterations.values : { count: 0 };
    const vus = metrics.vus ? metrics.vus.values : { value: 0 };
    const vusMax = metrics.vus_max ? metrics.vus_max.values : { value: 0 };

    const totalReqs = reqs.count || 0;
    const rps = (reqs.rate || 0).toFixed(1);
    const failRate = ((failedReqs.rate || 0) * 100).toFixed(2);
    const p50 = formatDuration(reqDuration.med);
    const p90 = formatDuration(reqDuration['p(90)']);
    const p95 = formatDuration(reqDuration['p(95)']);
    const p99 = formatDuration(reqDuration['p(99)']);
    const avg = formatDuration(reqDuration.avg);
    const min = formatDuration(reqDuration.min);
    const max = formatDuration(reqDuration.max);

    // Timing & Workload calculation
    const options = scenarioMeta.options || (data.options || null);
    const stagesStr = formatStages(options);
    const configuredDuration = calculateConfiguredDuration(options);
    const actualDurationMs = data.state && data.state.testRunDurationMs ? data.state.testRunDurationMs : null;
    const actualDuration = actualDurationMs !== null ? `${(actualDurationMs / 1000).toFixed(1)}s` : (configuredDuration || 'N/A');

    // Thresholds & SLA Extraction
    const thresholdRows = [];
    let allThresholdsPass = true;
    let totalThresholds = 0;
    let passedThresholds = 0;

    for (const [metricName, metricData] of Object.entries(metrics)) {
      if (metricData && metricData.thresholds) {
        for (const [expr, res] of Object.entries(metricData.thresholds)) {
          totalThresholds++;
          const isOk = Boolean(res && res.ok);
          if (isOk) {
            passedThresholds++;
          } else {
            allThresholdsPass = false;
          }
          thresholdRows.push({
            metric: metricName,
            expression: expr,
            status: isOk ? 'PASS' : 'VIOLATED',
            badgeClass: isOk ? 'badge-pass' : 'badge-fail',
          });
        }
      }
    }

    const slaStatus = totalThresholds === 0 ? 'N/A' : (allThresholdsPass ? 'PASS' : 'VIOLATED');
    const slaBadgeClass = slaStatus === 'PASS' ? 'badge-pass' : (slaStatus === 'VIOLATED' ? 'badge-fail' : 'badge-warn');

    // Scenario Metadata consolidation
    const meta = {
      scenarioName,
      title: scenarioMeta.title || scenarioName,
      networkProfile: profileLabel,
      isWan,
      targetIngress: scenarioMeta.targetIngress || 'N/A',
      targetLayer: scenarioMeta.targetLayer || 'N/A',
      adr: scenarioMeta.adr || 'N/A',
      workloadType: scenarioMeta.workloadType || 'N/A',
      notes: scenarioMeta.notes || null,
      stages: stagesStr,
      durationConfigured: configuredDuration || actualDuration,
      durationActual: actualDuration,
      vusMax: vusMax.value || 0,
      slaStatus,
      thresholds: thresholdRows,
    };

    // Attach metadata to JSON payload for downstream tooling / CI pipeline
    data.test_metadata = meta;

    // Checks summary
    let totalChecks = 0;
    let passedChecks = 0;
    const checkRows = [];

    function extractChecks(group) {
      if (!group) return;
      if (group.checks && group.checks.length) {
        for (const check of group.checks) {
          totalChecks += (check.passes + check.fails);
          passedChecks += check.passes;
          const status = check.fails === 0 ? 'PASS' : 'FAIL';
          const badgeClass = check.fails === 0 ? 'badge-pass' : 'badge-fail';
          checkRows.push(`
            <tr>
              <td><strong>${check.name}</strong></td>
              <td>${formatNumber(check.passes)}</td>
              <td>${formatNumber(check.fails)}</td>
              <td><span class="badge ${badgeClass}">${status}</span></td>
            </tr>
          `);
        }
      }
      if (group.groups && group.groups.length) {
        for (const subGroup of group.groups) {
          extractChecks(subGroup);
        }
      }
    }
    extractChecks(data.root_group);

    const checkPassRate = totalChecks > 0 ? ((passedChecks / totalChecks) * 100).toFixed(1) : '100';

    // Build standalone HTML report
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>k6 Load Test Report - ${meta.title}</title>
  <style>
    :root {
      --bg: #0d1117;
      --card-bg: #161b22;
      --border: #30363d;
      --text: #c9d1d9;
      --heading: #f0f6fc;
      --accent: #58a6ff;
      --pass: #238636;
      --fail: #da3633;
      --warn: #d29922;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      margin: 0;
      padding: 32px 20px;
    }
    .container {
      max-width: 1050px;
      margin: 0 auto;
    }
    .header {
      border-bottom: 1px solid var(--border);
      padding-bottom: 16px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      flex-wrap: wrap;
      gap: 12px;
    }
    h1 {
      margin: 0 0 6px 0;
      color: var(--heading);
      font-size: 24px;
    }
    .meta {
      font-size: 13px;
      color: #8b949e;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px;
      margin-bottom: 28px;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
    }
    .card-title {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #8b949e;
      margin-bottom: 8px;
    }
    .card-val {
      font-size: 26px;
      font-weight: 700;
      color: var(--heading);
    }
    .card-val.accent { color: var(--accent); }
    .card-val.good { color: #3fb950; }
    .card-val.bad { color: #f85149; }
    
    .spec-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
      gap: 16px;
      margin-bottom: 28px;
    }
    .spec-card {
      padding: 16px;
      overflow-x: auto;
    }
    .spec-card-header {
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--accent);
      margin-bottom: 12px;
      border-bottom: 1px solid var(--border);
      padding-bottom: 8px;
    }
    .spec-table {
      width: 100%;
      border-collapse: collapse;
      background: transparent;
      border: none;
      margin-bottom: 0;
    }
    .spec-table th, .spec-table td {
      padding: 8px 12px;
      text-align: left;
      border-bottom: 1px solid var(--border);
      font-size: 13px;
    }
    .spec-table th {
      background: #21262d;
      color: var(--heading);
      font-weight: 600;
    }
    .spec-table tr:last-child td {
      border-bottom: none;
    }
    .spec-label {
      width: 140px;
      color: #8b949e;
      font-weight: 600;
    }
    .code-tag {
      background: #21262d;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 12px;
      color: #79c0ff;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow: hidden;
    }
    th, td {
      padding: 12px 16px;
      text-align: left;
      border-bottom: 1px solid var(--border);
      font-size: 14px;
    }
    th {
      background: #21262d;
      color: var(--heading);
      font-weight: 600;
    }
    tr:last-child td { border-bottom: none; }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      font-size: 12px;
      font-weight: 600;
      border-radius: 12px;
    }
    .badge-pass { background: rgba(35, 134, 54, 0.2); color: #3fb950; border: 1px solid #238636; }
    .badge-fail { background: rgba(218, 54, 51, 0.2); color: #f85149; border: 1px solid #da3633; }
    .badge-info { background: rgba(88, 166, 255, 0.15); color: var(--accent); border: 1px solid rgba(88, 166, 255, 0.4); }
    .badge-warn { background: rgba(210, 153, 34, 0.15); color: var(--warn); border: 1px solid rgba(210, 153, 34, 0.4); }
    .section-title {
      font-size: 18px;
      color: var(--heading);
      margin: 28px 0 12px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <h1>Performance Report: ${meta.title}</h1>
        <div class="meta">Timestamp: ${timestamp} | Engine: k6 v2.3+ | Target: ${meta.targetIngress}</div>
      </div>
      <div style="display: flex; gap: 8px; align-items: center;">
        <span class="badge ${isWan ? 'badge-warn' : 'badge-info'}">
          Profile: ${profileLabel}
        </span>
        <span class="badge ${slaBadgeClass}">
          SLA: ${slaStatus}
        </span>
        <span class="badge ${parseFloat(failRate) === 0 ? 'badge-pass' : 'badge-fail'}">
          Error Rate: ${failRate}%
        </span>
      </div>
    </div>

    <!-- Section 1: Test Specifications & Workload Profile -->
    <div class="section-title">Test Specification & Workload Profile</div>
    <div class="spec-grid">
      <div class="card spec-card">
        <div class="spec-card-header">Workload & Target Topology</div>
        <table class="spec-table">
          <tbody>
            <tr><td class="spec-label">Scenario</td><td><strong>${meta.title}</strong></td></tr>
            <tr><td class="spec-label">Network Profile</td><td><span class="badge ${isWan ? 'badge-warn' : 'badge-info'}"><strong>${profileLabel}</strong></span> &nbsp;<em>(${isWan ? 'Emulated WAN via Linux tc netem' : 'Zero-Latency Localhost Baseline'})</em></td></tr>
            <tr><td class="spec-label">Target Ingress</td><td><code class="code-tag">${meta.targetIngress}</code></td></tr>
            <tr><td class="spec-label">Architecture Layer</td><td>${meta.targetLayer}</td></tr>
            <tr><td class="spec-label">ADR Reference</td><td><span class="badge badge-info">${meta.adr}</span></td></tr>
            <tr><td class="spec-label">Workload Type</td><td>${meta.workloadType}</td></tr>
            <tr><td class="spec-label">Profile / Stages</td><td><code>${meta.stages || 'N/A'}</code></td></tr>
            <tr><td class="spec-label">Duration</td><td>Configured: <strong>${meta.durationConfigured}</strong> | Actual: <strong>${meta.durationActual}</strong></td></tr>
            <tr><td class="spec-label">Max Concurrency</td><td><strong>${formatNumber(meta.vusMax)} VUs</strong></td></tr>
            ${meta.notes ? `<tr><td class="spec-label">Context / Notes</td><td><em>${meta.notes}</em></td></tr>` : ''}
          </tbody>
        </table>
      </div>

      <div class="card spec-card">
        <div class="spec-card-header" style="display: flex; justify-content: space-between; align-items: center;">
          <span>SLA & Threshold Criteria</span>
          <span class="badge ${slaBadgeClass}">SLA: ${slaStatus}</span>
        </div>
        ${thresholdRows.length ? `
        <table class="spec-table">
          <thead>
            <tr>
              <th>Metric</th>
              <th>Threshold Rule</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${thresholdRows.map((t) => `
            <tr>
              <td><code>${t.metric}</code></td>
              <td><code>${t.expression}</code></td>
              <td><span class="badge ${t.badgeClass}">${t.status}</span></td>
            </tr>
            `).join('')}
          </tbody>
        </table>
        ` : `
        <div style="color: #8b949e; padding: 20px; text-align: center; font-size: 13px;">
          No explicit thresholds defined for this scenario.
        </div>
        `}
      </div>
    </div>

    <!-- Section 2: Summary Metric Cards -->
    <div class="section-title">Key Performance Indicators</div>
    <div class="grid">
      <div class="card">
        <div class="card-title">Throughput</div>
        <div class="card-val accent">${rps} <span style="font-size: 14px; font-weight: normal;">req/s</span></div>
      </div>
      <div class="card">
        <div class="card-title">Total Requests</div>
        <div class="card-val">${formatNumber(totalReqs)}</div>
      </div>
      <div class="card">
        <div class="card-title">Latency p95</div>
        <div class="card-val good">${p95}</div>
      </div>
      <div class="card">
        <div class="card-title">Latency p99</div>
        <div class="card-val">${p99}</div>
      </div>
      <div class="card">
        <div class="card-title">Checks Passed</div>
        <div class="card-val ${checkPassRate === '100' ? 'good' : 'bad'}">${checkPassRate}%</div>
      </div>
    </div>

    <!-- Section 3: Latency Distribution Breakdown -->
    <div class="section-title">HTTP Request Duration Breakdown</div>
    <table>
      <thead>
        <tr>
          <th>Metric</th>
          <th>Min</th>
          <th>Med (p50)</th>
          <th>Avg</th>
          <th>p90</th>
          <th>p95</th>
          <th>p99</th>
          <th>Max</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>http_req_duration</strong></td>
          <td>${min}</td>
          <td>${p50}</td>
          <td>${avg}</td>
          <td>${p90}</td>
          <td><strong style="color: #3fb950;">${p95}</strong></td>
          <td><strong style="color: var(--accent);">${p99}</strong></td>
          <td>${max}</td>
        </tr>
      </tbody>
    </table>

    <!-- Section 4: Assertions & Checks -->
    ${checkRows.length ? `
    <div class="section-title">Assertions & Verification Checks</div>
    <table>
      <thead>
        <tr>
          <th>Check Name</th>
          <th>Passes</th>
          <th>Fails</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${checkRows.join('')}
      </tbody>
    </table>
    ` : ''}

    <div class="meta" style="margin-top: 32px; text-align: center;">
      Report saved immutably: <code>${htmlPath}</code> & <code>${jsonPath}</code>
    </div>
  </div>
</body>
</html>`;

    // Console output
    const consoleSummary = `
================================================================================
🚀 LOAD TEST SUMMARY: ${meta.title} [Profile: ${profileLabel}]
================================================================================
Timestamp   : ${timestamp}
Profile     : ${profileLabel} (${isWan ? 'Emulated WAN with tc netem' : 'Localhost 0ms Baseline'})
Target      : ${meta.targetIngress}
Layer & ADR : ${meta.targetLayer} (${meta.adr})
Duration    : ${meta.durationActual} (Configured: ${meta.durationConfigured}) | Max VUs: ${formatNumber(meta.vusMax)}
Stages      : ${meta.stages || 'N/A'}
SLA Status  : ${slaStatus} (${passedThresholds}/${totalThresholds} thresholds passed)
--------------------------------------------------------------------------------
Throughput  : ${rps} req/s
Total Reqs  : ${formatNumber(totalReqs)}
Failed Reqs : ${formatNumber(failedReqs.passes || 0)} (${failRate}%)
Latency     : avg=${avg} | p95=${p95} | p99=${p99} | max=${max}
Checks      : ${passedChecks}/${totalChecks} passed (${checkPassRate}%)
--------------------------------------------------------------------------------
📁 HTML Report : ${htmlPath}
📁 JSON Report : ${jsonPath}
================================================================================
`;

    return {
      [htmlPath]: html,
      [jsonPath]: JSON.stringify(data, null, 2),
      stdout: consoleSummary,
    };
  };
}
