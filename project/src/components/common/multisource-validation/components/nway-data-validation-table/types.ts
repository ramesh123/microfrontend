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
  
export interface NWayValidationResponse {
    pairwise_results: PairwiseResult[]
    status: boolean
    message: string
    data?: {
      pairwise_results: PairwiseResult[]
    }
}
