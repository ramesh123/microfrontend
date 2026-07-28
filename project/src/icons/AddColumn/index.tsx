import React, { forwardRef } from "react";
import { AddColumnIcon } from "./add-column";

export const AddColumnIconComponent = forwardRef<SVGSVGElement, React.PropsWithChildren<{ className?: string }>>(
  (props, ref) => {
    return <AddColumnIcon ref={ref} {...props} className={props.className} />;
  },
);