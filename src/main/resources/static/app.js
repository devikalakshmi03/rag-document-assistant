const API_BASE = location.protocol === "file:" ? "http://localhost:8080" : "";
const MAX_BATCH = 40;
const LEGACY_CHAT = "00000000-0000-0000-0000-000000000000";
const HISTORY_KEY = "rag-assistant.chats";
const $ = id => document.getElementById(id);
const pdfInput = $("pdfInput");
const uploadDialog = $("uploadDialog");
const uploadStatus = $("uploadStatus");
const dropZone = $("dropZone");
const chatMessages = $("chatMessages");
const questionInput = $("questionInput");

let chats = [];
try {
    const saved = JSON.parse(localStorage.getItem(HISTORY_KEY));
    if (Array.isArray(saved)) {
        chats = saved.map(chat => /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(chat.id)
            ? chat : { ...chat, id: newChat().id });
    }
} catch (error) {
    console.warn("Could not load chat history", error);
}

let activeChat = newChat();
let documentLoad = 0;
let uploading = false;
const pending = new Map();

function newChat() {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
    const id = hex.replace(/^(........)(....)(....)(....)(............)$/, "$1-$2-$3-$4-$5");
    return { id, messages: [] };
}

function saveHistory() {
    try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(chats));
    } catch (error) {
        console.warn("Could not save chat history", error);
    }
}

function chatUrl(path, chat) {
    return `${API_BASE}/api/v1/${path}?chatId=${encodeURIComponent(chat.id)}`;
}

function rememberChat(chat) {
    if (!chats.includes(chat)) chats.unshift(chat);
    saveHistory();
    renderHistory();
}

function renderHistory() {
    $("history").replaceChildren(...chats.map(chat => {
        const button = document.createElement("button");
        button.type = "button";
        const title = chat.messages[0]?.text || chat.title || "Untitled chat";
        button.textContent = title;
        button.title = title;
        if (chat === activeChat) button.setAttribute("aria-current", "true");
        button.addEventListener("click", () => selectChat(chat));
        return button;
    }));
}

function selectChat(chat) {
    if (activeChat !== chat) {
        uploadStatus.textContent = "";
        $("uploadList").replaceChildren();
        $("viewDocuments").hidden = true;
        $("documentList").replaceChildren();
        $("documentCount").textContent = "";
        $("documentStatus").textContent = "Loading PDFs...";
    }
    activeChat = chat;
    loadDocuments(chat);
    questionInput.value = "";
    setHistoryOpen(false);
    renderChat();
    questionInput.focus();
}

function appendMessage(message) {
    const bubble = document.createElement("article");
    bubble.className = `message ${message.type}-message`;
    bubble.textContent = message.text;
    if (message.elapsed) {
        const elapsed = document.createElement("p");
        elapsed.className = "elapsed";
        elapsed.textContent = `Response time · ${message.elapsed} s`;
        bubble.append(elapsed);
    }
    if (message.sources?.length) {
        const list = document.createElement("div");
        list.className = "source-list";
        const heading = document.createElement("strong");
        heading.textContent = "Retrieved sources";
        list.append(heading);
        for (const source of message.sources) {
            const item = document.createElement("div");
            item.textContent = source;
            list.append(item);
        }
        bubble.append(list);
    }
    chatMessages.append(bubble);
}

function renderChat() {
    const isEmpty = !activeChat.messages.length;
    $("chat").classList.toggle("is-empty", isEmpty);
    $("welcome").hidden = !isEmpty;
    chatMessages.hidden = isEmpty;
    chatMessages.replaceChildren();
    activeChat.messages.forEach(appendMessage);
    if (pending.has(activeChat.id)) {
        const thinking = document.createElement("div");
        thinking.className = "message ai-message thinking";
        thinking.innerHTML = 'Thinking <span class="dots" aria-hidden="true"><i></i><i></i><i></i></span> <span id="thinkingTime" aria-live="off"></span>';
        chatMessages.append(thinking);
        updateThinkingTime();
    }
    $("sendButton").disabled = pending.has(activeChat.id);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    renderHistory();
}

function updateThinkingTime() {
    const timer = $("thinkingTime");
    if (timer) timer.textContent = `${((performance.now() - pending.get(activeChat.id)) / 1000).toFixed(1)} s`;
}

function setHistoryOpen(open) {
    $("sidebar").classList.toggle("is-open", open);
    $("historyToggle").setAttribute("aria-expanded", String(open));
}

function setDocumentsOpen(open) {
    $("documents").hidden = !open;
    $("documentsToggle").setAttribute("aria-expanded", String(open));
    if (open) setHistoryOpen(false);
}

