import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ConnectorCardsGrid from "../CredCards";
import { ArrowLeft, Search } from "lucide-react";
import { useNavigate } from "react-router";

interface Connector {
  id: string;
  name: string;
  icon: string;
  description: string;
  display_name?: string;
  group?: string;
  enabled?: boolean;
}

const CredConnectors = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const handleFormClose = () => {
    navigate('/connection-vault/connections');
  };
  const handleConnectorSelect = (connector: Connector) => {
    // console.log(connector);
    navigate(`/connection-vault/create/${connector.id}`);
  };
  return (
    <>
      {/* Connector selection view (cards grid) */}
      <div className="min-h-screen flex flex-col">
        <div className="sticky top-0 z-10 border-b border-border bg-background/95 px-4 pb-2 pt-0 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="mx-auto flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center space-x-4">
              <Button
                onClick={handleFormClose}
                variant="ghost"
                className="flex !h-8 items-center gap-2 rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Connection Vault
              </Button>
              <div>
                <p className="text-[16px] font-semibold text-foreground">
                  Select a Data Source{" "}
                  <span className="pl-3 text-sm font-normal text-muted-foreground">
                    (Choose from available connectors to create a new connection)
                  </span>
                </p>
              </div>
            </div>
            <div className="relative w-full max-w-sm sm:w-72">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search connectors..."
                className="h-8 pl-8"
                aria-label="Search connectors"
              />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <ConnectorCardsGrid
            onConnectorSelect={handleConnectorSelect}
            searchQuery={searchQuery}
          />
        </div>
      </div>
    </>
  );
};

export default CredConnectors;
