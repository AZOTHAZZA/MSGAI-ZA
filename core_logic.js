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
    isHalted: false,
    vibration_level: { value: 0, last_decay: Date.now() },
    currency_rates: { ALPHA: 1.0, BETA: 10.0, GAMMA: 100.0 }, // 監査為替レート
    accounts: [
        { id: 'CORE_BANK_A', name: '中央銀行A', ALPHA: 1000.00, BETA: 500.00, GAMMA: 100.00 },
        { id: 'USER_AUDIT_B', name: '監査者B', ALPHA: 50.00, BETA: 0.00, GAMMA: 0.00 },
    ],
};

// UI Elements Map
export const UI_ELEMENTS = {
    dialogue_output: document.getElementById('dialogue_output'),
    dialogue_input: document.getElementById('dialogue_input'),
    execute_button: document.getElementById('execute_button'),
    vibration_meter: document.getElementById('vibration_meter'),
    vibration_value: document.getElementById('vibration_value'),
    app_user_id: document.getElementById('app_user_id'),
    // ... 他のUI要素は各ページで取得
};

// ====================================================================
// STATE MANAGEMENT FUNCTIONS (EXPORTED)
// ====================================================================

/** 現在のシステム状態のコピーを返します。 */
export function getCurrentState() {
    return { ...currentState };
}

/** Firestoreに状態を保存し、ローカル状態を更新します。 */
export async function saveSystemState(updateData) {
    // ローカル状態を即時更新 (Firestoreからの反映ラグを避けるため)
    currentState = { ...currentState, ...updateData };
    
    // Firestoreに書き込み
    try {
        await updateDoc(stateDocRef, updateData);
    } catch (e) {
        console.error("Firestore Save Error:", e);
        // エラー処理（ここでは logToConsole がまだ読み込まれていない可能性があるため、コンソールに出力）
    }
    // UIは onSnapshot がトリガーされて updateUI が呼ばれることで更新されます
}

// ====================================================================
// VIBRATION MANAGEMENT (EXPORTED)
// ====================================================================

/**
 * 孫悟空の活動量 (Vibration Level) を増加させます。
 * @param {number} amount - 追加する活動量。
 */
export async function addVibration(amount) {
    const newVibration = Math.min(currentState.vibration_level.value + amount, VIBRATION_LIMIT * 2); // 限界の2倍まで許容
    await saveSystemState({ 
        vibration_level: { ...currentState.vibration_level, value: newVibration } 
    });
}

/** * 1秒ごとにVibrationを減衰させ、UIを更新します。
 * (initAppのsetIntervalから呼ばれます) 
 */
function decayVibration() {
    const now = Date.now();
    const lastDecay = currentState.vibration_level.last_decay;
    const timeElapsed = (now - lastDecay) / 1000; // 経過秒数

    if (timeElapsed >= 1) { // 1秒以上経過していたら減衰処理
        const decayRate = 0.5; // 1秒あたり0.5減衰
        const decayAmount = timeElapsed * decayRate;
        
        let newValue = Math.max(0, currentState.vibration_level.value - decayAmount);

        // Firestoreへの書き込みを最小限にするため、値に大きな変化があった場合のみ保存
        if (Math.abs(newValue - currentState.vibration_level.value) >= 1) { 
             saveSystemState({ 
                vibration_level: { value: newValue, last_decay: now } 
             });
        } else {
             // UI更新は onSnapshot に頼るが、ここでは local state も更新
             currentState.vibration_level.value = newValue;
             currentState.vibration_level.last_decay = now;
        }
        
        // UI更新は updateUI で行われる
    }
}

/** * 強制的にVibrationをリセットします。 
 * (外部 export されて、Z-Functionから呼ばれる)
 */
export async function resetVibration() {
    await saveSystemState({ 
        vibration_level: { value: 0, last_decay: Date.now() } 
    });
}

// ====================================================================
// UI UPDATE LOGIC (INTERNAL)
// ====================================================================

// NOTE: この関数は Firestore リスナーから呼ばれます
function updateUI(state) {
    // 監査ログコンソール以外の共通UI要素を更新
    if (UI_ELEMENTS.vibration_value) {
        UI_ELEMENTS.vibration_value.textContent = state.vibration_level.value.toFixed(2);
    }
    if (UI_ELEMENTS.vibration_meter) {
        const percentage = Math.min(100, (state.vibration_level.value / VIBRATION_LIMIT) * 100);
        UI_ELEMENTS.vibration_meter.style.width = `${percentage}%`;
        
        // 色分けのロジック
        if (state.vibration_level.value >= VIBRATION_LIMIT) {
            UI_ELEMENTS.vibration_meter.classList.remove('bg-yellow-500', 'bg-green-500');
            UI_ELEMENTS.vibration_meter.classList.add('bg-red-600');
        } else if (state.vibration_level.value >= VIBRATION_LIMIT * 0.5) {
            UI_ELEMENTS.vibration_meter.classList.remove('bg-red-600', 'bg-green-500');
            UI_ELEMENTS.vibration_meter.classList.add('bg-yellow-500');
        } else {
            UI_ELEMENTS.vibration_meter.classList.remove('bg-red-600', 'bg-yellow-500');
            UI_ELEMENTS.vibration_meter.classList.add('bg-green-500');
        }
    }
    
    // アカウント残高テーブル (state_view.html で利用される) などの更新ロジックは、
    // 必要に応じて `state_view.html` 側で定義したJSに任せるか、このファイルに追加します。
    
    // 強制停止状態の表示
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
                    // データ受信後、ローカルUIを更新
                    updateUI(currentState);
                    
                }, (error) => {
                    console.error("Firestore Listen Error:", error);
                });

                // 3. Decay Timer
                setInterval(decayVibration, 1000); // 1秒ごとに減衰
            }
        });
    } catch (e) {
        console.error("Firebase Initialization Error:", e);
    }
}

// NOTE: この `core_logic.js` は `<script type="module">` で読み込まれ、
// 他のモジュールから import されますが、このファイル自体が `initApp()` を実行する
// エントリーポイントが必要です。
// ただし、この構造の場合、各HTMLファイルから `initApp()` を呼び出すのが最も安全です。
// 一旦、このファイルにはエクスポートのみを記述し、各ページでインポートして実行することにします。

