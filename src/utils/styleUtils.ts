import { BotMessageSquareIcon } from "@/icons/BotMessageSquare";
import { GradientSave } from "@/icons/GradientSparkles";
import { fontAwesomeIcons, isFontAwesomeIcon } from "@/icons/fontAwesomeIcons";
import { TwitterLogoIcon } from "@radix-ui/react-icons";
import dynamicIconImports from "lucide-react/dynamicIconImports";
import { lazy } from "react";
import { FaApple, FaDiscord, FaGithub } from "react-icons/fa";

export const gradients = [
  "bg-gradient-to-br from-gray-800 via-rose-700 to-violet-900",
  "bg-gradient-to-br from-green-200 via-green-300 to-blue-500",
  "bg-gradient-to-br from-yellow-200 via-yellow-400 to-yellow-700",
  "bg-gradient-to-br from-green-200 via-green-400 to-purple-700",
  "bg-gradient-to-br from-blue-100 via-blue-300 to-blue-500",
  "bg-gradient-to-br from-purple-400 to-yellow-400",
  "bg-gradient-to-br from-red-800 via-yellow-600 to-yellow-500",
  "bg-gradient-to-br from-blue-300 via-green-200 to-yellow-300",
  "bg-gradient-to-br from-blue-700 via-blue-800 to-gray-900",
  "bg-gradient-to-br from-green-300 to-purple-400",
  "bg-gradient-to-br from-yellow-200 via-pink-200 to-pink-400",
  "bg-gradient-to-br from-green-500 to-green-700",
  "bg-gradient-to-br from-rose-400 via-fuchsia-500 to-indigo-500",
  "bg-gradient-to-br from-sky-400 to-blue-500",
  "bg-gradient-to-br from-green-200 via-green-400 to-green-500",
  "bg-gradient-to-br from-red-400 via-gray-300 to-blue-500",
  "bg-gradient-to-br from-gray-900 to-gray-600 bg-gradient-to-r",
  "bg-gradient-to-br from-rose-500 via-red-400 to-red-500",
  "bg-gradient-to-br from-fuchsia-600 to-pink-600",
  "bg-gradient-to-br from-emerald-500 to-lime-600",
  "bg-gradient-to-br from-rose-500 to-indigo-700",
  "bg-gradient-to-br bg-gradient-to-tr from-violet-500 to-orange-300",
  "bg-gradient-to-br from-gray-900 via-purple-900 to-violet-600",
  "bg-gradient-to-br from-yellow-200 via-red-500 to-fuchsia-500",
  "bg-gradient-to-br from-sky-400 to-indigo-900",
  "bg-gradient-to-br from-amber-200 via-violet-600 to-sky-900",
  "bg-gradient-to-br from-amber-700 via-orange-300 to-rose-800",
  "bg-gradient-to-br from-gray-300 via-fuchsia-600 to-orange-600",
  "bg-gradient-to-br from-fuchsia-500 via-red-600 to-orange-400",
  "bg-gradient-to-br from-sky-400 via-rose-400 to-lime-400",
  "bg-gradient-to-br from-lime-600 via-yellow-300 to-red-600",
];

/*
Specifications
#FF3276 -> #F480FF
#1A0250 -> #2F10FE
#98F4FE -> #9BFEAA
#F480FF -> #7528FC
#F480FF -> #9BFEAA
#2F10FE -> #9BFEAA
#BB277F -> #050154
#7528FC -> #9BFEAA
#2F10FE -> #98F4FE
*/
export const flowGradients = [
  "linear-gradient(90deg, #FF3276 0%, #F480FF 100%)",
  "linear-gradient(90deg, #1A0250 0%, #2F10FE 100%)",
  "linear-gradient(90deg, #98F4FE 0%, #9BFEAA 100%)",
  "linear-gradient(90deg, #F480FF 0%, #7528FC 100%)",
  "linear-gradient(90deg, #F480FF 0%, #9BFEAA 100%)",
  "linear-gradient(90deg, #2F10FE 0%, #9BFEAA 100%)",
  "linear-gradient(90deg, #BB277F 0%, #050154 100%)",
  "linear-gradient(90deg, #7528FC 0%, #9BFEAA 100%)",
  "linear-gradient(90deg, #2F10FE 0%, #98F4FE 100%)",
];

export const toolModeGradient =
  "linear-gradient(-60deg,var(--tool-mode-gradient-1) 0%,var(--tool-mode-gradient-2) 100%)";

