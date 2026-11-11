const DEFAULT_CONFIG = {
  enabled: true,
  quietubeOrigin: "https://quietube.pplx.app",
  redirectHome: false
};

async function load() {
  const config = { ...DEFAULT_CONFIG, ...(await chrome.storage.sync.get(DEFAULT_CONFIG)) };
  document.getElementById("origin").value = config.quietubeOrigin;
  document.getElementById("enabled").checked = config.enabled;
  document.getElementById("redirectHome").checked = config.redirectHome;
}

async function save() {
  const quietubeOrigin = document.getElementById("origin").value.trim();
  const enabled = document.getElementById("enabled").checked;
  const redirectHome = document.getElementById("redirectHome").checked;

  try {
    new URL(quietubeOrigin);
  } catch {
    document.getElementById("status").textContent = "Enter a valid URL (e.g. https://app.quietube.example)";
    return;
  }

  await chrome.storage.sync.set({ quietubeOrigin, enabled, redirectHome });
  const status = document.getElementById("status");
  status.textContent = "Saved. Rules updated.";
  setTimeout(() => (status.textContent = ""), 1500);
}

document.getElementById("save").addEventListener("click", save);
load();
