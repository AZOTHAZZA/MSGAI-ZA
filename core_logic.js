// js/core_logic.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, setDoc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ====================================================================
// CORE SYSTEM STATE & CONFIGURATION
// ====================================================================

const VIBRATION_LIMIT = 100; // 掌の縁 (ロゴス監査の限界)
let app, db, auth, stateDocRef;
let userId = 'N/A';
const appId = 'MSGAI-Z';

// 初期システム状態
let currentState = {
    isHalted: false, // 強制停止フラグ
    vibration_level: { value: 0, last_decay: Date.now() },
    currency_rates: { ALPHA: 1.0, BETA: 10.0, GAMMA: 100.0 },
    accounts: [
        { id: 'CORE_BANK_A', name: '中央銀行A', ALPHA: 1000.00, BETA: 500.00, GAMMA: 100.00 },
        { id: 'USER_AUDIT_B', name: '監査者B', ALPHA: 50.00, BETA: 0.00, GAMMA: 0.00 },
    ],
};

// UI Elements Map (各ページから参照される可能性がある共通要素)
export const UI_ELEMENTS = {
    dialogue_output: null, // logos_console.html で初期化
    dialogue_input: null,
    execute_button: null,
    vibration_meter: null, // state_view.html で初期化
    vibration_value: null, 
    app_user_id: null,
};

// ====================================================================
// CONSOLE LOGGING UTILITY (EXPORTED)
// ====================================================================

/**
 * Logs a message to the console output area. (logos_console.html の DOM に依存)
 * @param {string} message - The message content.
 * @param {string} className - The CSS class for styling.
 */
export function logToConsole(message, className = 'ai-message') {
    const outputEl = document.getElementById('dialogue_output');
    if (!outputEl) {
        console.warn(`[LOG UNABLE TO DISPLAY] ${message}`);
        return; 
    } 

    const p = document.createElement('p');
    p.className = `p-1 text-sm ${className}`;
    
    // タイムスタンプを追加
    const now = new Date();
    const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    p.innerHTML = `<span class="text-gray-500">[${timeString}]</span> ${message}`;
    
    outputEl.appendChild(p);
    outputEl.scrollTop = outputEl.scrollHeight;
}

// ====================================================================
// STATE MANAGEMENT FUNCTIONS (EXPORTED)
// ====================================================================

/** 現在のシステム状態のコピーを返します。 */
export function getCurrentState() {
    return { ...currentState };
}

/** Firestoreに状態を保存し、ローカル状態を更新します。 */
export async function saveSystemState(updateData) {
    // ローカル状態を即時更新
    currentState = { ...currentState, ...updateData };
    
    try {
        await updateDoc(stateDocRef, updateData);
    } catch (e) {
        logToConsole(`[ERROR]: Firestore Save Error: ${e.message}`, 'error-message');
    }
    // Firestoreからの反映（onSnapshot）でUIが更新される
}

// ====================================================================
// VIBRATION MANAGEMENT (EXPORTED)
// ====================================================================

/** * 孫悟空の活動量 (Vibration Level) を増加させます。*/
export async function addVibration(amount) {
    const newVibration = Math.min(currentState.vibration_level.value + amount, VIBRATION_LIMIT * 2);
    await saveSystemState({ 
        vibration_level: { ...currentState.vibration_level, value: newVibration } 
    });
}

/** * 1秒ごとにVibrationを減衰させます。*/
function decayVibration() {
    const now = Date.now();
    const lastDecay = currentState.vibration_level.last_decay;
    const timeElapsed = (now - lastDecay) / 1000;

    if (timeElapsed >= 1) { 
        const decayRate = 0.5; // 1秒あたり0.5減衰
        const decayAmount = timeElapsed * decayRate;
        let newValue = Math.max(0, currentState.vibration_level.value - decayAmount);

        // Firestoreへの書き込みを最小限にするため、値に大きな変化があった場合のみ保存
        if (Math.abs(newValue - currentState.vibration_level.value) >= 1) { 
             saveSystemState({ 
                vibration_level: { value: newValue, last_decay: now } 
             });
        } else {
             // UI更新のために local state と last_decay を更新
             currentState.vibration_level.value = newValue;
             currentState.vibration_level.last_decay = now;
        }
    }
}

/** * 強制的にVibrationをリセットします。 */
export async function resetVibration() {
    await saveSystemState({ 
        vibration_level: { value: 0, last_decay: Date.now() } 
    });
}

