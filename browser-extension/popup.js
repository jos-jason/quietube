async function load() {
  const { enabled = true } = await chrome.storage.sync.get({ enabled: true });
  document.getElementById("enabled").checked = enabled;
}

document.getElementById("enabled").addEventListener("change", async (e) => {
  await chrome.storage.sync.set({ enabled: e.target.checked });
});

document.getElementById("openOptions").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

load();
