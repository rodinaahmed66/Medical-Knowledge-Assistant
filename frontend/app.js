/* ============================================================
   Medical Knowledge Assistant — frontend logic
   Vanilla JS, no build step. Talks to the existing FastAPI backend:
     POST /upload/file   (multipart form, field name: "file")
     POST /chat/ask      ({"query": "..."})
   ============================================================ */
(function () {
  "use strict";

  /* ---------------------------------------------------------------
   * API base URL
   * Priority: ?api=...  →  localStorage  →  window.MEDICAL_API_BASE  →  same origin
   * Empty string means "same origin", which is what happens when the
   * backend serves this page itself at http://localhost:8000/
   * ------------------------------------------------------------- */
  const API_BASE = (function resolveApiBase() {
    const fromQuery = new URLSearchParams(window.location.search).get("api");
    if (fromQuery) {
      try {
        window.localStorage.setItem("mka.apiBase", fromQuery);
      } catch (_) {
        /* private mode — ignore */
      }
      return fromQuery.replace(/\/+$/, "");
    }
    try {
      const stored = window.localStorage.getItem("mka.apiBase");
      if (stored) return stored.replace(/\/+$/, "");
    } catch (_) {
      /* ignore */
    }
    const injected = window.MEDICAL_API_BASE;
    return injected ? String(injected).replace(/\/+$/, "") : "";
  })();

  const MAX_SIZE_MB = 50;
  const ACCEPTED_EXT = ["pdf", "txt"];
  const ACCEPTED_MIME = ["application/pdf", "text/plain"];

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /* ----------------------------- theme ----------------------------- */
  function initTheme() {
    const root = document.documentElement;
    let saved = null;
    try {
      saved = window.localStorage.getItem("mka.theme");
    } catch (_) {
      /* ignore */
    }
    if (saved) root.setAttribute("data-theme", saved);

    $("#theme-toggle").addEventListener("click", function () {
      const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try {
        window.localStorage.setItem("mka.theme", next);
      } catch (_) {
        /* ignore */
      }
    });
  }

  /* ---------------------------- routing ---------------------------- */
  const VIEWS = ["home", "upload", "chat"];

  function currentRoute() {
    const name = (window.location.hash || "#/").replace(/^#\/?/, "").split("?")[0];
    return VIEWS.indexOf(name) !== -1 ? name : "home";
  }

  function navigate(route) {
    window.location.hash = "#/" + route;
  }

  function renderRoute() {
    const route = currentRoute();

    $$(".view").forEach(function (view) {
      view.hidden = view.getAttribute("data-view") !== route;
    });
    $$("[data-route-link]").forEach(function (link) {
      link.classList.toggle("active", link.getAttribute("data-route-link") === route);
    });

    if (route === "chat") {
      const input = $("#chat-input");
      if (input) input.focus();
    }
  }

  /* ---------------------------- upload ----------------------------- */
  /* The backend takes one file per POST /upload/file, so a multi-file
     selection is uploaded as a sequential queue: one request in flight at a
     time, with per-file progress, per-file outcome and a run summary.
     Sequential rather than parallel because indexing is server-side heavy
     (LlamaParse + embeddings) and concurrent runs hit provider rate limits. */
  function initUpload() {
    const form = $("#upload-form");
    const input = $("#file-input");
    const dropzone = $("#dropzone");
    const btn = $("#upload-btn");
    const clearBtn = $("#clear-btn");
    const progress = $("#upload-progress");
    const fill = $("#progress-fill");
    const label = $("#progress-label");
    const resultBox = $("#upload-result");
    const listBox = $("#file-list");

    // state: pending | active | done | error | invalid
    let queue = [];
    let uploading = false;
    let duplicates = 0;
    // Handle for the "auto-hide the progress bar" timer. Tracked so a new run
    // can cancel the previous run's timer — otherwise a fast follow-up upload
    // has its progress bar hidden by a timer scheduled before it started.
    let hideTimer = null;

    function validate(file) {
      const ext = (file.name.split(".").pop() || "").toLowerCase();
      const sizeMB = file.size / 1048576;
      if (ACCEPTED_EXT.indexOf(ext) === -1) return "Unsupported file type";
      if (file.type && ACCEPTED_MIME.indexOf(file.type) === -1) return "Unsupported media type";
      if (sizeMB > MAX_SIZE_MB) {
        return sizeMB.toFixed(1) + " MB exceeds the " + MAX_SIZE_MB + " MB limit";
      }
      return null;
    }

    function addFiles(fileList) {
      const incoming = Array.from(fileList || []);
      let added = 0;

      incoming.forEach(function (file) {
        // The backend derives file_id from the filename alone
        // (uuid5 of the name), so a duplicate name in the same batch would
        // just overwrite the first one. Drop it here instead.
        if (queue.some(function (entry) { return entry.file.name === file.name; })) {
          duplicates++;
          return;
        }
        const reason = validate(file);
        queue.push({
          file: file,
          state: reason ? "invalid" : "pending",
          reason: reason,
          pct: 0,
          indexing: false,
          body: null,
          error: null,
          ms: 0,
          refs: null,
        });
        added++;
      });

      renderQueue();
      if (added || duplicates) renderResult();

      // Reset so re-picking the same file fires "change" again.
      try {
        input.value = "";
      } catch (_) {
        /* some browsers refuse — ignore */
      }
    }

    function reset() {
      queue = [];
      duplicates = 0;
      uploading = false;
      if (hideTimer !== null) {
        window.clearTimeout(hideTimer);
        hideTimer = null;
      }
      listBox.innerHTML = "";
      listBox.hidden = true;
      resultBox.hidden = true;
      resultBox.innerHTML = "";
      progress.hidden = true;
      fill.style.width = "0%";
      dropzone.classList.remove("has-file");
      renderQueue();
    }

    /* ------------------------- rendering ------------------------- */
    function renderQueue() {
      const dzTitle = $("#dropzone-title");
      const dzHint = $("#dropzone-hint");

      const uploadable = queue.filter(function (e) { return e.state === "pending"; });
      const invalid = queue.filter(function (e) { return e.state === "invalid"; });
      const total = queue.length;

      if (!total) {
        dzTitle.textContent = "Drop files here, or click to browse";
        dzHint.textContent = "Accepted: .pdf, .txt · max 50 MB each";
        dropzone.classList.remove("has-file");
        btn.disabled = true;
        clearBtn.hidden = true;
        return;
      }

      dropzone.classList.add("has-file");
      dzTitle.textContent = total + (total === 1 ? " file selected" : " files selected");

      const sizeMB = queue.reduce(function (sum, e) { return sum + e.file.size; }, 0) / 1048576;
      if (invalid.length) {
        dzHint.textContent =
          sizeMB.toFixed(2) + " MB total · " + invalid.length + " need attention";
      } else {
        dzHint.textContent = sizeMB.toFixed(2) + " MB total · ready to upload";
      }

      btn.disabled = uploading || uploadable.length === 0;
      btn.textContent = uploading
        ? "Uploading…"
        : "Upload & index" + (uploadable.length ? " (" + uploadable.length + ")" : "");

      clearBtn.hidden = uploading;

      // Rows are created once and then updated in place, so progress events
      // never rebuild the DOM (which would drop focus and flicker).
      const seen = new Set();
      queue.forEach(function (entry) {
        if (!entry.refs) {
          entry.refs = buildRow(entry);
          listBox.appendChild(entry.refs.li);
        }
        seen.add(entry.refs.li);
        paintRow(entry);
      });
      Array.from(listBox.children).forEach(function (node) {
        if (!seen.has(node)) listBox.removeChild(node);
      });

      listBox.hidden = false;
    }

    function buildRow(entry) {
      const li = document.createElement("li");
      li.className = "filelist-row";

      const main = document.createElement("div");
      main.className = "filelist-main";

      const name = document.createElement("span");
      name.className = "filelist-name";
      name.textContent = entry.file.name;

      const meta = document.createElement("span");
      meta.className = "filelist-meta";
      meta.textContent = (entry.file.size / 1048576).toFixed(2) + " MB";

      main.appendChild(name);
      main.appendChild(meta);

      const badge = document.createElement("span");
      badge.className = "filelist-badge";

      const track = document.createElement("div");
      track.className = "filelist-track";
      const fillEl = document.createElement("div");
      fillEl.className = "filelist-fill";
      track.appendChild(fillEl);

      li.appendChild(main);
      li.appendChild(badge);
      li.appendChild(track);

      return { li: li, meta: meta, badge: badge, fill: fillEl };
    }

    function paintRow(entry) {
      const refs = entry.refs;
      if (!refs) return;

      refs.li.setAttribute("data-state", entry.state);

      if (entry.state === "pending") {
        refs.badge.textContent = "Queued";
        refs.meta.textContent = (entry.file.size / 1048576).toFixed(2) + " MB";
        refs.fill.style.width = "0%";
        return;
      }

      if (entry.state === "invalid") {
        refs.badge.textContent = "Skipped";
        refs.meta.textContent = entry.reason;
        refs.fill.style.width = "0%";
        return;
      }

      if (entry.state === "active") {
        refs.badge.textContent = entry.indexing ? "Indexing…" : "Uploading " + entry.pct + "%";
        refs.meta.textContent = (entry.file.size / 1048576).toFixed(2) + " MB";
        refs.fill.style.width = (entry.indexing ? 100 : entry.pct) + "%";
        return;
      }

      if (entry.state === "done") {
        const chunks = entry.body && typeof entry.body.chunks_parsed === "number" ? entry.body.chunks_parsed : 0;
        refs.badge.textContent = "Indexed";
        refs.meta.textContent = chunks + (chunks === 1 ? " chunk" : " chunks") + " · " + formatMs(entry.ms);
        refs.fill.style.width = "100%";
        return;
      }

      // error
      refs.badge.textContent = "Failed";
      refs.meta.textContent = entry.error;
      refs.meta.title = entry.error;
      refs.fill.style.width = "100%";
    }

    function formatMs(ms) {
      return ms < 1000 ? Math.round(ms) + "ms" : (ms / 1000).toFixed(1) + "s";
    }

    function renderResult() {
      const done = queue.filter(function (e) { return e.state === "done"; });
      const failed = queue.filter(function (e) { return e.state === "error"; });
      const invalid = queue.filter(function (e) { return e.state === "invalid"; });
      const total = queue.length;

      const chunks = done.reduce(function (sum, e) {
        return sum + ((e.body && e.body.chunks_parsed) || 0);
      }, 0);

      const kind = failed.length ? "err" : invalid.length || duplicates ? "info" : "ok";

      let title;
      if (!total) {
        title = "Nothing selected";
      } else if (failed.length) {
        title = "Indexed " + done.length + " of " + total + " file" + (total === 1 ? "" : "s");
      } else {
        title = "Indexed " + done.length + " file" + (done.length === 1 ? "" : "s");
      }

      const bits = [];
      if (chunks) bits.push(chunks + (chunks === 1 ? " chunk" : " chunks") + " indexed");
      if (failed.length) bits.push(failed.length + " failed");
      if (invalid.length) bits.push(invalid.length + " skipped as invalid");
      if (duplicates) bits.push(duplicates + " skipped as duplicate name" + (duplicates === 1 ? "" : "s"));

      let html =
        '<div class="alert alert-' + kind + '">' +
        '<div><span class="alert-title">' + escapeHtml(title) + "</span>";

      if (bits.length) {
        html += '<div class="alert-detail">' + escapeHtml(bits.join(" · ")) + "</div>";
      }

      if (done.length) {
        html +=
          '<div style="margin-top:12px"><button class="btn btn-ghost" id="result-go-chat" type="button">' +
          "Open Chat</button></div>";
      }

      html += "</div></div>";

      resultBox.innerHTML = html;
      resultBox.hidden = false;

      const goChat = $("#result-go-chat");
      if (goChat) {
        goChat.addEventListener("click", function () {
          navigate("chat");
        });
      }
    }

    function paintOverall(doneCount, totalCount, pct, indexing) {
      const overall = totalCount ? ((doneCount + (indexing ? 1 : pct / 100)) / totalCount) * 100 : 0;
      fill.style.width = Math.min(100, Math.round(overall)) + "%";
      label.textContent = indexing
        ? doneCount + 1 + " of " + totalCount + " · indexing…"
        : doneCount + " of " + totalCount + " · " + Math.round(overall) + "%";
    }

    /* ------------------------- uploading -------------------------- */
    function sendOne(entry) {
      return new Promise(function (resolve) {
        const data = new FormData();
        data.append("file", entry.file);

        const xhr = new XMLHttpRequest();
        xhr.open("POST", API_BASE + "/upload/file");

        xhr.upload.addEventListener("progress", function (e) {
          if (!e.lengthComputable) return;
          entry.pct = Math.round((e.loaded / e.total) * 100);
          paintRow(entry);
        });

        // Bytes are up; parse → embed → Qdrant now runs server-side, which is
        // the slow part and reports no client-side progress.
        xhr.upload.addEventListener("load", function () {
          entry.indexing = true;
          paintRow(entry);
        });

        xhr.addEventListener("load", function () {
          let body = {};
          try {
            body = JSON.parse(xhr.responseText);
          } catch (_) {
            body = { signal: "invalid_response", error: xhr.responseText };
          }
          resolve({ ok: xhr.status === 200, body: body, error: describeStatus(xhr.status, body) });
        });

        xhr.addEventListener("error", function () {
          resolve({
            ok: false,
            body: { signal: "network_error", error: "Could not reach " + (API_BASE || window.location.origin) },
            error: "Network error — could not reach the backend",
          });
        });

        xhr.addEventListener("abort", function () {
          resolve({ ok: false, body: {}, error: "Cancelled" });
        });

        xhr.send(data);
      });
    }

    async function runQueue() {
      if (uploading) return;
      const pending = queue.filter(function (e) { return e.state === "pending"; });
      if (!pending.length) return;

      uploading = true;
      // `duplicates` is deliberately not reset here — it counts names rejected
      // while building the current selection, and belongs in the final summary.
      if (hideTimer !== null) {
        window.clearTimeout(hideTimer);
        hideTimer = null;
      }
      progress.hidden = false;
      fill.style.width = "0%";
      label.textContent = "0 of " + pending.length;
      renderQueue();

      let doneCount = 0;

      for (const entry of pending) {
        entry.state = "active";
        entry.pct = 0;
        entry.indexing = false;
        entry.ms = performance.now();
        paintRow(entry);
        paintOverall(doneCount, pending.length, 0, false);

        const outcome = await sendOne(entry);
        entry.ms = performance.now() - entry.ms;

        if (outcome.ok) {
          entry.state = "done";
          entry.body = outcome.body;
        } else {
          entry.state = "error";
          entry.error = outcome.error;
        }

        doneCount++;
        paintRow(entry);
        paintOverall(doneCount, pending.length, 100, false);
      }

      uploading = false;
      renderQueue();
      renderResult();

      fill.style.width = "100%";
      label.textContent = pending.length + (pending.length === 1 ? " file done" : " files done");
      hideTimer = window.setTimeout(function () {
        progress.hidden = true;
        hideTimer = null;
      }, 1400);
    }

    function describeStatus(status, body) {
      const signal = body && body.signal ? body.signal : null;
      const map = {
        file_type_not_supported: "This file type is not supported",
        file_size_exceeded: "File exceeds the size limit",
        "file already exist": "Already in the knowledge base",
        no_chunks_produced: "No text could be extracted from this file",
        parse_failed: "The document could not be parsed",
        chunks_insert_failed: "Chunks could not be stored",
        vectors_index_failed: "Embeddings could not be indexed",
      };
      if (signal && map[signal]) return map[signal];
      if (status === 409) return "Already in the knowledge base";
      if (status === 413) return "File exceeds the size limit";
      return "Upload failed (HTTP " + status + ")";
    }

    /* --------------------------- events -------------------------- */
    input.addEventListener("change", function () {
      addFiles(input.files);
    });

    clearBtn.addEventListener("click", function () {
      reset();
    });

    ["dragenter", "dragover"].forEach(function (evt) {
      dropzone.addEventListener(evt, function (e) {
        e.preventDefault();
        dropzone.classList.add("dragging");
      });
    });
    ["dragleave", "drop"].forEach(function (evt) {
      dropzone.addEventListener(evt, function (e) {
        e.preventDefault();
        dropzone.classList.remove("dragging");
      });
    });

    dropzone.addEventListener("drop", function (e) {
      const files = e.dataTransfer && e.dataTransfer.files;
      if (files && files.length) addFiles(files);
    });

    // Keyboard support for the label-as-button
    dropzone.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        input.click();
      }
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      runQueue();
    });

    renderQueue();
  }

  /* ----------------------------- chat ------------------------------ */
  function initChat() {
    const form = $("#chat-form");
    const input = $("#chat-input");
    const btn = $("#send-btn");
    const log = $("#chat-log");

    let busy = false;

    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        form.requestSubmit();
      }
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      const query = input.value.trim();
      if (!query || busy) return;
      input.value = "";
      ask(query);
    });

    function scrollDown() {
      log.scrollTop = log.scrollHeight;
    }

    function addUser(text) {
      const wrap = document.createElement("div");
      wrap.className = "msg msg-user";
      const bubble = document.createElement("div");
      bubble.className = "bubble";
      bubble.textContent = text;
      wrap.appendChild(bubble);
      log.appendChild(wrap);
      scrollDown();
    }

    function addTyping() {
      const wrap = document.createElement("div");
      wrap.className = "msg msg-bot";
      wrap.id = "typing-msg";
      wrap.innerHTML =
        '<div class="bubble"><span class="typing"><span></span><span></span><span></span></span></div>';
      log.appendChild(wrap);
      scrollDown();
      return wrap;
    }

    function addBot(text, faithfulness) {
      const wrap = document.createElement("div");
      wrap.className = "msg msg-bot";

      let html = "";
      if (typeof faithfulness === "number" && isFinite(faithfulness)) {
        html +=
          '<div class="msg-meta"><span>Assistant</span>' +
          scoreBadge(faithfulness) +
          "</div>";
      }
      html += '<div class="bubble bubble-md">' + renderMarkdown(text) + "</div>";

      wrap.innerHTML = html;
      log.appendChild(wrap);
      scrollDown();
    }

    function scoreBadge(value) {
      const pct = Math.round(value * 100);
      const cls = value >= 0.7 ? "score-high" : value >= 0.4 ? "score-mid" : "score-low";
      return (
        '<span class="score ' + cls + '" title="Faithfulness score from the DeepEval judge">' +
        "faithfulness " + pct + "%</span>"
      );
    }

    function ask(query) {
      busy = true;
      btn.disabled = true;
      addUser(query);
      const typing = addTyping();

      fetch(API_BASE + "/chat/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query }),
      })
        .then(function (res) {
          return res
            .json()
            .catch(function () {
              return { signal: "invalid_response", error: "HTTP " + res.status };
            })
            .then(function (body) {
              return { status: res.status, body: body };
            });
        })
        .then(function (payload) {
          typing.remove();

          if (payload.status === 200 && payload.body && payload.body.answer) {
            addBot(payload.body.answer, payload.body.faithfulness_value);
            return;
          }

          const signal = payload.body && payload.body.signal;
          if (signal === "AGENT_FAILED") {
            addBot(
              "The agent failed while answering this question.\n\n" +
                (payload.body.error || "No further details were returned."),
              null
            );
          } else {
            addBot("Request failed (HTTP " + payload.status + "). Is the backend running?", null);
          }
        })
        .catch(function (err) {
          typing.remove();
          addBot(
            "Could not reach the backend at " +
              (API_BASE || window.location.origin) +
              ".\n\n" +
              (err && err.message ? err.message : String(err)),
            null
          );
        })
        .then(function () {
          busy = false;
          btn.disabled = false;
          input.focus();
        });
    }
  }

  /* --------------------------- helpers ----------------------------- */

  // Renders the Markdown subset the agent actually emits: headings, bold,
  // italic, inline code, bullet/numbered lists (one level of nesting), pipe
  // tables, blockquotes and horizontal rules.
  //
  // Every branch escapes its own text *before* substituting tags, and the
  // only tags introduced are ones written literally here. Agent output is
  // therefore never able to inject markup of its own.
  function renderMarkdown(source) {
    // Escape once up front. After this point the string can only gain the
    // literal tags written below, so no agent-supplied markup survives.
    const lines = escapeHtml(source == null ? "" : source)
      .replace(/\r\n?/g, "\n")
      .split("\n");
    const html = [];
    let i = 0;

    const flushParagraph = function (buffer) {
      if (!buffer.length) return;
      html.push("<p>" + inlineMd(buffer.join(" ")) + "</p>");
      buffer.length = 0;
    };

    const paragraph = [];

    while (i < lines.length) {
      const line = lines[i];

      if (!line.trim()) {
        flushParagraph(paragraph);
        i += 1;
        continue;
      }

      // Horizontal rule: --- or ***  (must be checked before list bullets)
      if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
        flushParagraph(paragraph);
        html.push("<hr />");
        i += 1;
        continue;
      }

      // ATX heading: ### text
      const heading = /^\s{0,3}(#{1,6})\s+(.*\S)\s*$/.exec(line);
      if (heading) {
        flushParagraph(paragraph);
        const level = Math.min(heading[1].length + 2, 6); // h1/h2 are page-level
        html.push("<h" + level + ">" + inlineMd(heading[2]) + "</h" + level + ">");
        i += 1;
        continue;
      }

      // Table: header row, delimiter row, then body rows.
      if (isTableRow(line) && i + 1 < lines.length && isTableDelimiter(lines[i + 1])) {
        flushParagraph(paragraph);
        const header = splitTableRow(line);
        i += 2;
        const body = [];
        while (i < lines.length && isTableRow(lines[i])) {
          body.push(splitTableRow(lines[i]));
          i += 1;
        }
        html.push(renderTable(header, body));
        continue;
      }

      // Blockquote: collapse consecutive "> " lines into one block.
      // The source was already escaped, so ">" arrives as "&gt;".
      if (/^\s*&gt;\s?/.test(line)) {
        flushParagraph(paragraph);
        const quoted = [];
        while (i < lines.length && /^\s*&gt;\s?/.test(lines[i])) {
          quoted.push(lines[i].replace(/^\s*&gt;\s?/, ""));
          i += 1;
        }
        html.push("<blockquote>" + inlineMd(quoted.join(" ")) + "</blockquote>");
        continue;
      }

      // Lists: a bullet or ordered marker at the current indent level.
      const bullet = /^(\s*)([-*+])\s+(.*)$/.exec(line);
      const ordered = /^(\s*)(\d+)[.)]\s+(.*)$/.exec(line);
      if (bullet || ordered) {
        flushParagraph(paragraph);
        const baseIndent = (bullet || ordered)[1].length;
        const items = [];
        while (i < lines.length) {
          const b = /^(\s*)([-*+])\s+(.*)$/.exec(lines[i]);
          const o = /^(\s*)(\d+)[.)]\s+(.*)$/.exec(lines[i]);
          if (!b && !o) break;
          const m = b || o;
          const indent = m[1].length;
          if (indent < baseIndent) break;
          let content = m[3];
          i += 1;

          // Fold continuations into this item: deeper-indented bullets, and
          // any plain line that is not itself a new marker.
          while (i < lines.length && lines[i].trim()) {
            const cb = /^(\s*)([-*+])\s+(.*)$/.exec(lines[i]);
            const co = /^(\s*)(\d+)[.)]\s+(.*)$/.exec(lines[i]);
            const cm = cb || co;
            if (cm) {
              if (cm[1].length <= baseIndent) break;
              content += " " + cm[3];
            } else {
              content += " " + lines[i].trim();
            }
            i += 1;
          }

          items.push({ ordered: !!o, text: content });
        }
        html.push(renderList(items));
        continue;
      }

      paragraph.push(line.trim());
      i += 1;
    }

    flushParagraph(paragraph);
    return html.join("");
  }

  function isTableRow(line) {
    return line.indexOf("|") !== -1 && line.trim().length > 0;
  }

  function isTableDelimiter(line) {
    return /^\s*\|?[\s:]*-[\s:|-]*\|?\s*$/.test(line) && line.indexOf("-") !== -1;
  }

  function splitTableRow(line) {
    return line
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map(function (cell) {
        return cell.trim();
      });
  }

  function renderTable(header, body) {
    const head = header
      .map(function (cell) {
        return "<th>" + inlineMd(cell) + "</th>";
      })
      .join("");
    const rows = body
      .map(function (row) {
        return (
          "<tr>" +
          header
            .map(function (_, index) {
              return "<td>" + inlineMd(row[index] || "") + "</td>";
            })
            .join("") +
          "</tr>"
        );
      })
      .join("");
    return (
      "<div class=\"md-table-wrap\"><table><thead><tr>" +
      head +
      "</tr></thead><tbody>" +
      rows +
      "</tbody></table></div>"
    );
  }

  function renderList(items) {
    let html = "";
    let openTag = null;
    items.forEach(function (item, index) {
      const tag = item.ordered ? "ol" : "ul";
      if (openTag && openTag !== tag) {
        html += "</" + openTag + ">";
        openTag = null;
      }
      if (!openTag) {
        html += "<" + tag + ">";
        openTag = tag;
      }
      html += "<li>" + inlineMd(item.text) + "</li>";
      if (index === items.length - 1) {
        html += "</" + openTag + ">";
        openTag = null;
      }
    });
    return html;
  }

  // Inline pass, applied only to already-escaped text.
  function inlineMd(escaped) {
    return escaped
      .replace(/`([^`]+)`/g, function (_, code) {
        return "<code>" + code + "</code>";
      })
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g, "$1<em>$2</em>")
      .replace(/(^|[^_\w])_([^_\n]+)_(?!\w)/g, "$1<em>$2</em>");
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /* ----------------------------- boot ------------------------------ */
  document.addEventListener("DOMContentLoaded", function () {
    $("#api-chip").textContent = "API: " + (API_BASE || window.location.origin);

    $("#go-upload").addEventListener("click", function () {
      navigate("upload");
    });
    $("#go-chat").addEventListener("click", function () {
      navigate("chat");
    });

    window.addEventListener("hashchange", renderRoute);

    initTheme();
    initUpload();
    initChat();
    renderRoute();
  });
})();