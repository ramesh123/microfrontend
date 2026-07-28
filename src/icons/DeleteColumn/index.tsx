import React, { forwardRef } from "react";
import { DeleteColumnIcon } from "./delete-column";

export const DeleteColumnIconComponent = forwardRef<SVGSVGElement, React.PropsWithChildren<{ className?: string }>>(
  (props, ref) => {
    return <DeleteColumnIcon ref={ref} {...props} className={props.className} />;
  },
);