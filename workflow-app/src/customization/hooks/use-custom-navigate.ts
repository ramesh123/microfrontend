import {
  useNavigate,
  useParams,
  type NavigateFunction,
  type NavigateOptions,
  type To,
} from "react-router-dom";
import { ENABLE_CUSTOM_PARAM } from "../feature-flags";

export function useCustomNavigate(): NavigateFunction {
  const domNavigate = useNavigate();

  const { customParam } = useParams();

  function navigate(to: To | number, options?: NavigateOptions) {
    if (typeof to === "number") {
      domNavigate(to);
    } else if (typeof to === "string") {
      domNavigate(
        ENABLE_CUSTOM_PARAM && to.startsWith("/") ? `/${customParam}${to}` : to,
        options,
      );
    } else {
      domNavigate(to, options);
    }
  }

  return navigate;
}
