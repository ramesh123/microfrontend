import { TabsContent } from "@/components/ui/tabs";

import { UnavailableCard } from "./DeviceDetailTabShared";

type DevicePlaceholderTabProps = {
  value: string;
  title: string;
  body: string;
};

export function DevicePlaceholderTab({ value, title, body }: DevicePlaceholderTabProps) {
  return (
    <TabsContent value={value} className="space-y-2 pt-0.5">
      <UnavailableCard title={title} body={body} />
    </TabsContent>
  );
}
