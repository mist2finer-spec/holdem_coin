// ============================================================
// 경량 정책 신경망 (Policy Network) - Pure TypeScript MLP
// 구조: 8 입력 → 64 hidden (ReLU) → 64 hidden (ReLU) → 4 출력 (Softmax)
// 출력: [0: Fold, 1: Check/Call, 2: Half-Pot Raise, 3: Pot Raise]
// 학습: REINFORCE (Policy Gradient) + EV-Shaping Penalty
// ============================================================

export type PolicyAction = 0 | 1 | 2 | 3;

export interface PolicyConfig {
  inputSize: number;
  hiddenSize: number;
  outputSize: number;
  learningRate: number;
}

const DEFAULT_CONFIG: PolicyConfig = {
  inputSize: 8,
  hiddenSize: 64,
  outputSize: 4,
  learningRate: 0.0008,
};

interface ForwardCache {
  input: number[];
  h1Pre: number[];
  h1: number[];
  h2Pre: number[];
  h2: number[];
  logits: number[];
  probs: number[];
}

export class PolicyNetwork {
  config: PolicyConfig;
  W1: number[][];
  b1: number[];
  W2: number[][];
  b2: number[];
  W3: number[][];
  b3: number[];

  // Adam optimizer state
  private mW1: number[][];
  private vW1: number[][];
  private mb1: number[];
  private vb1: number[];
  private mW2: number[][];
  private vW2: number[][];
  private mb2: number[];
  private vb2: number[];
  private mW3: number[][];
  private vW3: number[][];
  private mb3: number[];
  private vb3: number[];
  private adamT: number = 0;
  private beta1 = 0.9;
  private beta2 = 0.999;
  private eps = 1e-8;

