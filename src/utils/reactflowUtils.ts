import { DESCRIPTIONS } from "@/flow_constants";
import { useIdStore } from "@/stores/idStore";
import { AlgoNodeData } from "@/types/flow";
// import { AllNodeType, EdgeType, FlowType } from "@/types/flow";
import { ReactFlowJsonObject } from "@xyflow/react";
import ShortUniqueId from "short-unique-id";
const uid = new ShortUniqueId();

  // export const createNewFlow = (
  //   flowData: ReactFlowJsonObject<AllNodeType, EdgeType>,
  //   workflowId: string,
  //   flow?: FlowType,
  // ) => {
  //   const id = uid.randomUUID(5);
  //   return {
  //     description: flow?.description ?? getRandomDescription(),
  //     name: flow?.name ? flow.name : "Untitled document",
  //     data: flowData,
  //     id: id,
  //     icon: flow?.icon ?? undefined,
  //     workflowId: workflowId,
  //   };
  // };

  export function getRandomElement<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }

  export function getRandomDescription(): string {
    return getRandomElement(DESCRIPTIONS);
  }


  export function GetProjectEditedTime(updatedAt: string) {
    const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

    const updatedDate = new Date(updatedAt);
    const now = new Date();

    let diffInSeconds = Math.floor(
      (now.getTime() - updatedDate.getTime()) / 1000
    );
    if (diffInSeconds <= 0) {
      return "Edited just now";
    }

    const units = [
      { name: "year", seconds: 31536000 },
      { name: "month", seconds: 2592000 },
      { name: "day", seconds: 86400 },
      { name: "hour", seconds: 3600 },
      { name: "minute", seconds: 60 },
      { name: "second", seconds: 1 },
    ];
    for (const unit of units) {
      if (diffInSeconds >= unit.seconds) {
        const value = -Math.floor(diffInSeconds / unit.seconds);
        return `Edited ${rtf.format(
          value,
          unit.name as Intl.RelativeTimeFormatUnit
        )}`;
      }
    }

    return `Edited ${updatedDate.toLocaleDateString()}`;
  }

  // Generate truly unique node IDs using timestamp and random string
  export function getNodeId(nodeType: string) {
    const timestamp = Date.now();
    const randomSuffix = uid.randomUUID(4);
    return `${nodeType}_${timestamp}_${randomSuffix}`;
  }

  export function buildPositionDictionary(nodes: AlgoNodeData[]) {
    const positionDictionary = {};
    nodes.forEach((node) => {
      positionDictionary[node.position.x] = node.position.y;
    });
    return positionDictionary;
  }
