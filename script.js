// --- 1. VARIABLEN FÜR BENACHRICHTIGUNGEN ---
let mutedChats = {};      // Speichert stummgeschaltete Chats
let watchedChats = {};    // Verhindert, dass Chats doppelt überwacht werden
let appLoadedTime = Date.now(); // Verhindert Push-Nachrichten für uralte Nachrichten beim Start

// --- 2. ERLAUBNIS ANFRAGEN (Beim Login aufrufen) ---
function requestNotificationPermission() {
    if ("Notification" in window) {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                console.log("Push-Benachrichtigungen erlaubt!");
            }
        });
    }
}

// --- 3. DEN CHAT ÜBERWACHEN (Der "Watcher") ---
function watchChatForNotifications(chatId, type, name) {
    if (watchedChats[chatId]) return; // Falls schon überwacht, abbrechen
    
    const path = type === 'group' ? `groups/${chatId}/messages` : `chats/${chatId}`;
    watchedChats[chatId] = path;

    // Wir schauen nur auf die allerletzte Nachricht, die reinkommt
    db.ref(path).limitToLast(1).on('child_added', snap => {
        const msg = snap.val();
        
        // Bedingung: Nachricht ist neu, nicht von mir selbst und Chat ist nicht stumm
        if (msg.timestamp && msg.timestamp > appLoadedTime && msg.from !== currentUser) {
            
            // Nur wenn der Chat gerade nicht aktiv im Vordergrund offen ist
            if (activeChatID !== chatId) {
                
                // Roter Punkt anzeigen
                showRedDot(chatId);
                
                // Echte Push-Benachrichtigung senden
                if (!mutedChats[chatId]) {
                    sendPush(type === 'group' ? `Gruppe: ${name}` : name, msg.txt);
                }
            }
        }
    });
}

// --- 4. DIE PUSH-NACHRICHT ANS HANDY SENDEN ---
function sendPush(title, body) {
    if (Notification.permission === "granted") {
        // Falls die Nachricht ein Bild ist, Text ändern
        const messageText = body.startsWith("data:image") ? "📷 Foto empfangen" : body;
        
        new Notification("John Chat: " + title, {
            body: messageText,
            icon: "https://cdn-icons-png.flaticon.com/512/134/134914.png", // Ein Chat-Icon
            badge: "https://cdn-icons-png.flaticon.com/512/134/134914.png"
        });
    }
}

// --- 5. Roter Punkt (Badge) Logik ---
function showRedDot(chatId) {
    const badge = document.getElementById(`badge-${chatId}`);
    if (badge) {
        let count = parseInt(badge.innerText) || 0;
        badge.innerText = count + 1;
        badge.style.display = 'inline-block';
    }
}

// --- 6. STUMMSCHALTEN FUNKTION ---
function toggleMute(chatId) {
    if (mutedChats[chatId]) {
        delete mutedChats[chatId];
        db.ref(`users/${currentUser}/muted/${chatId}`).remove();
        alert("Töne wieder an!");
    } else {
        mutedChats[chatId] = true;
        db.ref(`users/${currentUser}/muted/${chatId}`).set(true);
        alert("Chat stummgeschaltet!");
    }
}