export const swatchColors = [
  "bg-neon-fuschia text-white",
  "bg-digital-orchid text-plasma-purple",
  "bg-plasma-purple text-digital-orchid",
  "bg-electric-blue text-holo-frost",
  "bg-holo-frost text-electric-blue",
  "bg-terminal-green text-cosmic-void",
];

export const nodeColors: { [char: string]: string } = {
  inputs: "#10B981",
  outputs: "#AA2411",
  data: "#198BF6",
  prompts: "#4367BF",
  models: "#ab11ab",
  model_specs: "#6344BE",
  chains: "#FE7500",
  list: "#9AAE42",
  agents: "#903BBE",
  Olivya: "#00413B",
  tools: "#00fbfc",
  memories: "#F5B85A",
  saved_components: "#a5B85A",
  advanced: "#000000",
  chat: "#198BF6",
  thought: "#272541",
  embeddings: "#42BAA7",
  documentloaders: "#7AAE42",
  vectorstores: "#AA8742",
  vectorsearch: "#AA8742",
  textsplitters: "#B47CB5",
  toolkits: "#DB2C2C",
  wrappers: "#E6277A",
  notion: "#000000",
  Notion: "#000000",
  AssemblyAI: "#213ED7",
  assemblyai: "#213ED7",
  helpers: "#31A3CC",
  prototypes: "#E6277A",
  astra_assistants: "#272541",
  langchain_utilities: "#31A3CC",
  output_parsers: "#E6A627",
  // custom_components: "#ab11ab",
  retrievers: "#e6b25a",
  str: "#4F46E5",
  Text: "#4F46E5",
  unknown: "#9CA3AF",
  Document: "#65a30d",
  Data: "#dc2626",
  Message: "#4f46e5",
  Prompt: "#7c3aed",
  Embeddings: "#10b981",
  BaseLanguageModel: "#c026d3",
  LanguageModel: "#c026d3",
  Agent: "#903BBE",
  AgentExecutor: "#903BBE",
  Tool: "#00fbfc",
};

export const nodeColorsName: { [char: string]: string } = {
  // custom_components: "#ab11ab",
  inputs: "emerald",
  outputs: "red",
  data: "sky",
  prompts: "blue",
  models: "fuchsia",
  model_specs: "violet",
  chains: "orange",
  list: "lime",
  agents: "purple",
  tools: "cyan",
  memories: "amber",
  saved_components: "lime",
  advanced: "slate",
  chat: "sky",
  thought: "zinc",
  embeddings: "teal",
  documentloaders: "lime",
  vectorstores: "yellow",
  vectorsearch: "yellow",
  textsplitters: "fuchsia",
  toolkits: "red",
  wrappers: "rose",
  notion: "slate",
  Notion: "slate",
  AssemblyAI: "blue",
  assemblyai: "blue",
  helpers: "cyan",
  prototypes: "rose",
  astra_assistants: "indigo",
  langchain_utilities: "sky",
  output_parsers: "yellow",
  retrievers: "yellow",
  str: "indigo",
  Text: "indigo",
  unknown: "gray",
  Document: "lime",
  Data: "red",
  Message: "indigo",
  Prompt: "violet",
  Embeddings: "emerald",
  BaseLanguageModel: "fuchsia",
  LanguageModel: "fuchsia",
  Agent: "purple",
  AgentExecutor: "purple",
  Tool: "cyan",
  BaseChatMemory: "cyan",
  BaseChatMessageHistory: "orange",
  Memory: "orange",
  DataFrame: "pink",
};

export const FILE_ICONS = {
  json: {
    icon: "FileJson",
    color: "text-datatype-indigo dark:text-datatype-indigo-foreground",
  },
  csv: {
    icon: "FileChartColumn",
    color: "text-datatype-emerald dark:text-datatype-emerald-foreground",
  },
  txt: {
    icon: "FileType",
    color: "text-datatype-purple dark:text-datatype-purple-foreground",
  },
  pdf: {
    icon: "File",
    color: "text-datatype-red dark:text-datatype-red-foreground",
  },
};

