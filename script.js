// --- REINER PUSH-CODE ---
let watchedChats = {};
let appLoadedTime = Date.now();

// 1. Beim Laden der Seite nach Erlaubnis fragen
window.addEventListener('load', () => {
    if ("Notification" in window) {
        Notification.requestPermission().then(permission => {
            console.log("Push-Status:", permission);
        });
    }
});

// 2. Diese Funktion startet die Überwachung für Push-Nachrichten
function startPushWatcher(chatId, type, chatName) {
    if (watchedChats[chatId]) return;
    watchedChats[chatId] = true;

    const path = type === 'group' ? `groups/${chatId}/messages` : `chats/${chatId}`;

    // Nutzt die 'db' Verbindung aus deinem HTML
    db.ref(path).limitToLast(1).on('child_added', snap => {
        const msg = snap.val();

        // Bedingung: Nachricht ist neu, nicht von mir und ich bin nicht gerade im Chatfenster
        if (msg.timestamp && msg.timestamp > appLoadedTime && msg.from !== currentUser) {
            if (activeChatID !== chatId) {
                
                // Handy-Benachrichtigung abschicken
                if (Notification.permission === "granted") {
                    const text = msg.type === 'img' ? "📷 Foto empfangen" : msg.txt;
                    new Notification("John Chat: " + chatName, {
                        body: text,
                        icon: "https://cdn-icons-png.flaticon.com/512/134/134914.png"
                    });
                }
            }
        }
    });
}
