import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Zap, PlusCircle, Trash2, RefreshCw, Network } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Combobox } from '@/components/ui/combobox';
import { Label } from '@/components/ui/label';
import { EnergySectorEditor } from './EnergySectorEditor';
import { DeviceHierarchicalDashboard } from './DeviceHierarchicalDashboard';
import { getAllEnergySetups, deleteEnergySetup, getAssetMasterLocationOptions, getDomainsByLocation, getSubDomainOptions, getAssetsByLocationDomainSubdomain, type EnergySetup, type LocationOption } from '@/controllers/API/energySectorApi';
import { toast } from 'sonner';

const RenewableEnergyPage: React.FC = () => {
  const [editingSetup, setEditingSetup] = useState<EnergySetup | null>(null);
  const [showDeviceDashboard, setShowDeviceDashboard] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [allSetups, setAllSetups] = useState<EnergySetup[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [locationOptions, setLocationOptions] = useState<LocationOption[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [selectedDomain, setSelectedDomain] = useState('');
  const [selectedSubDomain, setSelectedSubDomain] = useState('');
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);
  const [domainOptions, setDomainOptions] = useState<{ value: string; label: string }[]>([]);
  const [subDomainOptions, setSubDomainOptions] = useState<{ value: string; label: string }[]>([]);
  const [isLoadingDomains, setIsLoadingDomains] = useState(false);
  const [isLoadingSubDomains, setIsLoadingSubDomains] = useState(false);
  const [isLoadingDialog, setIsLoadingDialog] = useState(false);
  const runOnce = useRef(false);

  const fetchDomainOptions = async (location: string) => {
    setIsLoadingDomains(true);
    setSubDomainOptions([]);
    setSelectedSubDomain('');
    try {
      console.log('🔄 Fetching domains for location:', location);
      const response = await getDomainsByLocation(location);
      console.log('✅ Domains API Response:', response);
      setDomainOptions(response.data || []);
    } catch (error) {
      console.error('❌ Error fetching domain options:', error);
      toast.error('Failed to load domains');
      setDomainOptions([]);
    } finally {
      setIsLoadingDomains(false);
    }
  };

  const fetchSubDomainOptions = async (location: string, domain: string) => {
    setIsLoadingSubDomains(true);
    setSelectedSubDomain('');
    try {
      console.log('🔄 Fetching sub domains for:', { location, domain });
      const response = await getSubDomainOptions(location, domain);
      console.log('✅ Sub Domains API Response:', response);
      setSubDomainOptions(response.data || []);
    } catch (error) {
      console.error('❌ Error fetching sub domain options:', error);
      toast.error('Failed to load sub domains');
      setSubDomainOptions([]);
    } finally {
      setIsLoadingSubDomains(false);
    }
  };

  const handleStartCreate = (location = '') => {
    const newId = Date.now();
    const blankSetup: any = {
      id: newId,
      domain: '',
      sub_domain: '',
      location,
    };
    setEditingSetup(blankSetup);
    setIsCreating(true);
  };

  const handleFinishEditing = () => {
    setEditingSetup(null);
    setIsCreating(false);
    refreshSetups();
  };

  const refreshSetups = async () => {
    setIsLoading(true);
    try {
      const response = await getAllEnergySetups();
      setAllSetups(response.data);
    } catch (error) {
      console.error('Error fetching energy setups:', error);
      toast.error('Failed to load energy setups');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLocationOptions = async () => {
    setIsLoadingLocations(true);
    try {
      const locations = await getAssetMasterLocationOptions();
      const processed = locations.map((loc) => ({
        id: String(loc.value ?? loc.id ?? ''),
        name: String(loc.label ?? loc.name ?? ''),
        value: String(loc.value ?? loc.id ?? ''),
        label: String(loc.label ?? loc.name ?? ''),
      }));
      setLocationOptions(processed);
    } catch (error) {
      console.error('Error fetching location options:', error);
      toast.error('Failed to load locations');
    } finally {
      setIsLoadingLocations(false);
    }
  };

  const handleOpenAddDialog = () => {
    setSelectedLocationId('');
    setSelectedDomain('');
    setSelectedSubDomain('');
    setIsAddDialogOpen(true);
  };

  const selectedLocation = locationOptions.find((loc) => loc.id === selectedLocationId);
  const locationLabel = selectedLocation
    ? `${selectedLocation.name}${selectedLocation.business_unit ? ` (${selectedLocation.business_unit})` : ''}`
    : '';

  const handleLocationChange = (value: string | number | any) => {
    const locValue = String(value);
    setSelectedLocationId(locValue);
    setSelectedDomain('');
    setSelectedSubDomain('');
    setDomainOptions([]);
    setSubDomainOptions([]);
    if (locValue) {
      // Pass location NAME to API, not ID
      const locationLabel = locationOptions.find((l) => String(l.id ?? l.value) === locValue)?.name || locValue;
      fetchDomainOptions(locationLabel);
    }
  };

  const handleDomainChange = (value: string | number | any) => {
    const domValue = String(value);
    setSelectedDomain(domValue);
    setSelectedSubDomain('');
    setSubDomainOptions([]);
    
    // Fetch sub domains when domain changes
    if (domValue && selectedLocationId) {
      const locationLabel = locationOptions.find((l) => String(l.id ?? l.value) === selectedLocationId)?.name || selectedLocationId;
      fetchSubDomainOptions(locationLabel, domValue);
    }
  };

  const handleSubDomainChange = (value: string | number | any) => {
    setSelectedSubDomain(String(value));
  };

  const handleCreateFromDialog = async () => {
    setIsLoadingDialog(true);
    try {
      const locationLabel = locationOptions.find((l) => String(l.id ?? l.value) === selectedLocationId)?.name || selectedLocationId;
      
      // Call API to get assets
      const assetsData = await getAssetsByLocationDomainSubdomain(
        locationLabel,
        selectedDomain,
        selectedSubDomain,
        false
      );

      const newId = Date.now();
      const blankSetup: any = {
        id: newId,
        domain: selectedDomain,
        sub_domain: selectedSubDomain,
        location: locationLabel,
        assets: assetsData,
      };
      setEditingSetup(blankSetup);
      setIsCreating(true);
      setIsAddDialogOpen(false);
    } catch (error) {
      console.error('Error fetching assets:', error);
      toast.error('Failed to load assets for this selection');
    } finally {
      setIsLoadingDialog(false);
    }
  };

  useEffect(() => {
    if (runOnce.current) return;
    runOnce.current = true;
    refreshSetups();
    fetchLocationOptions();
  }, []);

  const handleDeleteSetup = async (id: string) => {
    try {
      await deleteEnergySetup(id);
      toast.success('Setup deleted successfully');
      refreshSetups();
    } catch (error) {
      toast.error('Failed to delete setup');
    }
  };

  const renderCardView = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {allSetups.map((setup) => (
        <Card
          key={setup.id}
          className="relative border bg-background shadow-sm hover:shadow-md transition-shadow duration-200"
        >
          <CardContent className=" flex flex-col gap-2.5">
            {/* Header with Icon and Status Badge */}
            <div className="flex items-start justify-between">
              <div className="p-2 rounded-lg bg-muted border">
                <Zap className="h-5 w-5 text-foreground" />
              </div>
              <span className="px-2 py-0.5 text-[9px] font-semibold text-muted-foreground bg-muted border rounded uppercase tracking-wide">
                {setup.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>

            {/* Title and Location */}
            <div>
              <h3 className="text-base font-semibold text-foreground truncate mb-1">
                {setup.domain || 'Energy Setup'}
              </h3>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="truncate">{setup.location || 'Location'}</span>
              </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-2 py-1">
              <div>
                <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Sub Domain</p>
                <p className="text-xs font-semibold text-foreground truncate">
                  {setup.sub_domain || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Updated</p>
                <p className="text-xs font-semibold text-foreground">
                  {setup.updated_at ? new Date(setup.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A'}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  setEditingSetup(setup);
                  setIsCreating(false);
                }}
                variant="default"
                className="flex-1 h-8"
              >
                <span className="text-xs font-medium">View Setup</span>
                <svg className="ml-1 h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete the energy setup "{setup.domain} - {setup.sub_domain}" and all of its associated data. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleDeleteSetup(String(setup.id))}
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DeviceHierarchicalDashboard onBack={() => setShowDeviceDashboard(false)} />
{/* 
      <>
        {editingSetup ? (
        <EnergySectorEditor
          key={editingSetup.id}
          initialSetup={editingSetup}
          onClose={handleFinishEditing}
          isCreating={isCreating}
        />
      ) : showDeviceDashboard ? (
        <DeviceHierarchicalDashboard onBack={() => setShowDeviceDashboard(false)} />
      ) : (
        <Card className="h-full flex flex-col gap-0 py-2">
          <CardHeader className="px-4 [.border-b]:pb-0">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                  <Zap className="h-5 w-5" />
                  Renewable Energy Setup
                </CardTitle>
                <CardDescription>View renewable energy setups or create a new setup.</CardDescription>
              </div>
              <div className="flex gap-2 items-center">
                <Button
                  variant="outline"
                  size="default"
                  onClick={() => setShowDeviceDashboard(true)}
                  className="!h-8 !px-2"
                >
                  <Network className="mr-1 h-4 w-4" />
                  Device Hierarchical Dashboard
                </Button>
                <Button variant="outline" size="default" onClick={refreshSetups} disabled={isLoading} className="!h-8 !px-2">
                  <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                </Button>
                <Button onClick={handleOpenAddDialog} variant='outline' className='!h-8 !px-2'>
                  <PlusCircle className="mr-0 h-4 w-4" />Setup
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-grow p-2">
            {isLoading ? (
              <div className="text-center py-20 border-2 border-dashed rounded-lg h-full flex flex-col justify-center items-center">
                <RefreshCw className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4 animate-spin" />
                <h3 className="text-xl font-semibold mb-2">Loading Energy Setups...</h3>
                <p className="text-muted-foreground">
                  Fetching the latest renewable energy setups.
                </p>
              </div>
            ) : allSetups && allSetups.length > 0 ? (
              renderCardView()
            ) : (
              <div className="text-center py-20 border-2 border-dashed rounded-lg h-full flex flex-col justify-center items-center">
                <Zap className="h-20 w-20 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-xl font-semibold mb-2">No Energy Setups Found</h3>
                <p className="text-muted-foreground mb-4">
                  Click "Setup" to build your first renewable energy configuration.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      </> */}
      <DialogContent className="sm:max-w-sm">
        <DialogHeader className="space-y-2">
          <DialogTitle className="text-xl font-bold">Build New Hierarchy</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Select the structural parameters to initialize the orchestration flow
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              Select Location
            </Label>
            <Combobox
              value={selectedLocationId}
              onChange={handleLocationChange}
              options={locationOptions.map((loc) => ({
                value: loc.id,
                label: loc.business_unit ? `${loc.name} (${loc.business_unit})` : loc.name,
              }))}
              placeholder="Search or select a location"
              searchPlaceholder="Search locations..."
              isLoading={isLoadingLocations}
              emptyText="No locations found."
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              Select Domain
            </Label>
            <Combobox
              value={selectedDomain}
              onChange={handleDomainChange}
              options={domainOptions}
              placeholder={selectedLocationId ? 'Select a domain' : 'Select a location first'}
              searchPlaceholder="Search domains..."
              isLoading={isLoadingDomains}
              disabled={!selectedLocationId}
              emptyText="No domains found."
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              Select Subdomain
            </Label>
            <Combobox
              value={selectedSubDomain}
              onChange={handleSubDomainChange}
              options={subDomainOptions}
              placeholder={selectedDomain ? 'Select a subdomain' : 'Select a domain first'}
              searchPlaceholder="Search subdomains..."
              disabled={!selectedDomain}
              isLoading={isLoadingSubDomains}
              emptyText="No subdomains found."
            />
          </div>
        </div>
        <DialogFooter className="pt-4">
          <Button
            className="w-full h-10 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white font-medium"
            disabled={!selectedLocationId || !selectedDomain || !selectedSubDomain || isLoadingDialog}
            onClick={handleCreateFromDialog}
          >
            <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            {isLoadingDialog ? 'Loading...' : 'Create Hierarchy'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RenewableEnergyPage;
