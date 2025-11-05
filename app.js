// ===== app.js (patched) =====
var body = document.getElementsByTagName("body")[0];

// REMOVE these lines (they created a form element that was never appended):
// var form = document.createElement("form");
// form.id = "user-form";

// "Add more users" button - use the existing <form> in index.html
document.getElementById("add-user").addEventListener("click", function () {
  var newUserInput = document.createElement("input");
  newUserInput.type = "text";
  newUserInput.name = "username";
  newUserInput.placeholder = "Enter LeetCode username";
  document.querySelector("form").insertBefore(newUserInput, this);
});

document.getElementById("reset-button").addEventListener("click", function () {
  // Clear all input fields except the first one and the tables and the graph and also user table

  document.querySelectorAll("table")?.forEach(table => table.remove());

  document.getElementById("common-table")?.remove();
  document.getElementById("unique-table")?.remove();
  document.getElementById("rating-graph")?.remove();
  document.getElementById("user-data").innerHTML = "";


  const inputs = document.getElementsByName("username");
  for (let i = 1; i < inputs.length; i++) {
    inputs[i].value = "";
  }
  inputs[0].value = "";

  // Disable track button until new submission
  const trackBtn = document.getElementById("track-button");
  if (trackBtn) trackBtn.disabled = true;

}); 

document.querySelector("form").addEventListener("submit", function (event) {
  event.preventDefault();
  const usernames = Array.from(document.getElementsByName("username"))
    .map((input) => input.value.trim())
    .filter(Boolean);

  console.log("Submitted usernames:", usernames);
  each(usernames).catch(console.error);

  // draw the rating graph too (non-blocking)
  graph_each(usernames).catch(err => console.error("Graph error:", err));

  // use querySelector(form) instead of getElementById on a form that doesn't exist
  
  

  const trackBtn = document.getElementById("track-button");
  if (trackBtn) trackBtn.disabled = false;
});

// === Global tracking (your existing code) ===
let questionUnion = new Set();    // All questions solved by any user
let questionCount = new Map();    // title -> how many users solved it

async function each(usernames) {
  // Clear before each new submission
  questionUnion.clear();
  questionCount.clear();

  // Sequential fetch (simpler for debugging)
  for (const username of usernames) {
    await getUserSubmissions(username);
  }

  // ----- Compute Common + Unique sets -----
  const commonTitles = [];
  const notCommonTitles = [];

  for (const [title, count] of questionCount.entries()) {
    if (count === usernames.length) {
      commonTitles.push(title);  // solved by all
    } else {
      notCommonTitles.push(title); // solved by some, not all
    }
  }

  // Remove old tables if exist
  document.getElementById("common-table")?.remove();
  document.getElementById("unique-table")?.remove();

  // --- Common Table ---
  const commonTable = document.createElement("table");
  commonTable.id = "common-table";
  const commonHeaderRow = document.createElement("tr");
  const commonHeader = document.createElement("th");
  commonHeader.textContent = "✅ Questions Solved by ALL Users";
  commonHeaderRow.appendChild(commonHeader);
  commonTable.appendChild(commonHeaderRow);

  (commonTitles.length ? commonTitles : ["No common solved questions"])
    .sort((a, b) => a.localeCompare(b))
    .forEach((title) => {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.textContent = title;
      row.appendChild(cell);
      commonTable.appendChild(row);
    });

  body.appendChild(commonTable);

  // --- Not Common Table ---
  const uniqueTable = document.createElement("table");
  uniqueTable.id = "unique-table";
  const uniqueHeaderRow = document.createElement("tr");
  const uniqueHeader = document.createElement("th");
  uniqueHeader.textContent = "Questions NOT Solved by All Users (Unique)";
  uniqueHeaderRow.appendChild(uniqueHeader);
  uniqueTable.appendChild(uniqueHeaderRow);

  (notCommonTitles.length ? notCommonTitles : ["All questions are common"])
    .sort((a, b) => a.localeCompare(b))
    .forEach((title) => {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.textContent = title;
      row.appendChild(cell);
      uniqueTable.appendChild(row);
    });

  body.appendChild(uniqueTable);
}