// ====================================================================
// UI RENDER CALLBACK MANAGEMENT (CENTRALIZED CONTROL)
// ====================================================================

/** * Firestoreのデータ更新時に実行される、ページ固有のUIレンダリング関数を格納するリスト。*/
const renderCallbacks = [];

/**
 * UIレンダリング関数を登録します。onSnapshot/Decayでデータが更新されるたびに実行されます。
 * @param {function} callbackFn - UIを更新するための関数 (引数として最新のstateを受け取る)。
 */
export function registerRenderCallback(callbackFn) {
    if (typeof callbackFn === 'function' && !renderCallbacks.includes(callbackFn)) {
        renderCallbacks.push(callbackFn);
    }
}

/**
 * 登録されたすべてのレンダリング関数を実行します。
 */
function executeRenderCallbacks(state) {
    // 1. まず共通のUIを更新
    updateUI(state); 
    
    // 2. 次に登録されたページ固有のコールバックを実行
    renderCallbacks.forEach(fn => {
        try {
            fn(state);
        } catch (e) {
            console.error("Render Callback Error:", e);
        }
    });
}

// ====================================================================
// UI UPDATE LOGIC (INTERNAL)
// ====================================================================

// NOTE: この関数は Vibration メーターなどの共通要素のみを更新します。
function updateUI(state) {
    // Vibrationメーターの更新 (state_view.html で利用されることを想定)
    if (UI_ELEMENTS.vibration_value) {
        UI_ELEMENTS.vibration_value.textContent = state.vibration_level.value.toFixed(2);
    }
    if (UI_ELEMENTS.vibration_meter) {
        const percentage = Math.min(100, (state.vibration_level.value / VIBRATION_LIMIT) * 100);
        UI_ELEMENTS.vibration_meter.style.width = `${percentage}%`;
        
        // 色分けのロジック
        // ... (省略：色分けCSSクラスの追加/削除ロジック)
    }
    
    // 強制停止状態の表示 (すべてのページで共通のクラス名を使用)
    document.querySelectorAll('.halt-indicator').forEach(el => {
        el.textContent = state.isHalted ? 'HALTED' : 'OPERATIONAL';
        el.className = state.isHalted ? 'halt-indicator text-red-500 font-bold' : 'halt-indicator text-green-500 font-bold';
    });
}

// ====================================================================
// INITIALIZATION AND FIREBASE LISTENERS (EXPORTED)
// ====================================================================

/** アプリケーションの初期化とFirebaseリスナーの設定を行います。 */
export async function initApp() {
    const firebaseConfig = { 
        // DUMMY CONFIG FOR SIMULATION - Replace with actual config
        apiKey: "AIzaSyDUMMYKEY", 
        authDomain: "msgai-z.firebaseapp.com",
        projectId: "msgai-z",
        storageBucket: "msgai-z.appspot.com",
        messagingSenderId: "123456789012",
        appId: "1:123456789012:web:abcdef1234567890"
    };

    try {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        
        // 1. Authentication
        await signInAnonymously(auth);
        
        onAuthStateChanged(auth, (user) => {
            if (user) {
                userId = user.uid.substring(0, 8);
                if (UI_ELEMENTS.app_user_id) {
                    UI_ELEMENTS.app_user_id.textContent = `${appId} / ${userId}`;
                }
                
                // 2. Firestore State Listener
                stateDocRef = doc(db, 'system_state', appId);
                onSnapshot(stateDocRef, (docSnap) => {
                    if (docSnap.exists()) {
                        const firestoreData = docSnap.data();
                        currentState = { ...currentState, ...firestoreData };
                    } else {
                        // 初回実行時: 初期状態をFirestoreに設定
                        setDoc(stateDocRef, currentState);
                    }
                    
                    // **データ受信後、すべての登録されたコールバックを実行**
                    executeRenderCallbacks(currentState); 
                    
                }, (error) => {
                    console.error("Firestore Listen Error:", error);
                });

                // 3. Decay Timer
                setInterval(() => {
                    decayVibration();
                    // Decay処理後もUI更新のためにコールバックを実行
                    executeRenderCallbacks(currentState); 
                }, 1000); // 1秒ごとに減衰
            }
        });
    } catch (e) {
        console.error("Firebase Initialization Error:", e);
    }
}