  constructor(config: Partial<PolicyConfig> = {}, initialWeights?: SerializedWeights) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    if (initialWeights) {
      this.W1 = initialWeights.W1;
      this.b1 = initialWeights.b1;
      this.W2 = initialWeights.W2;
      this.b2 = initialWeights.b2;
      this.W3 = initialWeights.W3;
      this.b3 = initialWeights.b3;
    } else {
      this.W1 = this._initMatrix(this.config.hiddenSize, this.config.inputSize);
      this.b1 = new Array(this.config.hiddenSize).fill(0);
      this.W2 = this._initMatrix(this.config.hiddenSize, this.config.hiddenSize);
      this.b2 = new Array(this.config.hiddenSize).fill(0);
      this.W3 = this._initMatrix(this.config.outputSize, this.config.hiddenSize);
      this.b3 = new Array(this.config.outputSize).fill(0);
    }
    // Adam state 초기화
    this.mW1 = this._zeroMatrix(this.config.hiddenSize, this.config.inputSize);
    this.vW1 = this._zeroMatrix(this.config.hiddenSize, this.config.inputSize);
    this.mb1 = new Array(this.config.hiddenSize).fill(0);
    this.vb1 = new Array(this.config.hiddenSize).fill(0);
    this.mW2 = this._zeroMatrix(this.config.hiddenSize, this.config.hiddenSize);
    this.vW2 = this._zeroMatrix(this.config.hiddenSize, this.config.hiddenSize);
    this.mb2 = new Array(this.config.hiddenSize).fill(0);
    this.vb2 = new Array(this.config.hiddenSize).fill(0);
    this.mW3 = this._zeroMatrix(this.config.outputSize, this.config.hiddenSize);
    this.vW3 = this._zeroMatrix(this.config.outputSize, this.config.hiddenSize);
    this.mb3 = new Array(this.config.outputSize).fill(0);
    this.vb3 = new Array(this.config.outputSize).fill(0);
  }

  _initMatrix(rows: number, cols: number): number[][] {
    // He initialization
    const scale = Math.sqrt(2.0 / cols);
    return Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => (Math.random() * 2 - 1) * scale)
    );
  }

  _zeroMatrix(rows: number, cols: number): number[][] {
    return Array.from({ length: rows }, () => new Array(cols).fill(0));
  }

  /**
   * Forward pass
   * @returns probs (softmax) 와 cache (backward용)
   */
  forward(input: number[]): { probs: number[]; cache: ForwardCache } {
    // h1 = ReLU(W1 @ input + b1)
    const h1Pre = this.W1.map((row, i) =>
      row.reduce((s, w, j) => s + w * input[j], 0) + this.b1[i]
    );
    const h1 = h1Pre.map(v => Math.max(0, v));

    // h2 = ReLU(W2 @ h1 + b2)
    const h2Pre = this.W2.map((row, i) =>
      row.reduce((s, w, j) => s + w * h1[j], 0) + this.b2[i]
    );
    const h2 = h2Pre.map(v => Math.max(0, v));

    // logits = W3 @ h2 + b3
    const logits = this.W3.map((row, i) =>
      row.reduce((s, w, j) => s + w * h2[j], 0) + this.b3[i]
    );

    // softmax (수치 안정)
    const maxLogit = Math.max(...logits);
    const expLogits = logits.map(v => Math.exp(v - maxLogit));
    const sumExp = expLogits.reduce((s, v) => s + v, 0);
    const probs = expLogits.map(v => v / sumExp);

    return {
      probs,
      cache: { input, h1Pre, h1, h2Pre, h2, logits, probs },
    };
  }

  /**
   * Backward pass with REINFORCE
   * gradient of -log_prob * advantage w.r.t. network params
   * action: 선택된 액션 인덱스
   * advantage: (shaped_reward - baseline)
   */
  backward(cache: ForwardCache, action: number, advantage: number) {
    const { input, h1, h2, probs } = cache;
    const lr = this.config.learningRate;

    // dL/dlogits = -advantage * (one_hot(action) - probs)
    const dlogits = probs.map((p, i) =>
      -advantage * ((i === action ? 1 : 0) - p)
    );

    // dW3 = dlogits ⊗ h2, db3 = dlogits
    const dW3 = dlogits.map(d => h2.map(h => d * h));
    const db3 = [...dlogits];

    // dh2 = W3^T @ dlogits
    const dh2 = h2.map((_, j) =>
      dlogits.reduce((s, d, i) => s + d * this.W3[i][j], 0)
    );
    // ReLU backward
    const dh2Pre = dh2.map((v, j) => (h2[j] > 0 ? v : 0));

    // dW2 = dh2Pre ⊗ h1, db2 = dh2Pre
    const dW2 = dh2Pre.map(d => h1.map(h => d * h));
    const db2 = [...dh2Pre];

    // dh1 = W2^T @ dh2Pre
    const dh1 = h1.map((_, j) =>
      dh2Pre.reduce((s, d, i) => s + d * this.W2[i][j], 0)
    );
    const dh1Pre = dh1.map((v, j) => (h1[j] > 0 ? v : 0));

    // dW1 = dh1Pre ⊗ input, db1 = dh1Pre
    const dW1 = dh1Pre.map(d => input.map(x => d * x));
    const db1 = [...dh1Pre];

    // Adam optimizer update
    this.adamT++;
    const t = this.adamT;
    const bc1 = 1 - Math.pow(this.beta1, t);
    const bc2 = 1 - Math.pow(this.beta2, t);

    this._adamUpdate(this.W1, dW1, this.mW1, this.vW1, lr, bc1, bc2);
    this._adamUpdateVec(this.b1, db1, this.mb1, this.vb1, lr, bc1, bc2);
    this._adamUpdate(this.W2, dW2, this.mW2, this.vW2, lr, bc1, bc2);
    this._adamUpdateVec(this.b2, db2, this.mb2, this.vb2, lr, bc1, bc2);
    this._adamUpdate(this.W3, dW3, this.mW3, this.vW3, lr, bc1, bc2);
    this._adamUpdateVec(this.b3, db3, this.mb3, this.vb3, lr, bc1, bc2);
  }

  private _adamUpdate(
    W: number[][], dW: number[][],
    m: number[][], v: number[][],
    lr: number, bc1: number, bc2: number
  ) {
    for (let i = 0; i < W.length; i++) {
      for (let j = 0; j < W[i].length; j++) {
        m[i][j] = this.beta1 * m[i][j] + (1 - this.beta1) * dW[i][j];
        v[i][j] = this.beta2 * v[i][j] + (1 - this.beta2) * dW[i][j] * dW[i][j];
        const mHat = m[i][j] / bc1;
        const vHat = v[i][j] / bc2;
        W[i][j] -= lr * mHat / (Math.sqrt(vHat) + this.eps);
      }
    }
  }

  private _adamUpdateVec(
    W: number[], dW: number[],
    m: number[], v: number[],
    lr: number, bc1: number, bc2: number
  ) {
    for (let i = 0; i < W.length; i++) {
      m[i] = this.beta1 * m[i] + (1 - this.beta1) * dW[i];
      v[i] = this.beta2 * v[i] + (1 - this.beta2) * dW[i] * dW[i];
      const mHat = m[i] / bc1;
      const vHat = v[i] / bc2;
      W[i] -= lr * mHat / (Math.sqrt(vHat) + this.eps);
    }
  }

  serialize(): SerializedWeights {
    return {
      W1: this.W1, b1: this.b1,
      W2: this.W2, b2: this.b2,
      W3: this.W3, b3: this.b3,
    };
  }

  loadWeights(data: SerializedWeights) {
    this.W1 = data.W1; this.b1 = data.b1;
    this.W2 = data.W2; this.b2 = data.b2;
    this.W3 = data.W3; this.b3 = data.b3;
  }
}

export interface SerializedWeights {
  W1: number[][];
  b1: number[];
  W2: number[][];
  b2: number[];
  W3: number[][];
  b3: number[];
}
