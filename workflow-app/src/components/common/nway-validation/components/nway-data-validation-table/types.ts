export interface ValidationResult {
    result: 'Pass' | 'Fail';
    [key: string]: string | number | 'Pass' | 'Fail';
}
  
export interface ChildValidationRecord {
    validationNumber: string;
    cycle: string;
    overallResult: 'Pass' | 'Fail';
    dataset: string;
    table: string;
    tableKey: string;
    results: ValidationResult[];
}
  
export interface ChildRecord {
    [key: string]: any
}
  
export interface DataRecord {
    [key: string]: any
}
  
export interface PairwiseRecord {
    [key: string]: DataRecord | ChildRecord[] | ChildValidationRecord[]
}
  
export interface PairwiseResult {
    [key: string]: any
    records: PairwiseRecord[]
}
  
export interface ValidationSummaryKey {
    pass_percentage?: number;
    fail_percentage?: number;
    pass_records_count?: number;
    fail_records_count?: number;
    total_records_count?: number;
}

export interface NWayValidationResponse {
    pairwise_results: PairwiseResult[]
    status: boolean
    message: string
    summary_key?: ValidationSummaryKey;
    data?: {
      pairwise_results: PairwiseResult[]
      summary_key?: ValidationSummaryKey;
    }
}
