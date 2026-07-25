// import ShadTooltip from "@/components/common/shadTooltipComponent";
// import { cn } from "@/lib/utils";
// import { memo, useEffect, useMemo, useState } from "react";
// import HandleTooltipComponent from "../handleTooltipComponent";
// import { AlgoNodeData } from "@/types/flow";
// import { Handle, Position } from "@xyflow/react";
// import useFlowStore from "@/stores/flowStore";
// import { useCallback } from "react";
// import { nodeColorsName } from "@/utils/styleUtils";
// import { useDarkStore } from "@/stores/darkStore";
// import { Workflow } from "lucide-react";

// const BASE_HANDLE_STYLES = {  
//   width: "32px",
//   height: "32px",
//   top: "50%",
//   position: "absolute" as const,
//   zIndex: 30,
//   background: "transparent",
//   border: "none",
// } as const;

// const HandleContent = memo(function HandleContent({
//   isNullHandle,
//   handleColor,
//   accentForegroundColorName,
//   isHovered,
//   openHandle,
//   testIdComplement,
//   title,
//   showNode,
//   left,
//   nodeId,
// }: {
//   isNullHandle: boolean;
//   handleColor: string;
//   accentForegroundColorName: string;
//   isHovered: boolean;
//   openHandle: boolean;
//   testIdComplement?: string;
//   title: string;
//   showNode: boolean;
//   left: boolean;
//   nodeId: string;
// }) {
//   // Restore animation effect
//   useEffect(() => {
//     if ((isHovered || openHandle) && !isNullHandle) {
//       const styleSheet = document.createElement("style");
//       styleSheet.id = `pulse-${nodeId}`;
//       styleSheet.textContent = `
//         @keyframes pulseNeon-${nodeId} {
//           0% {
//             box-shadow: 0 0 0 3px hsl(var(--node-ring)),
//                         0 0 2px ${handleColor},
//                         0 0 4px ${handleColor},
//                         0 0 6px ${handleColor},
//                         0 0 8px ${handleColor},
//                         0 0 10px ${handleColor},
//                         0 0 15px ${handleColor},
//                         0 0 20px ${handleColor};
//           }
//           50% {
//             box-shadow: 0 0 0 3px hsl(var(--node-ring)),
//                         0 0 4px ${handleColor},
//                         0 0 8px ${handleColor},
//                         0 0 12px ${handleColor},
//                         0 0 16px ${handleColor},
//                         0 0 20px ${handleColor},
//                         0 0 25px ${handleColor},
//                         0 0 30px ${handleColor};
//           }
//           100% {
//             box-shadow: 0 0 0 3px hsl(var(--node-ring)),
//                         0 0 2px ${handleColor},
//                         0 0 4px ${handleColor},
//                         0 0 6px ${handleColor},
//                         0 0 8px ${handleColor},
//                         0 0 10px ${handleColor},
//                         0 0 15px ${handleColor},
//                         0 0 20px ${handleColor};
//           }
//         }
//       `;
//       document.head.appendChild(styleSheet);

//       return () => {
//         const existingStyle = document.getElementById(`pulse-${nodeId}`);
//         if (existingStyle) {
//           existingStyle.remove();
//         }
//       };
//     }
//   }, [isHovered, openHandle, isNullHandle, nodeId, handleColor]);

//   const getNeonShadow = useCallback(
//     (color: string, isActive: boolean) => {
//       if (isNullHandle) return "none";
//       if (!isActive) return `0 0 0 3px ${color}`;
//       return [
//         "0 0 0 1px hsl(var(--border))",
//         `0 0 2px ${color}`,
//         `0 0 4px ${color}`,
//         `0 0 6px ${color}`,
//         `0 0 8px ${color}`,
//         `0 0 10px ${color}`,
//         `0 0 15px ${color}`,
//         `0 0 20px ${color}`,
//       ].join(", ");
//     },
//     [isNullHandle],
//   );
//   const contentStyle = useMemo(
//     () => ({
//       background: isNullHandle ? "hsl(var(--border))" : handleColor,
//       width: "10px",
//       height: "10px",
//       transition: "all 0.2s",
//       boxShadow: getNeonShadow(
//         accentForegroundColorName,
//         isHovered || openHandle,
//       ),
//       animation:
//         (isHovered || openHandle) && !isNullHandle
//           ? `pulseNeon-${nodeId} 1.1s ease-in-out infinite`
//           : "none",
//       border: isNullHandle ? "2px solid hsl(var(--muted))" : "none",
//     }),
//     [
//       isNullHandle,
//       handleColor,
//       getNeonShadow,
//       accentForegroundColorName,
//       isHovered,
//       openHandle,
//     ],
//   );

//   return (
//     <div
//       data-testid={`div-handle-${testIdComplement}-${title.toLowerCase()}-${
//         !showNode ? (left ? "target" : "source") : left ? "left" : "right"
//       }`}
//       className="noflow nowheel nopan noselect pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-crosshair rounded-full"
//       style={contentStyle}
//     />
//   );
// });

