import api from './api'

// Types for API request/response data
export interface OrganizationCreateRequest {
  organization_name: string;
  organization_description?: string;
  industry_type: string;
  company_id?: string;
  country: string;
  state: string;
  city: string;
  contact?: string;
  email: string;
  zipcode?: string;
  address_1?: string;
  address_2?: string;
}

export interface OrganizationCreateResponse {
  data: {
    id: number;
    organization_name: string;
    [key: string]: any;
  };
}

export interface BusinessUnitCreateRequest {
  org_id: string;
  org_name: string;
  business_unit_name: string;
  business_unit_description?: string;
  company_id?: string;
  country_id?: string;
  state_id?: string;
  city_id?: string;
  country_code?: string;
  country: string;
  state: string;
  city: string;
  contact?: string;
  email: string;
  zipcode?: string;
  address_1?: string;
  address_2?: string;
  linked_business_process?: any[];
}

export interface BusinessUnitCreateResponse {
  data: {
    id: number;
    business_unit_name: string;
    [key: string]: any;
  };
}

export interface BusinessProcessCreateRequest {
  org_id: string;
  org_name: string;
  business_process_name: string;
  business_process_description?: string;
  linked_business_unit: {
    label: string;
    value: string;
  };
}

export interface BusinessProcessCreateResponse {
  id: number;
  business_process_name: string;
  business_process_description?: string;
  org_id?: string;
  org_name?: string;
  linked_business_unit?: {
    label: string;
    value: string;
  };
  created_at?: string;
  updated_at?: string;
  entity_id?: string | null;
  [key: string]: any;
}

export interface OrganizationSetupRequest {
  org_id: string;
  update_id?: string;
  hierarchy?: any;
  org_name?: string;
  [key: string]: any;
}

export interface OrganizationSetupResponse {
  data: {
    id: number;
    org_id: string;
    [key: string]: any;
  };
}

export interface ProjectCreateRequest {
  name: string;
  project_id?: string;
  description?: string;
  project_team?: string[];
  project_type?: string;
  project_status?: boolean;
  created_by?: string;
  org_id: string[];
  perspective_ids?: string[];
}

export interface ProjectCreateResponse {
  id: number;
  name: string;
  project_id?: string;
  description?: string;
  project_team?: string[];
  project_type?: string;
  project_status?: boolean;
  created_by?: string;
  org_id?: string[];
  perspective_ids?: string[];
  created_at?: string;
  updated_at?: string;
  entity_id?: string | null;
  [key: string]: any;
}

// Types for countries, states, cities
export interface Country {
  name: string;
  isoCode: string;
}

export interface State {
  name: string;
  countryCode: string;
  isoCode: string;
}

export interface City {
  name: string;
  countryCode: string;
  stateCode: string;
}

export interface LocationApiResponse<T> {
  status: string;
  data: T[];
}

// API Service Class
class OrchestrationNodeApiService {
  private countriesCache: Country[] | null = null;
  private statesCache: Map<string, State[]> = new Map();
  private citiesCache: Map<string, City[]> = new Map();

  /**
   * Create Organization API
   */
  async createOrganization(data: OrganizationCreateRequest): Promise<OrganizationCreateResponse> {
    try {
      console.log('Creating organization with data:', data);
      const response = await api.post<OrganizationCreateResponse>(
        '/organization/create-organization',
        data
      );

      console.log('Organization created successfully:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error creating organization:', error);
      throw new Error(`Failed to create organization: ${error}`);
    }
  }

  /**
   * Update Organization API
   */
  async updateOrganization(data: any): Promise<any> {
    try {
      console.log('Updating organization with data:', data);
      const response = await api.post('/organization/update-organization', data);
      console.log('Organization updated successfully:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error updating organization:', error);
      throw new Error(`Failed to update organization: ${error}`);
    }
  }

