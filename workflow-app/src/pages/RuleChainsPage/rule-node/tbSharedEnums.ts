/**
 * Subset of ThingsBoard `rule-node-config.models.ts` values used by our typed forms.
 * @see https://github.com/thingsboard/thingsboard/blob/master/ui-ngx/src/app/modules/home/components/rule-node/rule-node-config.models.ts
 *
 * (Plain `const` objects — no `enum` — for `erasableSyntaxOnly` compatibility.)
 */

/** `FetchTo` — where mapped data is written. */
export const TbFetchTo = {
  DATA: "DATA",
  METADATA: "METADATA",
} as const;

export type TbFetchToValue = (typeof TbFetchTo)[keyof typeof TbFetchTo];

export const tbFetchToSelectOptions: { value: TbFetchToValue; label: string }[] = [
  { value: TbFetchTo.DATA, label: "Message" },
  { value: TbFetchTo.METADATA, label: "Metadata" },
];

/** Deduplication / sampling strategy — TB `FetchMode`. */
export const TbFetchMode = {
  FIRST: "FIRST",
  LAST: "LAST",
  ALL: "ALL",
} as const;

export type TbFetchModeValue = (typeof TbFetchMode)[keyof typeof TbFetchMode];

export const tbFetchModeSelectOptions: { value: TbFetchModeValue; label: string }[] = [
  { value: TbFetchMode.FIRST, label: "First" },
  { value: TbFetchMode.LAST, label: "Last" },
  { value: TbFetchMode.ALL, label: "All" },
];

/** REST node — `HttpRequestType` in TB ui-ngx. */
export const TbHttpRequestType = {
  GET: "GET",
  POST: "POST",
  PUT: "PUT",
  DELETE: "DELETE",
  PATCH: "PATCH",
} as const;

export type TbHttpRequestTypeValue = (typeof TbHttpRequestType)[keyof typeof TbHttpRequestType];

export const tbHttpMethodSelectOptions: { value: TbHttpRequestTypeValue; label: string }[] = [
  { value: TbHttpRequestType.GET, label: "GET" },
  { value: TbHttpRequestType.POST, label: "POST" },
  { value: TbHttpRequestType.PUT, label: "PUT" },
  { value: TbHttpRequestType.DELETE, label: "DELETE" },
  { value: TbHttpRequestType.PATCH, label: "PATCH" },
];