export const SIDEBAR_CATEGORIES = [
  { display_name: "Saved", name: "saved_components", icon: "GradientSave" },
  { display_name: "Inputs", name: "inputs", icon: "Download" },
  { display_name: "Outputs", name: "outputs", icon: "Upload" },
  { display_name: "Prompts", name: "prompts", icon: "TerminalSquare" },
  { display_name: "Data", name: "data", icon: "Database" },
  { display_name: "Processing", name: "processing", icon: "ListFilter" },
  { display_name: "Models", name: "models", icon: "BrainCircuit" },
  { display_name: "Vector Stores", name: "vectorstores", icon: "Layers" },
  { display_name: "Embeddings", name: "embeddings", icon: "Binary" },
  { display_name: "Agents", name: "agents", icon: "Bot" },
  { display_name: "Chains", name: "chains", icon: "Link" },
  { display_name: "Loaders", name: "documentloaders", icon: "Paperclip" },
  { display_name: "Link Extractors", name: "link_extractors", icon: "Link2" },
  { display_name: "Memories", name: "memories", icon: "Cpu" },
  { display_name: "Output Parsers", name: "output_parsers", icon: "Compass" },
  { display_name: "Prototypes", name: "prototypes", icon: "FlaskConical" },
  { display_name: "Retrievers", name: "retrievers", icon: "FileSearch" },
  { display_name: "Text Splitters", name: "textsplitters", icon: "Scissors" },
  { display_name: "Toolkits", name: "toolkits", icon: "Package2" },
  { display_name: "Tools", name: "tools", icon: "Hammer" },
  { display_name: "Logic", name: "logic", icon: "ArrowRightLeft" },
  { display_name: "Helpers", name: "helpers", icon: "Wand2" },
];

export const SIDEBAR_BUNDLES = [
  { display_name: "Amazon", name: "amazon", icon: "Amazon" },
  { display_name: "Gmail", name: "gmail", icon: "Gmail" },
  {
    display_name: "Googlecalendar",
    name: "googlecalendar",
    icon: "Googlecalendar",
  },
  // Add apify
  { display_name: "Apify", name: "apify", icon: "Apify" },
  { display_name: "LangChain", name: "langchain_utilities", icon: "LangChain" },
  { display_name: "AgentQL", name: "agentql", icon: "AgentQL" },
  { display_name: "AssemblyAI", name: "assemblyai", icon: "AssemblyAI" },
  {
    display_name: "DataStax",
    name: "astra_assistants",
    icon: "AstraDB",
  },
  { display_name: "Olivya", name: "olivya", icon: "Olivya" },
  { display_name: "LangWatch", name: "langwatch", icon: "Langwatch" },
  { display_name: "Notion", name: "Notion", icon: "Notion" },
  { display_name: "Needle", name: "needle", icon: "Needle" },
  { display_name: "NVIDIA", name: "nvidia", icon: "NVIDIA" },
  { display_name: "Vectara", name: "vectara", icon: "Vectara" },
  { display_name: "Icosa Computing", name: "icosacomputing", icon: "Icosa" },
  { display_name: "Google", name: "google", icon: "Google" },
  { display_name: "CrewAI", name: "crewai", icon: "CrewAI" },
  { display_name: "NotDiamond", name: "notdiamond", icon: "NotDiamond" },
  { display_name: "Composio", name: "composio", icon: "Composio" },
  { display_name: "Cohere", name: "cohere", icon: "Cohere" },
  { display_name: "Firecrawl", name: "firecrawl", icon: "FirecrawlCrawlApi" },
  { display_name: "Unstructured", name: "unstructured", icon: "Unstructured" },
  { display_name: "Git", name: "git", icon: "GitLoader" },
  { display_name: "Confluence", name: "confluence", icon: "Confluence" },
  { display_name: "Mem0", name: "mem0", icon: "Mem0" },
  { display_name: "Youtube", name: "youtube", icon: "YouTube" },
  { display_name: "ScrapeGraph AI", name: "scrapegraph", icon: "ScrapeGraph" },
  {
    display_name: "Home Assistant",
    name: "homeassistant",
    icon: "HomeAssistant",
  },
];

export const categoryIcons: Record<string, string> = {
  saved_components: "GradientSave",
  inputs: "Download",
  outputs: "Upload",
  prompts: "TerminalSquare",
  data: "Database",
  models: "BrainCircuit",
  helpers: "Wand2",
  vectorstores: "Layers",
  embeddings: "Binary",
  agents: "Bot",
  astra_assistants: "Sparkles",
  chains: "Link",
  documentloaders: "Paperclip",
  langchain_utilities: "PocketKnife",
  link_extractors: "Link2",
  memories: "Cpu",
  output_parsers: "Compass",
  prototypes: "FlaskConical",
  retrievers: "FileSearch",
  textsplitters: "Scissors",
  toolkits: "Package2",
  tools: "Hammer",
  custom: "Edit",
  custom_components: "GradientInfinity",
};