$("historyToggle").addEventListener("click", () => {
    const open = !$("sidebar").classList.contains("is-open");
    if (open) setDocumentsOpen(false);
    setHistoryOpen(open);
});
$("newChat").addEventListener("click", () => selectChat(newChat()));
$("documentsToggle").addEventListener("click", () => {
    const open = $("documents").hidden;
    setDocumentsOpen(open);
    if (open) loadDocuments(activeChat);
});
$("closeDocuments").addEventListener("click", () => {
    setDocumentsOpen(false);
    $("documentsToggle").focus();
});

async function readResponse(response) {
    if (response.ok) return response.json();
    const error = await response.json().catch(() => null);
    throw new Error(error?.error || error?.message || `HTTP ${response.status}`);
}

$("chatForm").addEventListener("submit", async event => {
    event.preventDefault();
    const question = questionInput.value.trim();
    if (!question || pending.has(activeChat.id)) return;

    const chat = activeChat;
    const started = performance.now();

    chat.messages.push({ type: "user", text: question });
    rememberChat(chat);
    pending.set(chat.id, started);
    questionInput.value = "";
    renderChat();
    const timer = setInterval(updateThinkingTime, 100);

    try {
        const response = await fetch(chatUrl("ask", chat), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question })
        });
        const data = await readResponse(response);
        const text = data.answer || "No answer returned.";
        const sources = (data.sources || []).map((source, index) =>
            `[SOURCE ${index + 1}] ${source.filename} · Page ${source.page}`);
        const cited = sources.filter((source, index) => text.includes(`[SOURCE ${index + 1}]`));
        chat.messages.push({
            type: "ai", text,
            elapsed: ((performance.now() - started) / 1000).toFixed(2),
            sources: cited.length ? cited : sources.slice(0, 1)
        });
    } catch (error) {
        chat.messages.push({ type: "ai", text: `Unable to generate an answer. ${error.message}` });
    } finally {
        clearInterval(timer);
        pending.delete(chat.id);
        saveHistory();
        if (chat === activeChat) renderChat();
    }
});

function updateUploadControls() {
    $("browseFiles").disabled = uploading;
    pdfInput.disabled = uploading;
}

function renderDocuments(chat, documents) {
    $("documentCount").textContent = `${documents.length} PDF(s) in this chat`;
    const list = $("documentList");
    list.replaceChildren();
    for (const doc of documents) {
        const item = document.createElement("div");
        item.className = "document-item";
        const name = document.createElement("span");
        name.textContent = doc.filename || "Untitled PDF";
        const remove = document.createElement("button");
        remove.type = "button";
        remove.textContent = "×";
        remove.setAttribute("aria-label", `Delete ${name.textContent}`);
        remove.addEventListener("click", async () => {
            if (!confirm(`Delete ${name.textContent}?`)) return;
            remove.disabled = true;
            try {
                const response = await fetch(chatUrl(`documents/${encodeURIComponent(doc.id)}`, chat), { method: "DELETE" });
                if (!response.ok) await readResponse(response);
                if (chat === activeChat) await loadDocuments(chat);
            } catch (error) {
                if (chat === activeChat) $("documentStatus").textContent = `Delete failed. ${error.message}`;
                remove.disabled = false;
            }
        });
        item.append(name, remove);
        list.append(item);
    }
    if (!documents.length) list.textContent = "No PDFs uploaded yet.";
}

async function loadDocuments(chat) {
    const load = ++documentLoad;
    try {
        const documents = await readResponse(await fetch(chatUrl("documents", chat)));
        if (chat !== activeChat || load !== documentLoad) return;
        $("documentStatus").textContent = "";
        renderDocuments(chat, documents);
    } catch (error) {
        if (chat === activeChat && load === documentLoad) {
            $("documentStatus").textContent = `Unable to load documents. ${error.message}`;
        }
    }
}

function openUpload() {
    uploadDialog.showModal();
    if (uploading) uploadStatus.textContent = "An upload batch is already in progress.";
}

$("uploadButton").addEventListener("click", openUpload);
$("uploadMore").addEventListener("click", openUpload);
$("browseFiles").addEventListener("click", () => pdfInput.click());
$("viewDocuments").addEventListener("click", () => {
    uploadDialog.close();
    setDocumentsOpen(true);
    $("closeDocuments").focus();
});