async function getUserSubmissions(username) {
  try {
    const submissions = await fetchRecentAcSubmissions(username);
    console.log(`Recent submissions for ${username}:`, submissions);

    const table = document.createElement("table");
    const headerRow = document.createElement("tr");
    ["Username", "Question Title", "Submission Time"].forEach((t) => {
      const th = document.createElement("th");
      th.textContent = t;
      headerRow.appendChild(th);
    });
    table.appendChild(headerRow);

    const titlesSeenForThisUser = new Set();

    submissions.forEach((submission) => {
      const { title, timestamp } = submission;

      const row = document.createElement("tr");
      const usernameCell = document.createElement("td");
      usernameCell.textContent = username;

      const titleCell = document.createElement("td");
      titleCell.textContent = title;

      const tsCell = document.createElement("td");
      const ts = Number(timestamp) * 1000;
      tsCell.textContent = isFinite(ts)
        ? new Date(ts).toLocaleString()
        : timestamp;

      row.appendChild(usernameCell);
      row.appendChild(titleCell);
      row.appendChild(tsCell);
      table.appendChild(row);

      // ---- Track solved questions ----
      questionUnion.add(title);
      if (!titlesSeenForThisUser.has(title)) {
        titlesSeenForThisUser.add(title);
        questionCount.set(title, (questionCount.get(title) || 0) + 1);
      }
    });

    body.appendChild(table);
  } catch (error) {
    console.error("Error fetching submissions:", error);
  }
}

// === Fetch recent AC submissions (LeetCode GraphQL) ===
async function fetchRecentAcSubmissions(username, limit = 15) {
  if (!username || username.trim() === "") {
    throw new Error("Username should not be empty");
  }

  

  const headers = new Headers();
  headers.append("content-type", "application/json");
  headers.append("x-requested-with", "XMLHttpRequest");

  const body = JSON.stringify({
    query: `
      query recentAC($username: String!, $limit: Int!) {
        recentAcSubmissionList(username: $username, limit: $limit) {
          id
          title
          titleSlug
          timestamp
        }
      }
    `,
    variables: { username, limit },
  });

  const res = await fetch('/api/graphql', {

    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body
  });
  if (res.status === 403) {
    throw new Error(
      "403 (CORS blocked). Go to https://cors-anywhere.herokuapp.com/corsdemo and request temporary access, or use your own proxy."
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to fetch recent submissions (${res.status}) ${text}`);
  }

  const json = await res.json();
  if (!json?.data?.recentAcSubmissionList) {
    throw new Error("Unexpected response shape from LeetCode API");
  }
  return json.data.recentAcSubmissionList;
}

// === NEW: fetchAttendedContests (no invalid 'limit' arg) ===
async function fetchAttendedContests(username, maxResults = 200) {
  if (!username || username.trim() === "") {
    throw new Error("Username should not be empty");
  }


  const headers = new Headers();
  headers.append("content-type", "application/json");
  headers.append("x-requested-with", "XMLHttpRequest");

  const query = `
    query getUserContestHistory($username: String!) {
      userContestRankingHistory(username: $username) {
        attended
        trendDirection
        problemsSolved
        totalProblems
        finishTimeInSeconds
        rating
        ranking
        contest {
          title
          startTime
          titleSlug
        }
      }
    }
  `;

  const body = JSON.stringify({ query, variables: { username } });

  const res = await fetch('/api/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body
  });

  if (res.status === 403) {
    throw new Error("403 (CORS blocked). Request proxy access or run server-side.");
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to fetch contest history (${res.status}) ${text}`);
  }

  const json = await res.json();
  const history = json?.data?.userContestRankingHistory;
  if (!Array.isArray(history)) {
    throw new Error("Unexpected response shape from LeetCode API");
  }

  const attended = history
    .filter(item => item && item.attended === true)
    .map(item => ({
      title: item.contest?.title ?? null,
      titleSlug: item.contest?.titleSlug ?? null,
      startTimeUnix: item.contest?.startTime ?? null,
      startTimeISO: item.contest?.startTime ? new Date(item.contest.startTime * 1000).toISOString() : null,
      problemsSolved: item.problemsSolved,
      totalProblems: item.totalProblems,
      finishTimeInSeconds: item.finishTimeInSeconds,
      ratingAfterContest: item.rating,
      ranking: item.ranking,
      trendDirection: item.trendDirection
    }))
    .sort((a, b) => (a.startTimeUnix ?? 0) - (b.startTimeUnix ?? 0))
    .slice(0, maxResults);

  return attended;
}

