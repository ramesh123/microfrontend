import ForwardedIconComponent from "@/components/common/genericIconComponent";

export default function ToolbarSelectItem({
  value,
  icon,
  style,
  dataTestId,
  ping,
}: any) {
  return (
    <div className={`flex ${style}`} data-testid={dataTestId}>
      <ForwardedIconComponent
        name={icon}
        className={`mr-2 mt-[0.15em] h-4 w-4 ${ping && "animate-pulse text-green-500"}`}
      />
      <span>{value}</span>
    </div>
  );
}
