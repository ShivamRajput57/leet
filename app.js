var body = document.getElementsByTagName("body")[0];
var form = document.createElement("form");
form.id = "user-form";

document.getElementById("add-user").addEventListener("click", function () {
  var newUserInput = document.createElement("input");
  newUserInput.type = "text";
  newUserInput.name = "username";
  newUserInput.placeholder = "Enter LeetCode username";
  document.querySelector("form").insertBefore(newUserInput, this);
});

document.querySelector("form").addEventListener("submit", function (event) {
  event.preventDefault();
  const usernames = Array.from(document.getElementsByName("username"))
    .map((input) => input.value.trim())
    .filter(Boolean);

  console.log("Submitted usernames:", usernames);
  each(usernames).catch(console.error);

  document.getElementById("user-form").reset();
  const trackBtn = document.getElementById("track-button");
  if (trackBtn) trackBtn.disabled = false;
});

// === Global tracking ===
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

  const proxyUrl = "https://cors-anywhere.herokuapp.com/";
  const targetUrl = "https://leetcode.com/graphql/";

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

  const res = await fetch(proxyUrl + targetUrl, { method: "POST", headers, body });

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