// === NEW: graph_each - builds a union of contests and draws multi-line chart ===
async function graph_each(usernames) {
  // Remove any previous graph container and create a fresh one
  document.getElementById("rating-graph")?.remove();
  const container = document.createElement("div");
  container.id = "rating-graph";
  container.style.width = "100%";
  container.style.maxWidth = "1000px";
  container.style.margin = "16px auto";
  container.style.padding = "8px";
  document.body.appendChild(container);

  const canvas = document.createElement("canvas");
  canvas.id = "rating-chart-canvas";
  container.appendChild(canvas);

  await ensureChartJs();

  const allUsersData = [];
  for (const username of usernames) {
    try {
      const data = await fetchAttendedContests(username);
      console.log(`Attended contests for ${username}:`, data);
      allUsersData.push({ username, contests: data });
    } catch (err) {
      console.error(`Failed to fetch for ${username}:`, err);
      allUsersData.push({ username, contests: [] });
    }
  }

  // union of contests keyed by startTimeUnix + titleSlug/title
  const contestMap = new Map();
  for (const u of allUsersData) {
    for (const c of u.contests) {
      if (!c || !c.startTimeUnix) continue;
      const key = `${c.startTimeUnix}::${c.titleSlug ?? c.title}`;
      if (!contestMap.has(key)) contestMap.set(key, c);
    }
  }

  const contestArray = Array.from(contestMap.values()).sort((a, b) => (a.startTimeUnix ?? 0) - (b.startTimeUnix ?? 0));
  if (contestArray.length === 0) {
    container.innerHTML = "<p style='text-align:center;padding:18px'>No contest data to plot.</p>";
    return;
  }

  const labels = contestArray.map(c => {
    const d = c.startTimeUnix ? new Date(c.startTimeUnix * 1000) : new Date(c.startTimeISO);
    const shortDate = d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    const title = (c.title || c.titleSlug || "").replace(/Contest/gi, "Ct");
    return `${shortDate} • ${title}`;
  });

  const datasets = allUsersData.map((u, idx) => {
    const userContestMap = new Map();
    for (const c of u.contests) {
      if (!c || !c.startTimeUnix) continue;
      const key = `${c.startTimeUnix}::${c.titleSlug ?? c.title}`;
      userContestMap.set(key, c);
    }
    const data = contestArray.map(c => {
      const key = `${c.startTimeUnix}::${c.titleSlug ?? c.title}`;
      const entry = userContestMap.get(key);
      return entry ? (typeof entry.ratingAfterContest === "number" ? entry.ratingAfterContest : Number(entry.ratingAfterContest)) : null;
    });

    return {
      label: u.username,
      data,
      spanGaps: false,
      borderWidth: 2,
      tension: 0.2,
      pointRadius: 3,
      pointHoverRadius: 6,
      backgroundColor: generateColor(idx, 0.15),
      borderColor: generateColor(idx, 1),
      borderDash: (u.contests.length <= 2) ? [6, 4] : []
    };
  });

  // destroy previous Chart instance if present
  if (canvas._chartInstance) { canvas._chartInstance.destroy(); canvas._chartInstance = null; }

  const ctx = canvas.getContext("2d");
  const chart = new Chart(ctx, {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: 8 },
      plugins: {
        legend: { position: "top", labels: { boxWidth: 12, boxHeight: 6, usePointStyle: true } },
        tooltip: {
          mode: "index",
          intersect: false,
          callbacks: {
            label: function(context) {
              const val = context.parsed.y;
              return context.dataset.label + ": " + (val === null ? "—" : String(val));
            }
          }
        }
      },
      scales: {
        x: { ticks: { maxRotation: 45, minRotation: 30, autoSkip: true, maxTicksLimit: 12 }, title: { display: true, text: "Contest (date • title)" } },
        y: {
          beginAtZero: false,
          title: { display: true, text: "Rating" },
          suggestedMin: Math.max(0, Math.min(...datasets.flatMap(ds => ds.data.filter(v => v != null))) - 100),
          suggestedMax: Math.max(...datasets.flatMap(ds => ds.data.filter(v => v != null))) + 100
        }
      },
      elements: { point: { hitRadius: 8 } }
    }
  });

  canvas._chartInstance = chart;

  // Helper: load Chart.js if needed
  async function ensureChartJs() {
    if (window.Chart) return;
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js";
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Failed to load Chart.js"));
      document.head.appendChild(s);
    });
  }

  // Helper: color generator
  function generateColor(i, alpha = 1) {
    const hue = (i * 73) % 360;
    const sat = 65;
    const light = 45;
    if (alpha === 1) return `hsl(${hue} ${sat}% ${light}%)`;
    const tmp = document.createElement("canvas");
    const tctx = tmp.getContext("2d");
    tctx.fillStyle = `hsl(${hue} ${sat}% ${light}%)`;
    const rgb = tctx.fillStyle;
    return rgb.replace("rgb(", "rgba(").replace(")", `, ${alpha})`);
  }
}
