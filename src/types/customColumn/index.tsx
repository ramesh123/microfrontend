export interface CustomFilter {
    id: string;
    text_sf_box?: boolean;
    selected_field?: string;
    operation: string;
    text_slf_box: boolean;
    selected_last_field: any;
  }
  
  export interface CustomColumn {
    id: string;
    name: string;
    new_custom_column: string;
    custom_filter_list: CustomFilter[];
  }
  
  export type InputPayload = {
    id: string;
    name: string;
    new_custom_column: string;
    custom_filter_list: {
      id: string;
      text_sf_box?: boolean;
      selected_field?: string;
      operation: string;
      text_slf_box: boolean;
      selected_last_field: string;
    }[];
  };
  
  export type OutputPayload = {
    id: string;
    name: string;
    new_custom_column: string;
    custom_filter_list: {
      operation: string;
      text_sf_box?: boolean;
      text_slf_box: boolean;
      selected_field?: string;
      selected_last_field: string;
    }[];
  }[];