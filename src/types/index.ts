export type BiasItem = {
  sentence: string;
  type: string;
  severity: "low" | "medium" | "high";
  explanation: string;
  suggestion: string;
};

export type AnalysisResult = {
  score: number;
  summary: string;
  biases: BiasItem[];
};

export type ScanRecord = {
  id: string;
  fileName: string;
  timestamp: Date;
  documentText: string;
  biasResult: AnalysisResult | null;
  consistencyResult: any | null;
  integrityScore: number | null;
};