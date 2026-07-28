import type { AgentPlatform } from "../agentApi";

export const WIZARD_STEPS = [
  { id: 1, label: "Select OS", shortLabel: "Select OS" },
  { id: 2, label: "Generate Config", shortLabel: "Generate Config" },
  { id: 3, label: "Download Agent / Config", shortLabel: "Download Agent / Config" },
] as const;

export function getArchBadge(platform: AgentPlatform): string {
  const value = platform.value.toLowerCase();
  const arch = (platform.arch ?? "").toLowerCase();

  if (value.includes("windows")) return "WIN_X64";
  if (arch === "arm64" || value.includes("arm")) return "AARCH64";
  if (arch === "amd64" || value.includes("amd64")) return "X86_64";
  if (platform.arch) return platform.arch.toUpperCase();
  return "X86_64";
}

export function getPlatformDescription(platform: AgentPlatform): string {
  if (platform.description?.trim()) return platform.description.trim();
  const value = platform.value.toLowerCase();
  const os = (platform.os_symbol || platform.os || "").toLowerCase();
  if (os === "windows" || value.includes("windows")) {
    return "Microsoft Windows 10/11 or Server Edition for traditional IT integration.";
  }
  if (value.includes("arm")) {
    return "Optimized for ARMv8 architecture, common in Raspberry Pi and industrial IoT edge devices.";
  }
  return "Standard x86_64 architecture for enterprise servers and workstations.";
}

export type InstallGuideStep = {
  label: string;
  command: string;
};

export function getInstallGuide(platform: AgentPlatform | undefined): {
  title: string;
  steps: InstallGuideStep[];
} {
  const label = platform?.label ?? "your platform";
  const value = platform?.value.toLowerCase() ?? "";
  const binary = platform?.filename?.replace(/\.(tar\.gz|zip|exe)$/i, "") ?? "datafusion-agent";

  if (value.includes("windows")) {
    return {
      title: `Installation Guide for ${label}`,
      steps: [
        {
          label: "Run the installer",
          command: `# Run ${platform?.filename ?? "datafusion-agent-setup.exe"} as Administrator`,
        },
        {
          label: "Verify service registration",
          command: "sc query DatafusionAgent",
        },
        {
          label: "Start the agent service",
          command: "net start DatafusionAgent",
        },
      ],
    };
  }

  if (value.includes("arm")) {
    return {
      title: `Installation Guide for ${label}`,
      steps: [
        {
          label: "Move binary to path",
          command: `sudo mv ~/Downloads/${binary} /usr/local/bin/`,
        },
        {
          label: "Grant execution permissions",
          command: "chmod +x /usr/local/bin/datafusion-agent",
        },
        {
          label: "Run as service",
          command: "sudo systemctl start datafusion-agent",
        },
      ],
    };
  }

  return {
    title: `Installation Guide for ${label}`,
    steps: [
      {
        label: "Move binary to path",
        command: `sudo mv ~/Downloads/${binary} /usr/local/bin/`,
      },
      {
        label: "Grant execution permissions",
        command: "chmod +x /usr/local/bin/datafusion-agent",
      },
      {
        label: "Run as service",
        command: "sudo systemctl enable --now datafusion-agent",
      },
    ],
  };
}

export function isRecommendedPlatform(platform: AgentPlatform): boolean {
  return platform.value.toLowerCase().includes("linux-arm64");
}

export function getConfigInstallSteps(
  filename: string,
  platform: AgentPlatform | undefined,
): string[] {
  const isWindows = platform?.value.toLowerCase().includes("windows");
  if (isWindows) {
    return [
      `# 1. Download the JSON configuration file`,
      `# 2. Copy the file to the agent config directory`,
      `copy ${filename} "C:\\Program Files\\Datafusion\\Agent\\config\\"`,
      `# 3. Restart the agent service`,
      `net stop DatafusionAgent && net start DatafusionAgent`,
    ];
  }
  return [
    `# 1. Download the JSON configuration file`,
    `# 2. Transfer the file to your edge gateway device`,
    `mv ${filename} /opt/datafusion/agent/config/`,
    `# 3. Restart the agent service`,
    `systemctl restart datafusion-agent`,
  ];
}
