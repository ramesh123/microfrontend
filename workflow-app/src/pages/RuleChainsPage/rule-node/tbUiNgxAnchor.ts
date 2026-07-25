/**
 * Maps this editor to ThingsBoard Angular UI (`ui-ngx`).
 *
 * @see https://github.com/thingsboard/thingsboard/tree/master/ui-ngx/src/app/modules/home/components/rule-node
 *   — `action/`, `filter/`, `enrichment/`, `external/`, `transformation/`, `flow/`, `common/` NgModules, each exporting
 *   rule-node configuration components registered at runtime.
 * @see https://github.com/thingsboard/thingsboard/blob/master/ui-ngx/src/app/modules/home/components/rule-node/rule-node-config.module.ts
 *   — aggregates those modules; constructor calls `RuleChainService.registerSystemRuleNodeConfigModule`.
 * @see https://github.com/thingsboard/thingsboard/blob/master/ui-ngx/src/app/core/http/rule-chain.service.ts
 *   — `registerSystemRuleNodeConfigModule` merges Angular `RuleNodeConfigurationComponent` types keyed by
 *   `configurationDescriptor.nodeDefinition.configDirective`; `getRuleNodeSupportedLinks` uses `relationTypes`.
 * @see https://github.com/thingsboard/thingsboard/blob/master/ui-ngx/src/app/modules/home/components/rule-node/rule-node-config.models.ts
 *   — shared enums / option maps (FetchTo, HTTP verbs, dedupe modes, etc.) used across those forms.
 *
 * This React app mirrors **configuration JSON** + **relation types** + optional **configDirective** from the
 * component descriptor API, not Angular lazy-loaded HTML/TS bundles.
 */

export const TB_UI_NGX_RULE_NODE_ROOT =
  "https://github.com/thingsboard/thingsboard/tree/master/ui-ngx/src/app/modules/home/components/rule-node";
