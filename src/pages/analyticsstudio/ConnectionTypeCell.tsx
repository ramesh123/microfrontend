import { ConnectorIcon } from "@/pages/CredVaultPage/ConnectorIcon";

type ConnectionTypeCellProps = {
  connectionType?: string | null;
};

function formatConnectionTypeLabel(connectionType: string): string {
  return connectionType
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function ConnectionTypeCell({ connectionType }: ConnectionTypeCellProps) {
  const normalized = String(connectionType ?? "").trim();
  if (!normalized || normalized === "N/A") {
    return <span>N/A</span>;
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <ConnectorIcon
        icon={normalized}
        size="sm"
        className="!h-5 !w-5 [&_svg]:!h-4 [&_svg]:!w-4"
      />
      <span>{formatConnectionTypeLabel(normalized)}</span>
    </span>
  );
}