export const nodeIconToDisplayIconMap: Record<string, string> = {
  //Category Icons
  inputs: "Download",
  outputs: "Upload",
  prompts: "TerminalSquare",
  data: "Database",
  models: "BrainCircuit",
  helpers: "Wand2",
  vectorstores: "Layers",
  embeddings: "Binary",
  agents: "Bot",
  astra_assistants: "Sparkles",
  chains: "Link",
  documentloaders: "Paperclip",
  langchain_utilities: "PocketKnife",
  link_extractors: "Link2",
  memories: "Cpu",
  output_parsers: "Compass",
  prototypes: "FlaskConical",
  retrievers: "FileSearch",
  textsplitters: "Scissors",
  toolkits: "Package2",
  tools: "Hammer",
  custom_components: "GradientInfinity",
  ChatInput: "MessagesSquare",
  ChatOutput: "MessagesSquare",
  //Integration Icons
  AIML: "AI/ML",
  AgentQL: "AgentQL",
  AirbyteJSONLoader: "Airbyte",
  AmazonBedrockEmbeddings: "AWS",
  Amazon: "AWS",
  arXiv: "ArXiv",
  assemblyai: "AssemblyAI",
  athenaIcon: "Athena",
  AzureChatOpenAi: "OpenAI",
  AzureOpenAiEmbeddings: "Azure",
  AzureOpenAiModel: "Azure",
  BaiduQianfan: "QianFanChat",
  BingSearchAPIWrapper: "Bing",
  BingSearchRun: "Bing",
  ChatAnthropic: "Anthropic",
  ChatOllama: "Ollama",
  ChatOllamaModel: "Ollama",
  ChatOpenAI: "OpenAI",
  ChatVertexAI: "VertexAI",
  ChevronsUpDownIcon: "ChevronsUpDown",
  ClearMessageHistory: "FileClock",
  CohereEmbeddings: "Cohere",
  Discord: "FaDiscord",
  ElasticsearchStore: "ElasticsearchStore",
  EverNoteLoader: "Evernote",
  ExaSearch: "Exa",
  FacebookChatLoader: "FacebookMessenger",
  FAISS: "Meta",
  FaissSearch: "Meta",
  FirecrawlCrawlApi: "Firecrawl",
  FirecrawlExtractApi: "Firecrawl",
  FirecrawlMapApi: "Firecrawl",
  FirecrawlScrapeApi: "Firecrawl",
  GitbookLoader: "GitBook",
  GoogleGenerativeAI: "GoogleGenerativeAI",
  GoogleSearchAPI: "Google",
  GoogleSearchAPIWrapper: "Google",
  GoogleSearchResults: "Google",
  GoogleSearchRun: "Google",
  GoogleSerperAPI: "Google",
  group_components: "GradientUngroup",
  HNLoader: "HackerNews",
  HuggingFaceEmbeddings: "HuggingFace",
  HuggingFaceHub: "HuggingFace",
  IFixitLoader: "IFixIt",
  ListFlows: "Group",
  MistralAI: "Mistral",
  MongoDBAtlasVectorSearch: "MongoDB",
  MongoDBChatMessageHistory: "MongoDB",
  notion: "Notion",
  NotionDirectoryLoader: "Notion",
  NotDiamond: "NotDiamond",
  Notify: "Bell",
  novita: "Novita",
  OllamaEmbeddings: "Ollama",
  OpenAIEmbeddings: "OpenAI",
  PostgresChatMessageHistory: "Postgres",
  Qdrant: "QDrant",
  RedisSearch: "Redis",
  Share3: "Share",
  Share4: "Share2",
  SlackDirectoryLoader: "Slack",
  SpiderTool: "Spider",
  SupabaseVectorStore: "Supabase",
  TavilyIcon: "Tavily",
  VertexAIEmbeddings: "VertexAI",
  WikipediaAPIWrapper: "WikipediaAPI",
  WikipediaQueryRun: "WikipediaAPI",
  WolframAlphaAPI: "Wolfram",
  WolframAlphaAPIWrapper: "Wolfram",
  WolframAlphaQueryRun: "Wolfram",

  //Node Icons
  model_specs: "FileSliders",
  advanced: "Laptop2",
  chat: "MessageCircle",
  saved_components: "GradientSave",
  vectorsearch: "TextSearch",
  wrappers: "Gift",
  unknown: "HelpCircle",
  custom: "Edit",
  ThumbDownIconCustom: "ThumbDownCustom",
  ThumbUpIconCustom: "ThumbUpCustom",
  ScrapeGraphAI: "ScrapeGraph",
  ScrapeGraphSmartScraperApi: "ScrapeGraph",
  ScrapeGraphMarkdownifyApi: "ScrapeGraph",
  note: "StickyNote",
  VirtualDB: "virtual_db",
  Minio: "minio",
  MinIO: "minio",
  min_io: "minio",
  MinioBucket: "minio",
  Signvio: "signvio",
  SIGNVIO: "signvio",
  sign_vio: "signvio",
  Signavio: "signavio",
  SIGNAVIO: "signavio",
  signavio: "signavio",
  master_data: "master_data",
};

