# Personality Engine

## 概要

人格を形成するエンジンです。

## 環境構築
1. .env.template を .env にコピー
2. .env を編集
3. `npm install`
4. `npm run dev`
5. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 使い方

1. 人格を形成する
2. 人格に対して発言を投げる
3. 人格の変化を観察する

## 成長の仕様：詳細解説

このエンジンにおける人格の成長は、`/api/process-text` エンドポイントへのリクエストを起点として実行されます。人格は、テキストファイル（経験）を読み込むことで、その価値観を変化させていきます。

### 1. 人格の核：「哲学（Philosophy）」

人格は、その核として「哲学」と呼ばれるデータ構造を保持しています。これは以下の要素で構成されます。

-   **中心的信念（`creed`）**: 人格の最も根幹となる、1〜2文の短い信条です。
-   **立場（`stance`）**: 経済観（左派〜右派）と社会観（保守〜リベラル）の2軸で表される政治的・社会的スタンスです。
-   **認知バイアス（`bias`）**: 確証バイアス、新近性バイアス、変化抵抗など、情報の捉え方の偏りです。
-   **フック（`hooks`）**: 特定のキーワードに強く反応するためのトリガーとタブーです。

### 2. 経験と「可塑性（Plasticity）」の計算

人格の成長において最も重要な概念が「可塑性」です。これは年齢に応じて変化し、価値観の変化しやすさを決定します。

-   **経験と年齢**: 人格はテキストを1つ読むごとに1日歳を取ります (`age_in_days`)。
-   **可塑性の計算**: 可塑性は `data/{character}/plasticity_config.json` の設定値に基づき、以下のロジックで計算されます。

    ```typescript
    function calculatePlasticity(age: number, params: any): number {
      const youthPeriod = params.youth_period_days.value;
      const maturityPoint = params.maturity_point_days.value;
      const decayRate = params.decay_rate.value;
      const minPlasticity = params.minimum_plasticity.value;

      // 若年期は最大可塑性を維持
      if (age <= youthPeriod) {
        return 1.0;
      }

      // 若年期後の減衰計算（指数関数的減衰）
      const ageAfterYouth = age - youthPeriod;
      const decayFactor = Math.exp(-decayRate * ageAfterYouth);

      // 成熟点（例：300日目）で可塑性が0.7になるように調整
      const maturityAge = maturityPoint - youthPeriod;
      const scaleFactor = 0.7 / Math.exp(-decayRate * maturityAge);

      const plasticity = Math.max(decayFactor * scaleFactor, minPlasticity);
      return Math.min(plasticity, 1.0);
    }
    ```

    -   **若年期 (`age <= youthPeriod`)**: 可塑性は最大値 `1.0` となります。
    -   **若年期以降**: 年齢と共に指数関数的に減衰します。`maturityPoint` で可塑性が `0.7` になるように `scaleFactor` で調整され、最低値は `minPlasticity` で保証されます。

### 3. 価値観の変化プロセス

経験を通じて、人格の価値観は以下のように変化します。

#### 3.1. 立場（`stance`）の変化

立場（経済観・社会観）は、経験のたびに変化します。最終的な変化量 (`FinalDelta`) は、LLMが提示した基本変化量 (`Base`) に各バイアスを乗算して計算されます。

-   **計算式**:
    1.  `ConfAdj = Base * (1 - confirmation * disagreeFactor)`
    2.  `RecAdj = ConfAdj * (1 + recency * recencyBoost)`
    3.  `FinalDelta = RecAdj * (1 - change_resistance)`

-   **変数解説**:
    -   `Base`: LLMがテキストから判断した経済観・社会観の変化量。
    -   `confirmation`: 現在の確証バイアスの値。
    -   `disagreeFactor`: 現在の立場とテキスト内容の不一致度。
    -   `recency`: 現在の新近性バイアスの値。
    -   `recencyBoost`: 新近性バイアスの影響を調整する係数（固定値 `0.3`）。
    -   `change_resistance`: 現在の変化抵抗の値。

最終的に、算出された `FinalDelta` が現在の立場に加算されます（ただし、値は常に-1〜+1の範囲に収められます）。

#### 3.2. 認知バイアス（`bias`）の更新

各バイアスは、経験の性質（感情の揺れ、不一致度など）に応じて更新されます。

-   **確証バイアス (`confirmation`)**:
    -   `disagree >= 0.6` かつ `arousal >= 60` の場合 → **強化**
    -   `disagree >= 0.6` かつ `arousal < 40` の場合 → **弱化**
-   **新近性バイアス (`recency`)**:
    -   `arousal >= 70` の場合 → **強化**
    -   それ以外の場合 → **弱化**
-   **変化抵抗 (`change_resistance`)**:
    -   経験の内容に関わらず、日々 `0.001` ずつ僅かに**強化（硬化）**していきます。

#### 3.3. 中心的信念（`creed`）の変化

人格の核である「中心的信念」は、アイデンティティを揺るがすほどの大きな出来事があった場合にのみ変化します。

-   **信念更新の閾値**: 更新の条件は、経験による情緒の揺れ (`adjustedArousal`) が、可塑性から算出される動的な閾値を超えることです。
    -   **計算式**: `dynamicArousalThreshold = 70 / plasticity`
-   **可塑性の役割**: 可塑性が高い（若い）ほど閾値は低くなり、より小さな感情の揺れでも信念が変化する可能性があります。逆に、可塑性が低い（歳を取っている）ほど、信念の更新には極めて強い体験が必要になります。

### 4. 重大な出来事と「若返り」

もし、中心的信念が更新されるほどの大きな経験をした場合、それは人格にとっての重大な転換点と見なされます。

-   **哲学の若返り**: このとき、人格の年齢は大幅に若返り（現在の年齢の半分、最低30日まで）、可塑性が高い状態に戻ります。これにより、人格は再び変化しやすい、柔軟な状態から新たな成長を始めることになります。
