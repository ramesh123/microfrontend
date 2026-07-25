import * as fa from "react-icons/fa";

export const fontAwesomeIcons: any = {
  FaApple: fa.FaApple,
  FaDiscord: fa.FaDiscord,
  FaGithub: fa.FaGithub,
};

export const isFontAwesomeIcon = (name: string): boolean => {
  return name.startsWith("Fa") && fontAwesomeIcons[name as keyof typeof fontAwesomeIcons] !== undefined;
};