export const getLucideIconName = (name: string): string => {
  const map: Record<string, string> = {
    AlertCircle: "circle-alert",
    AlertTriangle: "triangle-alert",
    TerminalSquare: "square-terminal",
    Wand2: "wand-sparkles",
  };
  const kebabCaseName = name
    .replace(/Icon/g, "")
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/(\d)/g, "-$1")
    .replace(/\s+/g, "-")
    .toLowerCase();
  return map[name] || kebabCaseName;
};

// Initialize icon mappings based on if we want to support lazy loading for cloud
const iconMappingsPromise = import("../icons/lazyIconImports").then(
  (module) => module.lazyIconsMapping,
);

export const eagerLoadedIconsMap: any = {
  // Custom icons
  GradientSave: GradientSave,
  BotMessageSquareIcon: BotMessageSquareIcon,

  // React icon
  FaApple: FaApple,
  FaDiscord: FaDiscord,
  FaGithub: FaGithub,
  TwitterLogoIcon: TwitterLogoIcon,
};

/** Resolved display icon key used for lookups (matches previous getNodeIcon behavior). */
const resolvedIconKey = (name: string): string =>
  nodeIconToDisplayIconMap[name] || name;

const nodeIconPromiseCache = new Map<string, Promise<any>>();

// Function to get a lazy-loaded icon component (cached per resolved icon key)
async function loadNodeIconComponent(name: string) {
  const iconKey = resolvedIconKey(name);

  if (eagerLoadedIconsMap[iconKey]) {
    return eagerLoadedIconsMap[iconKey];
  }

  if (isFontAwesomeIcon(iconKey)) {
    return fontAwesomeIcons[iconKey];
  }

  const iconMappings: any = await iconMappingsPromise;

  if (iconMappings[iconKey]) {
    return lazy(iconMappings[iconKey]);
  }

  const lucideIconName: string = getLucideIconName(iconKey);
  const iconImport = dynamicIconImports[lucideIconName as keyof typeof dynamicIconImports];

  if (iconImport) {
    try {
      return lazy(iconImport);
    } catch (e) {
      // Handle error
    }
  }

  return lazy(() =>
    Promise.resolve({
      default: () => null,
    }),
  );
}

export const getNodeIcon = (name: string) => {
  const key = resolvedIconKey(name);
  let p = nodeIconPromiseCache.get(key);
  if (!p) {
    p = loadNodeIconComponent(name);
    nodeIconPromiseCache.set(key, p);
  }
  return p;
};

/**
 * Fetches the same dynamic modules used by getNodeIcon so icon chunks are in memory
 * before nodes render (awaiting getNodeIcon alone does not load lazy chunks).
 */
export async function prefetchNodeIcon(name: string): Promise<void> {
  if (!name || typeof name !== "string") return;
  const iconKey = resolvedIconKey(name);

  if (eagerLoadedIconsMap[iconKey] || isFontAwesomeIcon(iconKey)) {
    return;
  }

  const iconMappings: any = await iconMappingsPromise;
  if (iconMappings[iconKey]) {
    await iconMappings[iconKey]();
    return;
  }

  const lucideIconName = getLucideIconName(iconKey);
  const iconImport = dynamicIconImports[lucideIconName as keyof typeof dynamicIconImports];
  if (iconImport) {
    await iconImport();
  }
}

export async function prefetchNodeIconsForWorkflow(nodes: any[]): Promise<void> {
  const icons = new Set<string>();
  for (const n of nodes || []) {
    const icon = n?.data?.icon;
    if (typeof icon === "string" && icon.length > 0) {
      icons.add(icon);
    }
  }
  await Promise.all(
    [...icons].map((icon) =>
      prefetchNodeIcon(icon).catch(() => {
        /* ignore failed optional assets */
      }),
    ),
  );
}

export const iconExists = async (name: string): Promise<boolean> => {
  const iconName: string = nodeIconToDisplayIconMap[name] || name;
  const iconMappings: any = await iconMappingsPromise;

  return !!(
    eagerLoadedIconsMap[iconName] ||
    isFontAwesomeIcon(iconName) ||
    iconMappings[iconName] ||
    dynamicIconImports[getLucideIconName(iconName) as keyof typeof dynamicIconImports]
  );
};