for (const eventName of ["dragenter", "dragover", "dragleave", "drop"]) {
    uploadDialog.addEventListener(eventName, event => event.preventDefault());
}
dropZone.addEventListener("dragover", () => dropZone.classList.toggle("dragging", !pdfInput.disabled));
dropZone.addEventListener("dragleave", event => {
    if (!dropZone.contains(event.relatedTarget)) dropZone.classList.remove("dragging");
});
dropZone.addEventListener("drop", event => {
    dropZone.classList.remove("dragging");
    uploadFiles([...event.dataTransfer.files]);
});
pdfInput.addEventListener("change", () => {
    uploadFiles([...pdfInput.files]);
    pdfInput.value = "";
});

function uploadFile(chat, file, progress, status) {
    return new Promise((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open("POST", chatUrl("documents", chat));
        request.responseType = "json";
        request.upload.onprogress = event => {
            if (!event.lengthComputable) return;
            const percent = Math.floor(event.loaded / event.total * 100);
            progress.value = percent;
            status.textContent = `Uploading · ${percent}%`;
        };
        request.upload.onload = () => {
            progress.removeAttribute("value");
            status.textContent = "Indexing PDF…";
        };
        request.onload = () => {
            if (request.status >= 200 && request.status < 300 && request.response) {
                resolve(request.response);
            } else {
                const error = new Error(request.response?.error || request.response?.message || `HTTP ${request.status}`);
                error.code = request.response?.code;
                reject(error);
            }
        };
        request.onerror = () => reject(new Error("Network error"));
        const body = new FormData();
        body.append("file", file);
        request.send(body);
    });
}

async function uploadFiles(files) {
    if (uploading || !files.length) return;
    if (files.length > MAX_BATCH) {
        $("uploadList").replaceChildren();
        $("viewDocuments").hidden = true;
        uploadStatus.textContent = `Select up to ${MAX_BATCH} PDFs per batch. You selected ${files.length}.`;
        return;
    }
    const chat = activeChat;
    const rows = files.map(file => {
        const row = document.createElement("li");
        const name = document.createElement("strong");
        name.textContent = file.name;
        const status = document.createElement("span");
        status.className = "upload-state";
        const progress = document.createElement("progress");
        progress.max = 100;
        progress.value = 0;
        progress.hidden = true;
        progress.setAttribute("aria-label", `Upload progress for ${file.name}`);
        let validation = "";
        if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") validation = "Choose a PDF file.";
        else if (!file.size || file.size > 20_000_000) validation = "PDF must be nonempty and at most 20 MB.";
        status.textContent = validation || "Queued";
        row.append(name, status, progress);
        return { file, row, status, progress, validation };
    });
    const valid = rows.filter(row => !row.validation);
    $("uploadList").replaceChildren(...rows.map(row => row.row));
    $("viewDocuments").hidden = true;
    if (!valid.length) {
        uploadStatus.textContent = "No valid PDFs selected.";
        return;
    }
    uploading = true;
    updateUploadControls();
    uploadStatus.textContent = `Uploading ${valid.length} PDF(s)…`;
    let succeeded = 0;
    let duplicates = 0;
    for (const { file, status, progress } of valid) {
        progress.hidden = false;
        status.textContent = "Uploading…";
        try {
            await uploadFile(chat, file, progress, status);
            progress.value = 100;
            status.textContent = "Uploaded and indexed";
            succeeded++;
            rememberChat(chat);
        } catch (error) {
            progress.hidden = true;
            if (error.code === "PDF_ALREADY_UPLOADED") {
                duplicates++;
                status.classList.add("upload-warning");
                status.textContent = "Skipped. This PDF is already uploaded in this chat.";
            } else {
                status.textContent = `Upload failed. ${error.message}`;
            }
        }
    }
    uploading = false;
    updateUploadControls();
    if (chat === activeChat) {
        const failed = files.length - succeeded - duplicates;
        uploadStatus.textContent = `${succeeded} uploaded · ${duplicates} duplicates skipped · ${failed} failed`;
        $("viewDocuments").hidden = !succeeded;
        if (succeeded) setDocumentsOpen(true);
        await loadDocuments(chat);
    } else if (uploadDialog.open) {
        uploadStatus.textContent = "Ready for the next upload.";
    }
}

renderChat();
loadDocuments(activeChat);
if (!chats.some(chat => chat.id === LEGACY_CHAT)) {
    const legacy = { id: LEGACY_CHAT, title: "Previous uploads", messages: [] };
    fetch(chatUrl("documents", legacy))
        .then(readResponse)
        .then(documents => {
            if (documents.length) rememberChat(legacy);
        })
        .catch(error => console.warn("Could not load previous uploads", error));
}