  /**
   * Get Business Unit by ID
   */
  async getBusinessUnit(id: string | number): Promise<any> {
    try {
      const response = await api.get(`/business-unit/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching business unit:', error);
      throw new Error(`Failed to fetch business unit: ${error}`);
    }
  }

  /**
   * Update Business Unit API
   */
  async updateBusinessUnit(data: any): Promise<any> {
    try {
      console.log('Updating business unit with data:', data);
      const response = await api.post('/business-unit/update-business-unit', data);
      console.log('Business unit updated successfully:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error updating business unit:', error);
      throw new Error(`Failed to update business unit: ${error}`);
    }
  }

  /**
   * Create Business Unit API
   */
  async createBusinessUnit(data: BusinessUnitCreateRequest): Promise<BusinessUnitCreateResponse> {
    try {
      console.log('Creating business unit with data:', data);
      const response = await api.post<BusinessUnitCreateResponse>(
        '/business-unit/create-business-unit',
        data
      );

      console.log('Business unit created successfully:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error creating business unit:', error);
      throw new Error(`Failed to create business unit: ${error}`);
    }
  }

  /**
   * Create Business Process API
   */
  async createBusinessProcess(data: BusinessProcessCreateRequest): Promise<BusinessProcessCreateResponse> {
    try {
      console.log('Creating business process with data:', data);
      const response = await api.post<BusinessProcessCreateResponse>(
        '/business-process/create-business-process',
        data
      );

      console.log('Business process created successfully:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error creating business process:', error);
      throw new Error(`Failed to create business process: ${error}`);
    }
  }

  /**
   * Create Organization Setup API
   */
  async createOrganizationSetup(data: OrganizationSetupRequest): Promise<OrganizationSetupResponse> {
    try {
      console.log('Creating organization setup with data:', data);
      const response = await api.post<OrganizationSetupResponse>(
        '/organization-setup/create-org-setup',
        data
      );

      console.log('Organization setup created successfully:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error creating organization setup:', error);
      throw new Error(`Failed to create organization setup: ${error}`);
    }
  }

  /**
   * Update Organization Setup API
   */
  async updateOrganizationSetup(data: OrganizationSetupRequest): Promise<OrganizationSetupResponse> {
    try {
      console.log('Updating organization setup with data:', data);
      const response = await api.post<OrganizationSetupResponse>(
        '/organization-setup/update-org-setup',
        data
      );

      console.log('Organization setup updated successfully:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error updating organization setup:', error);
      throw new Error(`Failed to update organization setup: ${error}`);
    }
  }
   
  /**
   * Get Organization Setup by ID
   */
  async getOrganizationSetup(id: string | number): Promise<any> {
    try {
      const response = await api.get(`/organization-setup/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching organization setup:', error);
      throw new Error(`Failed to fetch organization setup: ${error}`);
    }
  }

  /**
   * Get Organization by ID
   */
  async getOrganization(id: string | number): Promise<any> {
    try {
      const response = await api.get(`/organization/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching organization:', error);
      throw new Error(`Failed to fetch organization: ${error}`);
    }
  }
  

  /**
   * Create Project API
   */
  async createProject(data: ProjectCreateRequest): Promise<ProjectCreateResponse> {
    try {
      console.log('Creating project with data:', data);
      const response = await api.post<ProjectCreateResponse>(
        '/projects',
        data
      );

      console.log('Project created successfully:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error creating project:', error);
      throw new Error(`Failed to create project: ${error}`);
    }
  }

  /**
   * Fetch Countries API
   */
  async fetchCountries(): Promise<Country[]> {
    if (this.countriesCache) return this.countriesCache;
    try {
      const response = await api.post<Country[]>('/organization/countries', {});
      this.countriesCache = response.data;
      return response.data;
    } catch (error) {
      console.error('Error fetching countries:', error);
      throw new Error(`Failed to fetch countries: ${error}`);
    }
  }

  /**
   * Fetch States API
   */
  async fetchStates(countryCode: string): Promise<State[]> {
    if (this.statesCache.has(countryCode)) return this.statesCache.get(countryCode)!;
    try {
      const response = await api.post<LocationApiResponse<State>>('/organization/get-states', { country_code: countryCode });
      this.statesCache.set(countryCode, response.data.data);
      return response.data.data;
    } catch (error) {
      console.error('Error fetching states:', error);
      throw new Error(`Failed to fetch states: ${error}`);
    }
  }

  /**
   * Fetch Cities API
   */
  async fetchCities(countryCode: string, stateCode: string): Promise<City[]> {
    const key = `${countryCode}_${stateCode}`;
    if (this.citiesCache.has(key)) return this.citiesCache.get(key)!;
    try {
      const response = await api.post<LocationApiResponse<City>>('/organization/get-cities', { country_code: countryCode, state_code: stateCode });
      this.citiesCache.set(key, response.data.data);
      return response.data.data;
    } catch (error) {
      console.error('Error fetching cities:', error);
      throw new Error(`Failed to fetch cities: ${error}`);
    }
  }
}

// Export singleton instance
export const orchestrationNodeApi = new OrchestrationNodeApiService();

// Helper functions for data transformation
export const transformOrganizationFormToApi = (formData: any): OrganizationCreateRequest => {
  return {
    organization_name: formData.org_name || formData.name,
    organization_description: formData.organization_description || '',
    industry_type: formData.industryType,
    company_id: formData.companyId || '',
    country: formData.country,
    state: formData.state,
    city: formData.city,
    contact: formData.contact || '',
    email: formData.email,
    zipcode: formData.zipcode || '',
    address_1: formData.address1 || '',
    address_2: formData.address2 || '',
  };
};

export const transformBusinessUnitFormToApi = (
  formData: any,
  orgId: string,
  orgName: string
): BusinessUnitCreateRequest => {
  return {
    org_id: orgId,
    org_name: orgName,
    business_unit_name: formData.unit_name || formData.name,
    business_unit_description: formData.business_unit_description || '',
    company_id: formData.unitId || '',
    country_id: '',
    state_id: '',
    city_id: '',
    country_code: '',
    country: formData.country,
    state: formData.state,
    city: formData.city,
    contact: formData.contact || '',
    email: formData.email,
    zipcode: formData.zipcode || '',
    address_1: formData.address1 || '',
    address_2: formData.address2 || '',
    linked_business_process: [],
  };
};

export const transformBusinessProcessFormToApi = (
  formData: any,
  orgId: string,
  orgName: string,
  linkedBusinessUnit?: { label: string; value: string }
): BusinessProcessCreateRequest => {
  return {
    org_id: orgId,
    org_name: orgName,
    business_process_name: formData.business_process_name || formData.name,
    business_process_description: formData.business_process_description || '',
    linked_business_unit: linkedBusinessUnit || { label: '', value: '' },
  };
};

export const transformProjectFormToApi = (
  formData: any,
  orgId: string
): ProjectCreateRequest => {
  // Helper function to convert string/array to array
  const toArray = (value: any): string[] => {
    if (!value) return [];
    if (Array.isArray(value)) return value.filter(Boolean);
    if (typeof value === 'string') {
      return value.split(',').map(s => s.trim()).filter(Boolean);
    }
    return [];
  };

  return {
    name: formData.name,
    project_id: formData.project_id || 'PR-ID-',
    description: formData.description || '',
    project_team: toArray(formData.project_team),
    project_type: formData.project_type || '',
    project_status: formData.project_status !== undefined ? formData.project_status : true,
    created_by: formData.created_by || '',
    org_id: [orgId],
    perspective_ids: toArray(formData.perspective_ids),
  };
};
