import { useState } from "react";
import { Eye, HelpCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TabsContent } from "@/components/ui/tabs";

/** Repository / version control settings (no tab wrapper). */
export function VersionControlSettingsCard() {
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [defaultBranch, setDefaultBranch] = useState("main");
  const [readonly, setReadonly] = useState(false);
  const [showMergeCommits, setShowMergeCommits] = useState(false);
  const [authStrategy, setAuthStrategy] = useState("PASSWORD");
  const [username, setUsername] = useState("");
  const [accessToken, setAccessToken] = useState("");

  return (
    <Card className="overflow-hidden border-border/70 shadow-sm p-0 gap-0 flex h-full min-h-0 flex-col">
      <CardHeader className="flex-row items-center justify-between px-3 py-2">
        <CardTitle className="text-sm font-semibold">Repository settings</CardTitle>
        <HelpCircle className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="min-h-0 flex-1 p-0">
        <div className="grid h-full content-start gap-2.5 overflow-y-auto border-t border-border/60 px-3 py-2 md:grid-cols-2">
          <div className="space-y-1 md:col-span-2">
            <Label className="text-xs">Repository URL*</Label>
            <Input value={repositoryUrl} onChange={(e) => setRepositoryUrl(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Default branch</Label>
            <Input value={defaultBranch} onChange={(e) => setDefaultBranch(e.target.value)} className="h-9" />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Authentication strategy</Label>
            <Select value={authStrategy} onValueChange={setAuthStrategy}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PASSWORD">Password / access token</SelectItem>
                <SelectItem value="SSH">SSH key</SelectItem>
                <SelectItem value="NONE">No authentication</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Username</Label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label className="text-xs">Password / access token</Label>
            <div className="relative">
              <Input value={accessToken} onChange={(e) => setAccessToken(e.target.value)} type="password" className="h-9 pr-10" />
              <Eye className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
            <p className="text-[11px] leading-4 text-muted-foreground">
              GitHub users must use a token instead of their password to access the repository.
            </p>
          </div>

          <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2 md:col-span-2">
            <Label className="text-xs text-muted-foreground">Options</Label>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              <div className="flex items-center gap-2">
                <Checkbox checked={readonly} onCheckedChange={(checked) => setReadonly(checked === true)} id="vc-readonly" />
                <Label htmlFor="vc-readonly" className="text-sm font-normal">
                  Readonly
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox checked={showMergeCommits} onCheckedChange={(checked) => setShowMergeCommits(checked === true)} id="vc-merge" />
                <Label htmlFor="vc-merge" className="text-sm font-normal">
                  Show merge commits
                </Label>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1 md:col-span-2">
            <Button type="button" variant="outline" size="sm" className="h-8" disabled={!repositoryUrl.trim()}>
              Check access
            </Button>
            <Button type="button" size="sm" className="h-8" disabled={!repositoryUrl.trim()}>
              Save
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function DeviceVersionControlTab() {
  return (
    <TabsContent value="version" className="mt-1 p-0 data-[state=active]:flex data-[state=active]:h-full data-[state=active]:flex-col">
      <VersionControlSettingsCard />
    </TabsContent>
  );
}
