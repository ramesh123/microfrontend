// import { useQuery } from "@tanstack/react-query";
// import axios from "axios";
// import { FetchAPIParams, Option } from "@/types/form";
// import useFlowStore from "@/stores/flowStore";


// export function useFetchDropdownOptions(
//   fetchConfig: FetchAPIParams,
//   enabled: boolean,
//   formValues: Record<string, string>
// ) {
//   const queryKey = [
//     "dropdown-options",
//     fetchConfig.module,
//     fetchConfig.klass,
//     JSON.stringify(fetchConfig.params),
//     // JSON.stringify(formValues)
//     formValues
//   ];

//   const currentNodeId = useFlowStore.getState().current_node_id;
//   const currentNodeData: any = useFlowStore.getState().nodes.find((node) => node.id === currentNodeId);

//   console.log("Current node:", currentNodeData);
//   return useQuery<Option[]>({
//     queryKey,
//     queryFn: async () => {
//       const { klass, method, module, params } = fetchConfig;
//       const url = `/api/${module}/${klass}`;

//       // Get the payload from params or create empty one
//       const basePayload = params?.payload || {};

//       // Helper function to process placeholders in an object
//       // const processPlaceholders = (obj: Record<string, any>) => {
//       //   const result = { ...obj };
//       //   Object.entries(obj).forEach(([key, value]) => {
//       //     if (typeof value === 'string' && value.includes('{{')) {
//       //       // Check for placeholder in string values
//       //       Object.entries(formValues).forEach(([formKey, formValue]) => {
//       //         if (value.includes(`{{${formKey}}}`)) { // || value.includes("")
//       //           result[key] = formValue;
//       //         }
//       //       });
//       //     } else if (value && typeof value === 'object') {
//       //       // Recursively process nested objects
//       //       result[key] = processPlaceholders(value);
//       //     }
//       //   });
//       //   return result;
//       // };

//       const processPlaceholders = (obj: Record<string, any>) => {
//         const result = { ...obj };

//         Object.entries(obj).forEach(([key, value]) => {
//           if (typeof value === 'string' && value.includes('{{')) {
//             // Replace all {{placeholders}} inside the string
//             result[key] = value.replace(/{{(.*?)}}/g, (_, match) => {
//               const formValue = formValues[match];

//               // Convert arrays or objects to JSON string
//               if (Array.isArray(formValue) || typeof formValue === 'object') {
//                 return JSON.stringify(formValue);
//               }

//               return formValue !== undefined ? formValue : '';
//             });
//           } else if (value && typeof value === 'object') {
//             result[key] = processPlaceholders(value); // Recursive call
//           }
//         });

//         return result;
//       };

//       // Process the entire payload including nested data object
//       const updatedPayload = processPlaceholders(basePayload);

//       // Create final params with updated payload
//       const updatedParams = {
//         ...params,
//         payload: updatedPayload
//       };

//       console.log('Base payload:', basePayload);
//       console.log('Form values:', formValues);
//       console.log('Updated payload:', updatedPayload);

//       console.log('Fetching with params:', updatedParams);

//       try {
//         const response = method === "post"
//           ? await axios.post(url, updatedParams)
//           : await axios.get(url, { params: updatedParams });

//         console.log("API Response:", response.data);

//         if (response.data?.data) {
//           return response.data.data.map((item: any) => ({
//             label: item.label || item.name || item,
//             value: item.value || item.id || item,
//           }));
//         }
//         return [];
//       } catch (error) {
//         console.error('API Error:', error);
//         throw error;
//       }
//     },
//     enabled: enabled && !!fetchConfig.module && !!fetchConfig.klass,
//     staleTime: 0, // Don't cache the results
//     refetchOnWindowFocus: false,
//     refetchOnMount: false,
//     retry: 1
//   });
// }










import { useQuery } from "@tanstack/react-query";
import api from "@/controllers/API/api";
import { FetchAPIParams, Option } from "@/types/form";
import useFlowStore from "@/stores/flowStore";
import { resolveDatabaseActionsKlass } from "@/utils/sapNodeActions";

export function useFetchDropdownOptions(
  fetchConfig: FetchAPIParams,
  enabled: boolean,
  formValues: Record<string, any>
) {
  const queryKey = [
    "dropdown-options",
    fetchConfig.module,
    fetchConfig.klass,
    JSON.stringify(fetchConfig.params),
    formValues
  ];

  // Helper: Replace {{placeholder}} with values from formValues
  const processPlaceholders = (obj: Record<string, any>): Record<string, any> => {
    const result: Record<string, any> = { ...obj };

    Object.entries(obj).forEach(([key, value]) => {
      if (typeof value === "string" && value.includes("{{")) {
        result[key] = value.replace(/{{(.*?)}}/g, (_, match) => {
          const val = formValues[match];

          // Convert array or object to string if needed
          if (Array.isArray(val) || typeof val === "object") {
            return JSON.stringify(val ?? "");
          }

          return val ?? "";
        });
      } else if (value && typeof value === "object") {
        result[key] = processPlaceholders(value); // recursive
      }
    });

    return result;
  };

  return useQuery<Option[]>({
    queryKey,
    queryFn: async () => {
      const { klass, method, module, params } = fetchConfig;
      const resolvedKlass = resolveDatabaseActionsKlass(klass);
      const url = `/${module}/${resolvedKlass}`;

      let requestBody: Record<string, unknown>;
      if (!params) {
        requestBody = {};
      } else if (Object.prototype.hasOwnProperty.call(params, "payload")) {
        const basePayload = (params as { payload?: Record<string, unknown> }).payload || {};
        const mergedPayload = {
          ...basePayload,
          ...formValues,
        };
        const updatedPayload = processPlaceholders(mergedPayload);
        requestBody = {
          ...params,
          payload: updatedPayload,
        };
      } else {
        requestBody = processPlaceholders({ ...params });
      }

      try {
        const response =
          method === "post"
            ? await api.post(url, requestBody)
            : await api.get(url, { params: requestBody });

        if (response.data?.data) {
          return response.data.data.map((item: any) => ({
            label: item.label || item.name || item,
            value: item.value || item.id || item
          }));
        }

        return [];
      } catch (error) {
        console.error("API Fetch Error:", error);
        throw error;
      }
    },
    enabled: enabled && !!fetchConfig.module && !!fetchConfig.klass,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 1
  });
}
