export const colorSchemes = [
  { value: 'blue-gradient', name: 'Blue Gradient', colors: ['#070061', '#0A0095', '#0054B4', '#006BE7', '#2289FF', '#4A9FFF', '#76B6FF', '#9DCBFF', '#BEDCFF', '#DAEBFF'] },
  { value: 'agentic-base', name: 'Agentic Theme', colors: ['#1F4E79', '#2FA39A', '#8E1F5C', '#F97316', '#3B82F6', '#14B8A6', '#A855F7', '#EF4444', '#22C55E', '#EAB308', '#06B6D4', '#F43F5E'] },
  { value: 'd3-category20c', name: 'D3 Category 20c', colors: ['#3182bd', '#6baed6', '#9ecae1', '#c6dbef', '#e6550d', '#fd8d3c', '#fdae6b', '#fdd0a2', '#31a354', '#74c476', '#a1d99b', '#c7e9c0', '#756bb1', '#9e9ac8', '#bcbddc', '#dadaeb', '#636363', '#969696', '#bdbdbd', '#d9d9d9'] },
  { value: 'd3-category10', name: 'D3 Category 10', colors: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'] },
  { value: 'd3-category20', name: 'D3 Category 20', colors: ['#1f77b4', '#aec7e8', '#ff7f0e', '#ffbb78', '#2ca02c', '#98df8a', '#d62728', '#ff9896', '#9467bd', '#c5b0d5', '#8c564b', '#c49c94', '#e377c2', '#f7b6d2', '#7f7f7f', '#c7c7c7', '#bcbd22', '#dbdb8d', '#17becf', '#9edae5'] },
  { value: 'd3-category20b', name: 'D3 Category 20b', colors: ['#393b79', '#5254a3', '#6b6ecf', '#9c9ede', '#637939', '#8ca252', '#b5cf6b', '#cedb9c', '#8c6d31', '#bd9e39', '#e7ba52', '#e7cb94', '#843c39', '#ad494a', '#d6616b', '#e7969c', '#7b4173', '#a55194', '#ce6dbd', '#de9ed6'] },
  { value: 'echarts-v4', name: 'ECharts v4.x Colors', colors: ['#c23531', '#2f4554', '#61a0a8', '#d48265', '#91c7ae', '#749f83', '#ca8622', '#bda29a', '#6e7074', '#546570', '#c4ccd3'] },
  { value: 'echarts-v5', name: 'ECharts v5.x Colors', colors: ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc'] },
  { value: 'google', name: 'Google Category', colors: ['#3366cc', '#dc3912', '#ff9900', '#109618', '#990099', '#0099c6', '#dd4477', '#66aa00', '#b82e2e', '#316395'] },
  { value: 'pastel', name: 'Pastel', colors: ['#FFB3BA', '#BAFFC9', '#BAE1FF', '#FFFFBA', '#FFDFBA', '#E0BBE4', '#FEC8C1', '#FFD3A5'] },
  { value: 'vibrant', name: 'Vibrant', colors: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'] },
  { value: 'brilliant', name: 'Brilliant Brights', colors: ['#FF1744', '#FFEA00', '#00E676', '#00B0FF', '#EA80FC', '#FF9100', '#C6FF00', '#F50057'] },
  { value: 'sunburst', name: 'Sunburst', colors: ['#FF4500', '#FFB000', '#FFD700', '#FFEC8B', '#FF69B4', '#FF8C00', '#FF007F', '#FFC300'] },
  { value: 'neon', name: 'Neon Glow', colors: ['#FF00FF', '#39FF14', '#00FFFF', '#FF3131', '#FFD000', '#7C00FE', '#00FF9C', '#FF6B00'] },
  { value: 'fluorescent', name: 'Fluorescent', colors: ['#DAFF00', '#00FF66', '#00FFD1', '#00B7FF', '#FF2E97', '#FF5F1F', '#FF007A', '#7DFF00'] },
  { value: 'candy', name: 'Candy Pop', colors: ['#FF3B3B', '#FF9F1C', '#FFEB3B', '#3DFF92', '#3DDCFF', '#7C4DFF', '#FF5ACD', '#00FFB3'] },
  { value: 'classic-retro', name: 'Classic Retro', colors: ['#dc3912', '#ff9900', '#109618', '#990099', '#0099c6', '#dd4477', '#66aa00', '#b82e2e', '#316395', '#994499', '#22aa99', '#aaaa11', '#6633cc', '#e67300', '#8b0707', '#651067', '#329262', '#5574a6', '#3b3eac'] },
];

export function ColorSchemePreview({
  colors,
  name,
  showOnlyFirst = false,
  compact = false,
}: {
  colors: string[];
  name?: string;
  showOnlyFirst?: boolean;
  compact?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-1">
        {(showOnlyFirst ? colors.slice(0, 1) : colors.slice(0, compact ? 4 : 6)).map((color, idx) => (
          <div
            key={idx}
            className={`${compact ? 'h-4 w-4' : 'h-5 w-5'} rounded-sm border border-slate-200`}
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
        {!showOnlyFirst && colors.length > (compact ? 4 : 6) && (
          <div className={`${compact ? 'h-4 w-4' : 'h-5 w-5'} rounded-sm flex items-center justify-center text-[10px] text-slate-500 bg-slate-50 border border-slate-200`}>
            +{colors.length - (compact ? 4 : 6)}
          </div>
        )}
      </div>
      {name && !compact ? <div className="text-xs text-slate-500">{name}</div> : null}
    </div>
  );
}