// const HandleRenderComponent = ({ 
//   left,
//   nodes,
//   tooltipTitle = "",
//   proxy,
//   id,
//   title,
//   edges,
//   myData,
//   colors,
//   setFilterEdge,
//   showNode,
//   testIdComplement,
//   nodeId,
//   colorName,
// }: {
//   left: boolean;
//   nodes: AlgoNodeData[];
//   tooltipTitle: string;
//   proxy: AlgoNodeData;
//   id: string;
//   title: string;
//   edges: any;
//   myData: AlgoNodeData;
//   colors: string[];
//   setFilterEdge: (edge: any) => void;
//   showNode: boolean;
//   testIdComplement: string;
//   nodeId: string;
//   colorName: string;
// }) => {
//   const [isHovered, setIsHovered] = useState(false);
//   const [openTooltip, setOpenTooltip] = useState(false);

//   const dark = useDarkStore((state) => state.dark);

//   const {
//     setHandleDragging,
//     setFilterType,
//     handleDragging,
//     filterType,
//   } = useFlowStore(
//     useCallback( 
//       (state) => ({
//         setHandleDragging: state.setHandleDragging,
//         handleDragging: state.handleDragging,
//         setFilterType: state.setFilterType,
//         filterType: state.filterType,
//       }),
//       [],
//     ),
//   );

  

//   const {
//     isNullHandle,
//     handleColor,
//     accentForegroundColorName,
//   } = useMemo(() => {
//     const sameDraggingNode = (!left ? handleDragging?.target : handleDragging?.source) === nodeId;

//     const sameFilterNode = (!left ? filterType?.target : filterType?.source) === nodeId;

//     const connectedEdge = edges.find(
//       (edge) => edge.target === nodeId && edge.targetHandle === title,
//     );

//       const connectedColor =
//       nodeColorsName[connectedEdge?.data?.sourceHandle?.output_types[0]] ||
//       "gray";
//     const isNullHandle = true; // filterPresent && !(openHandle);
    
//     // Create a Set from colorName to remove duplicates
//     const colorNameSet = new Set(colorName || []);
//     const uniqueColorCount = colorNameSet.size;
//     const firstUniqueColor = colorName && colorName.length > 0 ? colorName[0] : "";
//     const handleColorName = connectedEdge
//       ? connectedColor
//       : uniqueColorCount > 1
//         ? "secondary-foreground"
//         : "datatype-" + firstUniqueColor;
    
//     const handleColor = isNullHandle
//         ? dark
//           ? "hsl(var(--accent-gray))"
//           : "hsl(var(--accent-gray-foreground)"
//         : connectedEdge
//           ? "hsl(var(--datatype-" + connectedColor + "))"
//           : uniqueColorCount > 1
//             ? "hsl(var(--secondary-foreground))"
//             : "hsl(var(--datatype-" + firstUniqueColor + "))";
  
//       const accentForegroundColorName = connectedEdge
//         ? "hsl(var(--datatype-" + connectedColor + "-foreground))"
//         : uniqueColorCount > 1
//           ? "hsl(var(--input))"
//           : "hsl(var(--datatype-" + firstUniqueColor + "-foreground))";
//       return {
//         isNullHandle,
//         handleColor,
//         accentForegroundColorName,
//       }
//     }, []) 

//     const handleMouseDown = useCallback(
//       (event: React.MouseEvent) => { 
//         if (event.button === 0) {
//           const handleMouseUp = () => {  
//             setHandleDragging(undefined);
//             document.removeEventListener("mouseup", handleMouseUp);
//           };
//           document.addEventListener("mouseup", handleMouseUp);
//         }
//       },
//       [setHandleDragging],
//     );
  
//     const handleMouseEnter = useCallback(() => {
//       setIsHovered(true);
//     }, []);
  
//     const handleMouseLeave = useCallback(() => {
//       setIsHovered(false);
//     }, []);
  
//   return (
//     <div>
//       <ShadTooltip
//         open={openTooltip}
//         setOpen={setOpenTooltip}
//         styleClasses={cn("tooltip-fixed-width custom-scroll nowheel bottom-2")}
//         delayDuration={1000}
//         content={
//           <HandleTooltipComponent
//             isInput={left}
//             tooltipTitle={tooltipTitle}
//             isConnecting={false}
//             isCompatible={false}
//             isSameNode={false}
//             left={left}
//           />
//         }
//         side={left ? "left" : "right"}
//       >
//         <Handle
//           type={left ? "target" : "source"}
//           position={left ? Position.Left : Position.Right}
//           className={cn(
//             "bg-background group/node relative rounded-xl shadow-sm hover:shadow-md",
//             showNode ? "w-80" : "w-48", 
//           )}
//           style={BASE_HANDLE_STYLES}
//           onMouseDown={handleMouseDown}
//           onMouseEnter={handleMouseEnter}
//           onMouseLeave={handleMouseLeave}
//         >
//           <HandleContent
//             isNullHandle={true}
//             handleColor={handleColor}
//             accentForegroundColorName={accentForegroundColorName}
//             isHovered={isHovered}
//             openHandle={false}
//             testIdComplement={testIdComplement}
//             title={title}
//             showNode={showNode}
//             left={left}
//             nodeId={nodeId}
//           />
//         </Handle>
//       </ShadTooltip>
//     </div>
//   )
// }
// export default HandleRenderComponent
