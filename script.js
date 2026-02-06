// 1. Firebase Konfiguration
const firebaseConfig = {
    apiKey: "AIzaSyApz3w-zlUHvcRUedqsiunJTPZMXYzdvdo",
    authDomain: "johnchat-97cbf.firebaseapp.com",
    databaseURL: "https://johnchat-97cbf-default-rtdb.firebaseio.com",
    projectId: "johnchat-97cbf",
    storageBucket: "johnchat-97cbf.firebasestorage.app",
    messagingSenderId: "652304721979",
    appId: "1:652304721979:web:602baf7cc4893324a6141e"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// 2. Variablen & Status
let currentUser = null, activeChatID = null, isGroup = false;
let userHasPlus = false;
let myEmoji = "";
let myNameColor = "";
let myBg = "default";
let currentChatPath = null;
let friendToRemove = null;

let mutedChats = {};
let watchedChats = {}; 
let appLoadedTime = Date.now();

// 3. BENACHRICHTIGUNGS-LOGIK (Die Abfrage)
function requestNotificationPermission() {
    if ("Notification" in window) {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                console.log("Push erlaubt");
            }
        });
    }
}

// Sofort beim Laden die Erlaubnis abfragen
window.addEventListener('load', () => {
    requestNotificationPermission();
    
    // Auto-Login Check
    const savedUser = localStorage.getItem('johnChatUser');
    if(savedUser) {
        db.ref('users/' + savedUser).once('value').then(snap => {
            if(snap.exists()) {
                currentUser = savedUser;
                const data = snap.val();
                document.getElementById('userGreeting').innerText = "Hi " + formatName(currentUser);
                if(data.theme === 'dark') document.body.classList.add('dark-mode');
                startSync();
                showView('mainView');
            }
        });
    }
});

// 4. HELFER FUNKTIONEN
function triggerEmbed(text, type = "success") {
    const embed = document.getElementById('systemEmbed');
    if(!embed) return;
    embed.innerText = text;
    embed.style.background = type === "success" ? "var(--success)" : "var(--danger)";
    embed.classList.add('show');
    setTimeout(() => embed.classList.remove('show'), 3000);
}

function showAlert(msg, type = "main") {
    const el = document.getElementById('customAlert');
    if(!el) return;
    el.innerText = msg; el.style.display = 'block';
    el.style.background = type === "danger" ? "var(--danger)" : type === "success" ? "var(--success)" : "var(--main)";
    setTimeout(() => { el.style.display = 'none'; }, 3000);
}

function showView(id) { 
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden')); 
    document.getElementById(id).classList.remove('hidden'); 
}

function formatName(n) { return n.toLowerCase() === "knödel" ? "👑 " + n : n; }

// 5. LOGIN & REGISTER
function login() {
    const user = document.getElementById('loginUser').value.trim().toLowerCase(), pass = document.getElementById('loginPass').value;
    db.ref('users/' + user).get().then(snap => {
        const data = snap.val();
        if(data && data.pass === pass) {
            currentUser = user;
            if(document.getElementById('keepLogin').checked) {
                localStorage.setItem('johnChatUser', user);
            }
            document.getElementById('userGreeting').innerText = "Hi " + formatName(user);
            if(data.theme === 'dark') document.body.classList.add('dark-mode');
            startSync(); 
            showView('mainView');
        } else showAlert("Login falsch!", "danger");
    });
}

function register() {
    const user = document.getElementById('regUser').value.trim().toLowerCase(), pass = document.getElementById('regPass').value, agbOk = document.getElementById('agbCheck').checked;
    if(!user || !pass || !agbOk) return showAlert("Daten/AGB fehlen!", "danger");
    db.ref('users/' + user).get().then(snap => {
        if(snap.exists()) showAlert("Name vergeben!", "danger");
        else db.ref('users/' + user).set({ pass, theme: 'light', chatPlus: false }).then(() => { showView('loginView'); });
    });
}

// 6. SYNC & WATCHER (Für Push & Rote Punkte)
function startSync() {
    db.ref('users/' + currentUser).on('value', snap => {
        const data = snap.val(); if(!data) return;
        mutedChats = data.muted || {};
        
        // Freunde laden & Watcher starten
        const fList = document.getElementById('friendsList'); if(fList) fList.innerHTML = "<h4>Freunde</h4>";
        if(data.friends) Object.keys(data.friends).forEach(f => {
            let cid = [currentUser, f].sort().join("_");
            fList.innerHTML += `<div class="friend-item"><span>${formatName(f)} <span class="unread-badge" id="badge-${cid}">0</span></span><button onclick="openChat('${f}', false)">Chat</button></div>`;
            watchChat(cid, 'private', f);
        });
    });
}

function watchChat(chatId, type, name) {
    if(watchedChats[chatId]) return;
    const path = type === 'group' ? `groups/${chatId}/messages` : `chats/${chatId}`;
    watchedChats[chatId] = path;
    
    db.ref(path).limitToLast(1).on('child_added', snap => {
        const msg = snap.val();
        if(msg.timestamp && msg.timestamp > appLoadedTime && msg.from !== currentUser) {
            if(activeChatID !== chatId) {
                // Roter Punkt
                const badge = document.getElementById(`badge-${chatId}`);
                if(badge) { badge.style.display = 'inline-block'; badge.innerText = (parseInt(badge.innerText)||0)+1; }
                
                // Push senden
                if (!mutedChats[chatId] && Notification.permission === "granted") {
                    new Notification("John Chat: " + name, { body: msg.txt });
                }
            }
        }
    });
}

// 7. CHAT FUNKTIONEN
function openChat(id, isG) {
    isGroup = isG;
    activeChatID = isG ? id : [currentUser, id].sort().join("_");
    const badge = document.getElementById(`badge-${activeChatID}`);
    if(badge) { badge.style.display = 'none'; badge.innerText = "0"; }
    showView('chatWindow');
    loadMessages();
}

function loadMessages() {
    const path = isGroup ? 'groups/'+activeChatID+'/messages' : 'chats/'+activeChatID;
    if(currentChatPath) db.ref(currentChatPath).off();
    currentChatPath = path;
    db.ref(path).on('value', snap => {
        const box = document.getElementById('messageBox');
        box.innerHTML = "";
        snap.forEach(m => {
            const d = m.val();
            box.innerHTML += `<div class="msg"><b>${d.from}:</b><br>${d.txt}</div>`;
        });
        box.scrollTop = box.scrollHeight;
    });
}

function sendMessage() {
    const t = document.getElementById('chatInput').value;
    if(!t) return;
    db.ref(currentChatPath).push({ from: currentUser, txt: t, timestamp: Date.now() });
    document.getElementById('chatInput').value = "";
}
