import React, { useEffect, useState } from "react";
import { 
  MapPin, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Zap,
  Cpu,
  PlusCircle,
  Layers
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { getLocationOptions, type LocationOption } from "@/controllers/API/energySectorApi";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface LocationSelectFormProps {
  onSuccess?: (data: any) => void;
  className?: string;
}

interface InverterData {
  smbCount: number;
}

interface PCSSData {
  ups: number;
  transformer: number;
  inverterCount: number;
  inverters: InverterData[];
}

export const LocationSelectForm: React.FC<LocationSelectFormProps> = ({ onSuccess, className }) => {
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form State
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");
  const [domain, setDomain] = useState<string>("");
  const [subDomain, setSubDomain] = useState<string>("");
  const [assetName, setAssetName] = useState<string>("");
  
  // PESS State
  const [pessUps, setPessUps] = useState<number>(0);
  const [pessTransformer, setPessTransformer] = useState<number>(0);
  
  // PCSS Dynamic State
  const [pcssCount, setPcssCount] = useState<number>(0);
  const [pcssData, setPcssData] = useState<PCSSData[]>([]);

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const locations = await getLocationOptions();
        setLocations(locations);
      } catch (error) {
        console.error("Failed to fetch locations:", error);
        toast.error("Failed to load locations.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchLocations();
  }, []);

  // Update PCSS data array when pcssCount changes
  useEffect(() => {
    setPcssData(prev => {
      const newData = [...prev];
      if (pcssCount > prev.length) {
        for (let i = prev.length; i < pcssCount; i++) {
          newData.push({ ups: 0, transformer: 0, inverterCount: 0, inverters: [] });
        }
      } else if (pcssCount < prev.length) {
        return newData.slice(0, pcssCount);
      }
      return newData;
    });
  }, [pcssCount]);

  const handlePcssChange = (index: number, field: keyof PCSSData, value: any) => {
    const updated = [...pcssData];
    if (field === 'inverterCount') {
      const count = Math.max(0, Number(value));
      const currentInverters = [...updated[index].inverters];
      if (count > currentInverters.length) {
        for (let i = currentInverters.length; i < count; i++) {
          currentInverters.push({ smbCount: 0 });
        }
      } else {
        currentInverters.length = count;
      }
      updated[index] = { ...updated[index], [field]: count, inverters: currentInverters };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setPcssData(updated);
  };

  const handleInverterChange = (pcssIndex: number, inverterIndex: number, field: keyof InverterData, value: number) => {
    const updated = [...pcssData];
    const updatedInverters = [...updated[pcssIndex].inverters];
    updatedInverters[inverterIndex] = { ...updatedInverters[inverterIndex], [field]: value };
    updated[pcssIndex] = { ...updated[pcssIndex], inverters: updatedInverters };
    setPcssData(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLocationId) return toast.error("Please select a location.");
    if (!domain.trim()) return toast.error("Please enter a domain.");
    if (!subDomain.trim()) return toast.error("Please enter a sub domain.");
    if (!assetName.trim()) return toast.error("Please enter an asset name.");

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      const finalData = {
        locationId: selectedLocationId,
        domain,
        subDomain,
        assetName,
        pess: { ups: pessUps, transformer: pessTransformer },
        pcss: pcssData
      };
      toast.success("Setup completed successfully!");
      if (onSuccess) onSuccess(finalData);
    }, 1000);
  };

  const isEnabled = !!selectedLocationId;

  return (
    <Card className={cn("w-full max-w-4xl mx-auto", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl font-bold">
          <MapPin className="h-5 w-5 text-primary" />
          Energy System Configuration
        </CardTitle>
        <CardDescription>
          Select a location, specify domain and sub domain to configure your energy system setup.
        </CardDescription>
      </CardHeader>
      
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-8">
          {/* 1st: Location Selection */}
          <div className="space-y-2">
            <Label htmlFor="location-select" className="text-sm font-semibold">
              1. Location Selection*
            </Label>
            <Combobox
              options={locations.map((loc) => ({
                value: loc.id,
                label: loc.business_unit ? `${loc.name} (${loc.business_unit})` : loc.name,
              }))}
              value={selectedLocationId}
              onChange={setSelectedLocationId}
              placeholder="Choose a location to start"
              searchPlaceholder="Search locations..."
              emptyText="No location found."
              isLoading={isLoading}
              showAddButton={true}
              onAddClick={() => {
                toast.info("Add new location feature coming soon!");
              }}
              addButtonLabel="Add New Location"
              className="border-gray-200"
            />
          </div>

          <div className={cn("space-y-8 transition-all duration-300", !isEnabled && "opacity-40 pointer-events-none grayscale-[0.5]")}>
            {/* Domain */}
            <div className="space-y-2">
              <Label htmlFor="domain" className="text-sm font-semibold">2. Domain*</Label>
              <Input
                id="domain"
                placeholder="Enter domain"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                disabled={!isEnabled}
                className="border-gray-200"
              />
            </div>

            {/* Sub Domain */}
            <div className="space-y-2">
              <Label htmlFor="sub-domain" className="text-sm font-semibold">3. Sub Domain*</Label>
              <Input
                id="sub-domain"
                placeholder="Enter sub domain"
                value={subDomain}
                onChange={(e) => setSubDomain(e.target.value)}
                disabled={!isEnabled}
                className="border-gray-200"
              />
            </div>

            {/* Asset Name */}
            <div className="space-y-2">
              <Label htmlFor="asset-name" className="text-sm font-semibold">4. Asset Name*</Label>
              <Input
                id="asset-name"
                placeholder="Enter system name"
                value={assetName}
                onChange={(e) => setAssetName(e.target.value)}
                disabled={!isEnabled}
                className="border-gray-200"
              />
            </div>

            {/* PESS Box */}
            <div className="p-5 rounded-xl border bg-slate-50/50 space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-700 uppercase tracking-wider">
                <Zap className="h-4 w-4 text-amber-500" />
                PESS Configuration
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-slate-500">UPS (Number)</Label>
                  <Input 
                    type="number" 
                    value={pessUps} 
                    onChange={(e) => setPessUps(Number(e.target.value))}
                    disabled={!isEnabled}
                    className="bg-white border-slate-200"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-slate-500">Transformer (Number)</Label>
                  <Input 
                    type="number" 
                    value={pessTransformer} 
                    onChange={(e) => setPessTransformer(Number(e.target.value))}
                    disabled={!isEnabled}
                    className="bg-white border-slate-200"
                  />
                </div>
              </div>
            </div>

            {/* PCSS Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between p-2 bg-slate-100/50 rounded-lg">
                <Label className="text-sm font-bold text-slate-800">How many PCSS units?</Label>
                <Input 
                  type="number" 
                  min="0" 
                  max="10"
                  value={pcssCount} 
                  onChange={(e) => setPcssCount(Math.max(0, Number(e.target.value)))}
                  disabled={!isEnabled}
                  className="w-20 h-9 text-center font-bold bg-white"
                />
              </div>

              {/* PCSS Dynamic Grid */}
              <div className="space-y-6">
                {pcssData.map((pcss, pcssIdx) => (
                  <Card key={pcssIdx} className="border-2 border-slate-200 bg-white shadow-sm overflow-hidden">
                    <CardHeader className="p-4 bg-slate-50 border-b">
                      <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-700 uppercase">
                        <Cpu className="h-4 w-4 text-primary" />
                        PCSS {pcssIdx + 1} Configuration
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-5 space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label className="text-[11px] font-bold uppercase text-slate-400">UPS</Label>
                          <Input 
                            type="number" 
                            value={pcss.ups} 
                            onChange={(e) => handlePcssChange(pcssIdx, 'ups', Number(e.target.value))}
                            disabled={!isEnabled}
                            className="h-9 border-slate-200"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[11px] font-bold uppercase text-slate-400">Transformer</Label>
                          <Input 
                            type="number" 
                            value={pcss.transformer} 
                            onChange={(e) => handlePcssChange(pcssIdx, 'transformer', Number(e.target.value))}
                            disabled={!isEnabled}
                            className="h-9 border-slate-200"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[11px] font-bold uppercase text-primary">Inverters (Count)</Label>
                          <Input 
                            type="number" 
                            value={pcss.inverterCount} 
                            onChange={(e) => handlePcssChange(pcssIdx, 'inverterCount', e.target.value)}
                            disabled={!isEnabled}
                            className="h-9 border-primary/30 focus:border-primary"
                          />
                        </div>
                      </div>

                      {/* Inverters Dynamic Grid */}
                      {pcss.inverters.length > 0 && (
                        <div className="pt-4 border-t border-slate-100">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {pcss.inverters.map((inv, invIdx) => (
                              <div key={invIdx} className="p-4 rounded-lg border-2 border-dashed border-slate-100 bg-slate-50/30 space-y-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5 uppercase">
                                    <Layers className="h-3 w-3" />
                                    Inverter {invIdx + 1}
                                  </span>
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-[10px] font-bold text-slate-400 uppercase">SMB (Number Input)</Label>
                                  <Input 
                                    type="number" 
                                    value={inv.smbCount} 
                                    onChange={(e) => handleInverterChange(pcssIdx, invIdx, 'smbCount', Number(e.target.value))}
                                    disabled={!isEnabled}
                                    className="h-8 text-sm bg-white"
                                    placeholder="Enter SMB count"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
                
                {isEnabled && pcssCount === 0 && (
                  <div className="py-12 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-slate-400 bg-slate-50/50">
                    <PlusCircle className="h-10 w-10 mb-3 opacity-20" />
                    <p className="text-sm font-medium">Add PCSS units to begin configuration</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>

        <CardFooter className="p-6 border-t bg-slate-50/50">
          <Button 
            type="submit" 
            className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-bold transition-all shadow-lg text-base"
            disabled={isSubmitting || !isEnabled}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Processing Energy System...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-5 w-5" />
                Complete Energy System Setup
              </>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
};
