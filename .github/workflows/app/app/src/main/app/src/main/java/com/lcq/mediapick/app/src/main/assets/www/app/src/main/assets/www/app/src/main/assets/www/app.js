const $ = (id) => document.getElementById(id);
const linkInput = $("linkInput");
const parseBtn = $("parseBtn");
const result = $("result");
const statusEl = $("status");
let quality = "best";

function detectPlatform(url) {
  if (/bilibili\.com|b23\.tv/i.test(url)) return { name: "哔哩哔哩", type: "bili" };
  if (/v\.douyin\.com|douyin\.com/i.test(url)) return { name: "抖音", type: "douyin" };
  if (/kuaishou\.com|kwaixiaodian/i.test(url)) return { name: "快手", type: "kuaishou" };
  if (/youtube\.com|youtu\.be/i.test(url)) return { name: "YouTube", type: "youtube" };
  return { name: "通用", type: "generic" };
}

function extractUrl(text) {
  const m = text.match(/https?:\/\/[^\s，。、）)]+/i);
  return m ? m[0] : text.trim();
}

$("pasteBtn").addEventListener("click", async () => {
  try {
    const t = await navigator.clipboard.readText();
    if (t) linkInput.value = t;
  } catch (e) { showStatus("请长按输入框手动粘贴", false); }
});

document.querySelectorAll("#qualitySeg button").forEach((b) => {
  b.addEventListener("click", () => {
    document.querySelectorAll("#qualitySeg button").forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    quality = b.dataset.q;
  });
});

function showStatus(msg, err = false) {
  statusEl.hidden = false;
  statusEl.textContent = msg;
  statusEl.className = err ? "status err" : "status";
}
function showLoading(on) {
  parseBtn.disabled = on;
  parseBtn.querySelector(".spinner").hidden = !on;
  parseBtn.querySelector(".btn-text").textContent = on ? "解析中…" : "开始提取";
}

async function parse(url) {
  const endpoints = [
    `https://www.nhanhan96.com/api/douyin?url=${encodeURIComponent(url)}`,
    `https://api.jiyon.xyz/api/douyin?url=${encodeURIComponent(url)}`,
  ];
  for (const ep of endpoints) {
    try {
      const res = await fetch(ep, { method: "GET" });
      if (!res.ok) continue;
      const data = await res.json();
      if (data && (data.video_url || data.url || (data.streams && data.streams.length))) return data;
    } catch (e) {}
  }
  throw new Error("解析失败，接口可能已失效，可更换解析源");
}

parseBtn.addEventListener("click", async () => {
  const raw = linkInput.value.trim();
  if (!raw) { showStatus("请先粘贴链接", true); return; }
  const url = extractUrl(raw);
  const plat = detectPlatform(url);
  showLoading(true);
  result.hidden = true;
  showStatus(`正在识别 ${plat.name}…`);
  try {
    const data = await parse(url);
    renderResult(data, plat);
    statusEl.hidden = true;
  } catch (e) {
    showStatus(e.message || "解析失败，请检查链接", true);
  } finally {
    showLoading(false);
  }
});

function qualityLabel() {
  return { best: "最高画质", "1080": "1080P", "720": "720P", "360": "360P" }[quality] || "最高";
}

function filterByQuality(streams, q) {
  if (q === "best") return streams;
  const target = { "1080": 1080, "720": 720, "360": 360 }[q];
  const scored = streams.map((s) => {
    const m = (s.q || "").match(/(\d{3,4})/);
    return { s, h: m ? parseInt(m[1]) : 9999 };
  }).sort((a, b) => b.h - a.h);
  const fit = scored.find((x) => x.h <= target) || scored[0];
  return fit ? [fit.s] : streams;
}

function renderResult(data, plat) {
  result.hidden = false;
  $("title").textContent = data.title || "提取完成";
  $("platform").textContent = data.platform || plat.name;
  const cover = data.cover || data.cover_url || data.thumbnail;
  const thumb = $("thumb");
  if (cover) { thumb.src = cover; thumb.style.display = "block"; }
  else { thumb.style.display = "none"; }

  let streams = data.streams || [];
  if (!streams.length) {
    const direct = data.video_url || data.url || data.play_url;
    if (direct) streams.push({ q: qualityLabel(), url: direct, type: "mp4" });
  }
  const filtered = filterByQuality(streams, quality);
  const list = $("streamList");
  list.innerHTML = "";
  filtered.forEach((s) => {
    const item = document.createElement("div");
    item.className = "stream-item";
    item.innerHTML = `
      <div class="sinfo"><div class="q">${s.q || qualityLabel()}</div>
      <div class="fmt">${s.type || "mp4"} · 点击下载</div></div>
      <a class="dl-btn" href="${s.url}" target="_blank" download>下载</a>`;
    list.appendChild(item);
  });

  const extra = $("extraBox");
  const coverLink = $("coverLink");
  const subLink = $("subLink");
  const wantCover = $("optCover").checked;
  const wantSub = $("optSub").checked;
  if (wantCover && cover) { coverLink.href = cover; coverLink.hidden = false; }
  else coverLink.hidden = true;
  if (wantSub && (data.subtitle || data.srt || data.sub_url)) {
    subLink.href = data.subtitle || data.srt || data.sub_url;
    subLink.hidden = false;
  } else subLink.hidden = true;
  extra.hidden = !(wantCover || wantSub) || (!cover && !(data.subtitle || data.srt));
}

linkInput.addEventListener("keydown", (e) => { if (e.key === "Enter") parseBtn.click(); });
