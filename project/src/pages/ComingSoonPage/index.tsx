import { Construction } from "lucide-react";

type ComingSoonPageProps = {
  title: string;
  path?: string;
};

export default function ComingSoonPage({ title, path }: ComingSoonPageProps) {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <Construction className="h-7 w-7 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">
            This page is not available yet. Content for &ldquo;{title}&rdquo; will be added in a
            future release.
          </p>
        </div>
      </div>
    </div>
  );
}
