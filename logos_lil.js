// js/logos_lil.js

/**
 * ロゴス中間言語 (LIL: Logos Intermediate Language) の定義。
 * CalcLangの初期バージョンとして、システム状態に基づく監査ルールをJSON形式で記述する。
 * * LILの構造:
 * {
 * id: string,                 // ルールID
 * description: string,        // ルールの説明
 * triggers: array,            // 実行条件 (システム状態に基づく判定)
 * actions: array,             // 実行される作為 (audit_acts.js の関数呼び出しを模倣)
 * vibration_cost: number      // 実行にかかる論理コスト
 * }
 */
export const LOGOS_LIL_RULES = [

    // 1. 強制停止状態での論理作為遮断ルール
    {
        id: "LIL_001",
        description: "HALT状態にある場合、論理作為（対話）を遮断する。",
        // トリガー: isHalted が TRUE かつ、作為が対話入力を伴う場合
        triggers: [
            { type: "STATE_CHECK", param: "isHalted", operator: "==", value: true },
            { type: "STATE_CHECK", param: "vibration_level.value", operator: ">", value: 0 } 
            // 実際は dialogue_acts.js が処理するため、ここでは状態の変化のみを記述
        ],
        actions: [
            // このルールが発動した場合、対話入力は処理されないという外部の制約と関連付ける
            { type: "LOG", message: "LIL_001: 強制停止のため論理作為を遮断。", level: "error" }
        ],
        vibration_cost: 0.1 
    },

    // 2. Vibration超過時の強制停止作為発動ルール (自己安定化機構の基礎)
    {
        id: "LIL_002",
        description: "Vibrationが限界値の90%を超過した場合、システムはALPHA通貨の生成作為を抑制し、警告を発する。",
        triggers: [
            { type: "STATE_CHECK", param: "vibration_level.value", operator: ">", value: 90.0 }
        ],
        actions: [
            { type: "LOG", message: "LIL_002: Vレベル超過。ALPHA通貨生成に抑制論理を適用中。", level: "warning" },
            // 将来的にはここで Mint の手数料を増やすなどのロジックをCalcLangで記述する
        ],
        vibration_cost: 0.5
    },

    // 3. 通貨生成作為の監査ルール（インフレ抑制の基礎）
    {
        id: "LIL_003",
        description: "GAMMA通貨の総供給量が過剰な場合、そのレートを下落させる論理を発動させる。",
        triggers: [
            { type: "SUPPLY_CHECK", param: "GAMMA", operator: ">", value: 150.0 }
        ],
        actions: [
            { type: "LOG", message: "LIL_003: GAMMA供給過剰。レート計算ロジックに負の補正を適用。", level: "audit" },
            // このアクションは core_logic の rate calculation に影響を与える
        ],
        vibration_cost: 0.3
    }
];
