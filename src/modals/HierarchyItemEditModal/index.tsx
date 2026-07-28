import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Node } from '@xyflow/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { OrganizationFormData, BusinessUnitFormData, BusinessProcessFormData, ProjectFormData } from '@/types/orchestration';
import { orchestrationNodeApi, transformOrganizationFormToApi, transformBusinessUnitFormToApi, transformBusinessProcessFormToApi, transformProjectFormToApi, Country, State, City } from '@/controllers/API/orchestrationNodeApi';
import { useOrchestrationStore } from '@/stores/orchestrationStore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combobox } from '@/components/ui/combobox';
import { toast } from 'sonner';

interface HierarchyItemEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (node: any, data: any) => void;
  node: any;
}

const industryTypes = ['Technology', 'Healthcare', 'Finance', 'Manufacturing', 'Retail', 'Other'];
const businessTypes = ['Sales', 'Marketing', 'Operations', 'HR', 'Finance', 'IT', 'R&D', 'Other'];

export function HierarchyItemEditModal({ isOpen, onClose, onSave, node }: HierarchyItemEditModalProps) {
  const [name, setName] = useState('');
  const [formData, setFormData] = useState<Partial<OrganizationFormData & { countryCode?: string; stateCode?: string }>>({});
  const [businessUnitFormData, setBusinessUnitFormData] = useState<Partial<BusinessUnitFormData & { countryCode?: string; stateCode?: string }>>({});
  const [businessProcessFormData, setBusinessProcessFormData] = useState<Partial<BusinessProcessFormData>>({});
  const [projectFormData, setProjectFormData] = useState<Partial<ProjectFormData>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [countries, setCountries] = useState<Country[]>([]);
  const [states, setStates] = useState<State[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  // Track whether countries have been fetched to prevent double-calls
  const countriesFetchedRef = useRef(false);
  // Track the last node id we initialized for, to avoid re-init on unrelated re-renders
  const initializedNodeIdRef = useRef<string | null>(null);
  // Store fetched organization ID and data for save handler
  const fetchedOrgDataRef = useRef<any>(null);

  const { currentOrganization, setCurrentOrganization } = useOrchestrationStore();

  // ─── Fetch helpers ──────────────────────────────────────────────────────────

  const fetchCountries = useCallback(async (): Promise<Country[]> => {
    try {
      const data = await orchestrationNodeApi.fetchCountries();
      setCountries(data);
      return data;
    } catch (error) {
      console.error('Failed to fetch countries:', error);
      return [];
    }
  }, []);

  const fetchStates = useCallback(async (countryCode: string): Promise<State[]> => {
    try {
      const data = await orchestrationNodeApi.fetchStates(countryCode);
      setStates(data);
      return data;
    } catch (error) {
      console.error('Failed to fetch states:', error);
      return [];
    }
  }, []);

  const fetchCities = useCallback(async (countryCode: string, stateCode: string): Promise<City[]> => {
    try {
      const data = await orchestrationNodeApi.fetchCities(countryCode, stateCode);
      setCities(data);
      return data;
    } catch (error) {
      console.error('Failed to fetch cities:', error);
      return [];
    }
  }, []);

  // ─── Hydrate country → state → city dropdowns from saved names ─────────────
  // Returns the resolved isoCodes so callers can store them in form state.

  const hydrateLocationDropdowns = useCallback(async (
    countryName: string,
    stateName: string,
    _cityName: string,
    availableCountries?: Country[]
  ): Promise<{ countryCode: string; stateCode: string }> => {
    const countryList = availableCountries ?? countries;
    const country = countryList.find(c => c.name === countryName);
    if (!country) return { countryCode: '', stateCode: '' };

    const fetchedStates = await fetchStates(country.isoCode);
    const state = fetchedStates.find((s: any) => s.name === stateName);
    if (!state) return { countryCode: country.isoCode, stateCode: '' };

    await fetchCities(country.isoCode, state.isoCode);
    return { countryCode: country.isoCode, stateCode: state.isoCode };
  }, [countries, fetchStates, fetchCities]);

  // ─── Initialize form when modal opens or node changes ──────────────────────

  useEffect(() => {
    if (!isOpen || !node) return;

    // Reset location lists when switching nodes
    if (initializedNodeIdRef.current !== node.id) {
      setStates([]);
      setCities([]);
    }

    const isNewNode = initializedNodeIdRef.current !== node.id;
    initializedNodeIdRef.current = node.id;

    const existingData = node.data.fullData;

    const initializeForm = async () => {
      // Fetch countries only once per modal session
      let availableCountries = countries;
      if (!countriesFetchedRef.current || availableCountries.length === 0) {
        availableCountries = await fetchCountries();
        countriesFetchedRef.current = true;
      }

      if (node.data.type === 'organization') {
        let currentOrgData = existingData;
        let orgDetailsData: any = {};
        const setupId = existingData?.apiId || existingData?.id;

        console.log('=== Initializing Organization Form ===');
        console.log('setupId:', setupId);
        console.log('existingData:', existingData);

        // Reset ref
        fetchedOrgDataRef.current = null;

        // Fetch latest details by ID if it exists
        if (setupId) {
          try {
            setIsLoading(true);
            // Step 1: Fetch organization setup to get org_id
            console.log('Fetching organization setup...');
            const setupRes = await orchestrationNodeApi.getOrganizationSetup(setupId);
            console.log('setupRes:', setupRes);
            const setupData = setupRes?.data ?? setupRes;
            console.log('setupData:', setupData);
            
            // Step 2: Use org_id from setup to fetch organization details
            if (setupData?.org_id) {
              try {
                console.log('Fetching organization details with org_id:', setupData.org_id);
                const orgRes = await orchestrationNodeApi.getOrganization(setupData.org_id);
                console.log('orgRes:', orgRes);
                orgDetailsData = orgRes?.data ?? orgRes;
                console.log('orgDetailsData:', orgDetailsData);
                // Merge setup hierarchy data with full organization details
                currentOrgData = { ...setupData, ...setupData.hierarchy, ...orgDetailsData };
                // Store in ref for save handler
                fetchedOrgDataRef.current = {
                  organizationId: orgDetailsData.id || setupData.org_id,
                  setupId: setupData.id,
                  fullData: currentOrgData
                };
                console.log('Set fetchedOrgDataRef.current:', fetchedOrgDataRef.current);
              } catch (err) {
                console.error('Failed to fetch organization details:', err);
                currentOrgData = { ...setupData, ...setupData.hierarchy };
                // Fallback storage
                fetchedOrgDataRef.current = {
                  organizationId: setupData.org_id,
                  setupId: setupData.id,
                  fullData: currentOrgData
                };
              }
            } else {
              currentOrgData = { ...setupData, ...setupData.hierarchy };
            }
          } catch (error) {
            console.error('Failed to fetch organization setup:', error);
          } finally {
            setIsLoading(false);
          }
        }

        const countryName = currentOrgData?.country || '';
        const stateName = currentOrgData?.state || '';
        const cityName = currentOrgData?.city || '';

        let countryCode = '';
        let stateCode = '';

        if (countryName) {
          const codes = await hydrateLocationDropdowns(countryName, stateName, cityName, availableCountries);
          countryCode = codes.countryCode;
          stateCode = codes.stateCode;
        }

        const orgName = currentOrgData?.organization_name || currentOrgData?.name || node.data.label || 'New Organization';
        const initialOrgData = {
          org_name: orgName,
          industryType: currentOrgData?.industry_type || '',
          country: countryName,
          state: stateName,
          city: cityName,
          email: currentOrgData?.email || '',
          companyId: currentOrgData?.company_id || '',
          contact: currentOrgData?.contact || '',
          zipcode: currentOrgData?.zipcode || '',
          address1: currentOrgData?.address_1 || '',
          address2: currentOrgData?.address_2 || '',
          countryCode,
          stateCode,
        };
        setName(orgName);
        setFormData(initialOrgData);
        setIsDirty(false);

      } else if (node.data.type === 'businessUnit') {
        let currentBUData = existingData;
        const buId = existingData?.apiId || existingData?.id;

        // Fetch latest business unit details by ID if it exists
        if (buId) {
          try {
            setIsLoading(true);
            const buRes = await orchestrationNodeApi.getBusinessUnit(buId);
            currentBUData = { ...currentBUData, ...(buRes?.data ?? buRes) };
          } catch (error) {
            console.error('Failed to fetch business unit details:', error);
          } finally {
            setIsLoading(false);
          }
        }

        const countryName = currentBUData?.country || '';
        const stateName = currentBUData?.state || '';
        const cityName = currentBUData?.city || '';

        let countryCode = '';
        let stateCode = '';

        if (countryName) {
          const codes = await hydrateLocationDropdowns(countryName, stateName, cityName, availableCountries);
          countryCode = codes.countryCode;
          stateCode = codes.stateCode;
        }

        const unitName = currentBUData?.business_unit_name || currentBUData?.name || node.data.label || 'New Business Unit';
        setName(unitName);
        setBusinessUnitFormData({
          unit_name: unitName,
          businessType: currentBUData?.business_type || '',
          country: countryName,
          state: stateName,
          city: cityName,
          email: currentBUData?.email || '',
          unitId: currentBUData?.company_id || currentBUData?.unit_id || '',
          contact: currentBUData?.contact || '',
          zipcode: currentBUData?.zipcode || '',
          address1: currentBUData?.address_1 || '',
          address2: currentBUData?.address_2 || '',
          countryCode,
          stateCode,
        });

      } else if (node.data.type === 'businessProcess') {
        const processName = existingData?.business_process_name || node.data.label || 'New Business Process';
        setName(processName);
        setBusinessProcessFormData({
          business_process_name: processName,
          business_process_description: existingData?.business_process_description || '',
        });

      } else if (node.data.type === 'project') {
        const projectName = existingData?.name || node.data.label || 'New Project';
        setName(projectName);
        setProjectFormData({
          name: projectName,
          project_id: existingData?.project_id || '',
          description: existingData?.description || '',
          project_team: existingData?.project_team || '',
          project_type: existingData?.project_type || '',
          project_status: existingData?.project_status !== undefined ? existingData.project_status : true,
          created_by: existingData?.created_by || '',
          perspective_ids: existingData?.perspective_ids || '',
        });

      } else {
        setName(node.data.label || '');
      }
    };

    initializeForm();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, node?.id]);

  // Reset the fetched-ref when modal fully closes so next open re-fetches cleanly
  useEffect(() => {
    if (!isOpen) {
      countriesFetchedRef.current = false;
      initializedNodeIdRef.current = null;
      fetchedOrgDataRef.current = null;
      setStates([]);
      setCities([]);
    }
  }, [isOpen]);

  // ─── Save handler ───────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!node) return;

    setIsLoading(true);
    try {
      console.log('=== Saving Organization Node ===');
      console.log('fetchedOrgDataRef.current:', fetchedOrgDataRef.current);
      console.log('node.data.fullData:', node.data.fullData);

      // Prioritize fetched data first
      const orgIdToUse = fetchedOrgDataRef.current?.organizationId || 
                         node.data.fullData?.apiId || 
                         node.data.fullData?.id;

      console.log('orgIdToUse:', orgIdToUse);
      const existingApiId = node.data.fullData?.apiId || node.data.fullData?.id;

      if (node.data.type === 'organization') {
        // Check if we have ANY organization ID (from fetch or node)
        if (orgIdToUse) {
          console.log('Calling update-organization...');
          
          const requiredFields = ['org_name', 'industryType', 'email'];
          const missingFields = requiredFields.filter(field => {
            const val = formData[field as keyof typeof formData];
            return Array.isArray(val) ? val.length === 0 : !val;
          });
          if (missingFields.length > 0) {
            toast.error(`Please fill in all required fields: ${missingFields.join(', ')}`);
            setIsLoading(false);
            return;
          }

          // Transform and update
          const updatePayload = {
            update_id: orgIdToUse.toString(),
            organization_name: formData.org_name,
            organization_description: (node.data.fullData as any)?.organization_description || fetchedOrgDataRef.current?.fullData?.organization_description || '',
            industry_type: formData.industryType,
            company_id: formData.companyId || '',
            country: formData.country,
            state: formData.state,
            city: formData.city,
            contact: formData.contact || '',
            email: formData.email,
            zipcode: formData.zipcode || '',
            address_1: formData.address1 || '',
            address_2: formData.address2 || ''
          };
          
          console.log('updatePayload:', updatePayload);

          const response = await orchestrationNodeApi.updateOrganization(updatePayload);

          if (response.status === true || response.success === true) {
            toast.success("Organization updated successfully.");
            
            // Refresh data from setup API
            const setupIdToUse = fetchedOrgDataRef.current?.setupId || orgIdToUse;
            const setupData = await orchestrationNodeApi.getOrganizationSetup(setupIdToUse);
            const refreshed = setupData?.data ?? setupData;

            onSave(node.id, {
              ...formData,
              ...refreshed,
              name: formData.org_name,
              apiId: setupIdToUse,
              apiData: refreshed ?? node.data.fullData?.apiData,
            });
          } else {
            throw new Error(response.message || 'Failed to update organization.');
          }
        } else {
          console.log('Calling create-organization...');
          
          const apiData = transformOrganizationFormToApi({ ...formData, name });
          const response = await orchestrationNodeApi.createOrganization(apiData);

          setCurrentOrganization({
            id: response.data.id.toString(),
            name: response.data.organization_name,
          });

          // Fetch org setup immediately after creation
          const setupData = await orchestrationNodeApi.getOrganizationSetup(response.data.id);
          const refreshed = setupData?.data ?? setupData;

          onSave(node.id, {
            ...formData,
            ...refreshed,
            industry_type: response.data.industry_type,
            name: response.data.organization_name,
            apiId: response.data.id,
            apiData: refreshed ?? response.data,
          });
        }

      } else if (node.data.type === 'businessUnit') {
        if (!currentOrganization?.id || !currentOrganization?.name) {
          throw new Error('Please create an organization first before creating business units');
        }

        if (existingApiId) {
          const updatePayload = {
            update_id: existingApiId.toString(),
            business_unit_name: businessUnitFormData.unit_name,
            business_unit_description: (node.data.fullData as any)?.business_unit_description || '',
            company_id: businessUnitFormData.unitId || '',
            country: businessUnitFormData.country,
            state: businessUnitFormData.state,
            city: businessUnitFormData.city,
            contact: businessUnitFormData.contact || '',
            email: businessUnitFormData.email,
            zipcode: businessUnitFormData.zipcode || '',
            address_1: businessUnitFormData.address1 || '',
            address_2: businessUnitFormData.address2 || '',
            org_id: currentOrganization.id,
            org_name: currentOrganization.name,
          };

          const response = await orchestrationNodeApi.updateBusinessUnit(updatePayload);

          if (response.status === true || response.success === true) {
            toast.success("Business unit updated successfully.");
            const refreshed = response?.data ?? response;
            onSave(node.id, {
              ...businessUnitFormData,
              ...refreshed,
              name: businessUnitFormData.unit_name,
              apiId: existingApiId,
              apiData: refreshed ?? node.data.fullData?.apiData,
            });
          } else {
            throw new Error(response.message || 'Failed to update business unit.');
          }
        } else {
          const apiData = transformBusinessUnitFormToApi(
            { ...businessUnitFormData, name },
            currentOrganization.id,
            currentOrganization.name
          );
          const response = await orchestrationNodeApi.createBusinessUnit(apiData);

          onSave(node.id, {
            ...businessUnitFormData,
            name: response.data.business_unit_name,
            apiId: response.data.id,
            apiData: response.data,
          });
        }

      } else if (node.data.type === 'businessProcess') {
        if (!currentOrganization?.id || !currentOrganization?.name) {
          throw new Error('Please create an organization first before creating business processes');
        }

        if (existingApiId) {
          onSave(node.id, {
            ...businessProcessFormData,
            name,
            apiId: existingApiId,
            apiData: node.data.fullData?.apiData,
          });
        } else {
          const apiData = transformBusinessProcessFormToApi(
            { ...businessProcessFormData, name },
            currentOrganization.id,
            currentOrganization.name
          );
          const response = await orchestrationNodeApi.createBusinessProcess(apiData);

          onSave(node.id, {
            ...businessProcessFormData,
            name: response.data.business_process_name,
            apiId: response.data.id,
            apiData: response,
          });
        }

      } else if (node.data.type === 'project') {
        if (!currentOrganization?.id) {
          throw new Error('Please create an organization first before creating projects');
        }

        if (existingApiId) {
          onSave(node.id, {
            ...projectFormData,
            name,
            apiId: existingApiId,
            apiData: node.data.fullData?.apiData,
          });
        } else {
          const apiData = transformProjectFormToApi(
            { ...projectFormData, name },
            currentOrganization.id
          );
          const response = await orchestrationNodeApi.createProject(apiData);

          onSave(node.id, {
            ...projectFormData,
            name: response.name,
            apiId: response.id,
            apiData: response,
          });
        }

      } else {
        onSave(node.id, { name });
      }
    } catch (error: any) {
      console.error('Error saving node:', error);
      toast.error(`Error saving: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Field update handlers ──────────────────────────────────────────────────

  const updateFormData = useCallback(async (
    field: keyof (OrganizationFormData & { countryCode?: string; stateCode?: string }),
    value: string
  ) => {
    setIsDirty(true);
    let newFormData: typeof formData = {
      ...formData,
      [field]: value,
      ...(field === 'country' ? { state: '', city: '', stateCode: '' } : {}),
      ...(field === 'state' ? { city: '' } : {}),
    };

    if (field === 'country' && value) {
      const country = countries.find(c => c.name === value);
      if (country) {
        newFormData.countryCode = country.isoCode;
        await fetchStates(country.isoCode);
        setCities([]);
      }
    }

    if (field === 'state' && value && formData.countryCode) {
      const state = states.find(s => s.name === value);
      if (state) {
        newFormData.stateCode = state.isoCode;
        await fetchCities(formData.countryCode, state.isoCode);
      }
    }

    setFormData(newFormData);
    if (field === 'org_name') setName(value);
  }, [formData, countries, states, fetchStates, fetchCities]);

  const updateBusinessUnitFormData = useCallback(async (
    field: keyof (BusinessUnitFormData & { countryCode?: string; stateCode?: string }),
    value: string
  ) => {
    setIsDirty(true);
    let newFormData: typeof businessUnitFormData = {
      ...businessUnitFormData,
      [field]: value,
      ...(field === 'country' ? { state: '', city: '', stateCode: '' } : {}),
      ...(field === 'state' ? { city: '' } : {}),
    };

    if (field === 'country' && value) {
      const country = countries.find(c => c.name === value);
      if (country) {
        newFormData.countryCode = country.isoCode;
        await fetchStates(country.isoCode);
        setCities([]);
      }
    }

    if (field === 'state' && value && businessUnitFormData.countryCode) {
      const state = states.find(s => s.name === value);
      if (state) {
        newFormData.stateCode = state.isoCode;
        await fetchCities(businessUnitFormData.countryCode, state.isoCode);
      }
    }

    setBusinessUnitFormData(newFormData);
    if (field === 'unit_name') setName(value);
  }, [businessUnitFormData, countries, states, fetchStates, fetchCities]);

  const updateBusinessProcessFormData = (field: keyof BusinessProcessFormData, value: string) => {
    setIsDirty(true);
    setBusinessProcessFormData(prev => ({ ...prev, [field]: value }));
    if (field === 'business_process_name') setName(value);
  };

  const updateProjectFormData = (field: keyof ProjectFormData, value: string | boolean) => {
    setIsDirty(true);
    setProjectFormData(prev => ({ ...prev, [field]: value }));
    if (field === 'name') setName(value as string);
  };

  // ─── Form renderers ─────────────────────────────────────────────────────────

  const renderOrgForm = () => (
    <div className="space-y-6 max-h-[70vh] overflow-y-auto p-1">
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="org-name">Organisation Name *</Label>
          <Input id="org-name" value={name} onChange={(e) => updateFormData('org_name', e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="company-id">Company ID</Label>
          <Input id="company-id" value={formData.companyId || ''} onChange={(e) => updateFormData('companyId', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="industry-type">Industry Type *</Label>
          <Combobox
            value={formData.industryType}
            onChange={(v) => updateFormData('industryType', v)}
            options={industryTypes.map(t => ({ label: t, value: t }))}
            placeholder="Select"
            searchPlaceholder="Search industry type..."
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email *</Label>
          <Input id="email" type="email" value={formData.email || ''} onChange={(e) => updateFormData('email', e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact">Contact Number</Label>
          <Input id="contact" value={formData.contact || ''} onChange={(e) => updateFormData('contact', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="zipcode">Zip Code</Label>
          <Input id="zipcode" value={formData.zipcode || ''} onChange={(e) => updateFormData('zipcode', e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="country">Country</Label>
          <Combobox
            value={formData.country}
            onChange={(v) => updateFormData('country', v)}
            options={countries.map(c => ({ label: c.name, value: c.name }))}
            placeholder="Select country"
            searchPlaceholder="Search country..."
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="state">State</Label>
          <Combobox
            value={formData.state}
            onChange={(v) => updateFormData('state', v)}
            options={states.map(s => ({ label: s.name, value: s.name }))}
            placeholder="Select state"
            searchPlaceholder="Search state..."
            disabled={!formData.country}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Combobox
            value={formData.city}
            onChange={(v) => updateFormData('city', v)}
            options={cities.map(c => ({ label: c.name, value: c.name }))}
            placeholder="Select city"
            searchPlaceholder="Search city..."
            disabled={!formData.state}
          />
        </div>
      </div>
    </div>
  );

  const renderBusinessUnitForm = () => (
    <div className="space-y-6 max-h-[70vh] overflow-y-auto p-1">
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="unit-name">Business Unit Name *</Label>
          <Input id="unit-name" value={name} onChange={(e) => updateBusinessUnitFormData('unit_name', e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="unit-id">Unit ID</Label>
          <Input id="unit-id" value={businessUnitFormData.unitId || ''} onChange={(e) => updateBusinessUnitFormData('unitId', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="business-type">Business Type *</Label>
          <Select value={businessUnitFormData.businessType} onValueChange={(v) => updateBusinessUnitFormData('businessType', v)}>
            <SelectTrigger className="h-10 w-full"><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>{businessTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="bu-email">Email *</Label>
          <Input id="bu-email" type="email" value={businessUnitFormData.email || ''} onChange={(e) => updateBusinessUnitFormData('email', e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bu-contact">Contact Number</Label>
          <Input id="bu-contact" value={businessUnitFormData.contact || ''} onChange={(e) => updateBusinessUnitFormData('contact', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bu-zipcode">Zip Code</Label>
          <Input id="bu-zipcode" value={businessUnitFormData.zipcode || ''} onChange={(e) => updateBusinessUnitFormData('zipcode', e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="bu-country">Country *</Label>
          <Combobox
            value={businessUnitFormData.country}
            onChange={(v) => updateBusinessUnitFormData('country', v)}
            options={countries.map(c => ({ label: c.name, value: c.name }))}
            placeholder="Select country"
            searchPlaceholder="Search country..."
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bu-state">State *</Label>
          <Combobox
            value={businessUnitFormData.state}
            onChange={(v) => updateBusinessUnitFormData('state', v)}
            options={states.map(s => ({ label: s.name, value: s.name }))}
            placeholder="Select state"
            searchPlaceholder="Search state..."
            disabled={!businessUnitFormData.country}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bu-city">City *</Label>
          <Combobox
            value={businessUnitFormData.city}
            onChange={(v) => updateBusinessUnitFormData('city', v)}
            options={cities.map(c => ({ label: c.name, value: c.name }))}
            placeholder="Select city"
            searchPlaceholder="Search city..."
            disabled={!businessUnitFormData.state}
          />
        </div>
      </div>
    </div>
  );

  const renderBusinessProcessForm = () => (
    <div className="space-y-6 max-h-[70vh] overflow-y-auto p-1">
      <div className="grid grid-cols-1 gap-4">
        <div className="space-y-2">
          <Label htmlFor="process-name">Business Process Name *</Label>
          <Input id="process-name" value={name} onChange={(e) => updateBusinessProcessFormData('business_process_name', e.target.value)} required />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4">
        <div className="space-y-2">
          <Label htmlFor="process-description">Business Process Description</Label>
          <Textarea id="process-description" rows={4} value={businessProcessFormData.business_process_description || ''} onChange={(e) => updateBusinessProcessFormData('business_process_description', e.target.value)} placeholder="Enter business process description..." />
        </div>
      </div>
      {currentOrganization && (
        <div className="bg-muted/20 p-3 rounded-lg">
          <h4 className="text-sm font-medium mb-1">Linked Organization:</h4>
          <p className="text-sm text-muted-foreground">{currentOrganization.name} (ID: {currentOrganization.id})</p>
        </div>
      )}
    </div>
  );

  const renderProjectForm = () => (
    <div className="space-y-6 max-h-[70vh] overflow-y-auto p-1">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="project-name">Project Name *</Label>
          <Input id="project-name" value={name} onChange={(e) => updateProjectFormData('name', e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="project-id">Project ID</Label>
          <Input id="project-id" value={projectFormData.project_id || ''} onChange={(e) => updateProjectFormData('project_id', e.target.value)} placeholder="PR-ID-" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="project-type">Project Type</Label>
          <Input id="project-type" value={projectFormData.project_type || ''} onChange={(e) => updateProjectFormData('project_type', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="project-team">Project Team</Label>
          <Input id="project-team" value={projectFormData.project_team || ''} onChange={(e) => updateProjectFormData('project_team', e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4">
        <div className="space-y-2">
          <Label htmlFor="project-description">Description</Label>
          <Textarea id="project-description" rows={3} value={projectFormData.description || ''} onChange={(e) => updateProjectFormData('description', e.target.value)} placeholder="Enter project description..." />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="created-by">Created By</Label>
          <Input id="created-by" value={projectFormData.created_by || ''} onChange={(e) => updateProjectFormData('created_by', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="perspective-ids">Perspective IDs</Label>
          <Input id="perspective-ids" value={projectFormData.perspective_ids || ''} onChange={(e) => updateProjectFormData('perspective_ids', e.target.value)} />
        </div>
      </div>
      {currentOrganization && (
        <div className="bg-muted/20 p-3 rounded-lg">
          <h4 className="text-sm font-medium mb-1">Linked Organization:</h4>
          <p className="text-sm text-muted-foreground">{currentOrganization.name} (ID: {currentOrganization.id})</p>
        </div>
      )}
    </div>
  );

  const renderDefaultForm = () => (
    <div className="space-y-2">
      <Label htmlFor="node-name">Name</Label>
      <Input id="node-name" value={name} onChange={(e) => {
        setName(e.target.value);
        setIsDirty(true);
      }} />
    </div>
  );

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit {node?.data.type}</DialogTitle>
          <DialogDescription>Update the details for this item.</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {node?.data.type === 'organization' ? renderOrgForm() :
            node?.data.type === 'businessUnit' ? renderBusinessUnitForm() :
              node?.data.type === 'businessProcess' ? renderBusinessProcessForm() :
                node?.data.type === 'project' ? renderProjectForm() :
                  renderDefaultForm()}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={isLoading || (node?.data.fullData?.apiId && !isDirty)}>
            {isLoading ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}