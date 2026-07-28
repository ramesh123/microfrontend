import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { z } from "zod";
import { useState } from "react";
import InteractiveGridPattern from "./magicui/interactive-grid-pattern";
import { motion } from "framer-motion";
import { useRbacStore } from "@/stores/useRBACStore";
import { useNavigate } from "react-router";
import { useAuth } from "@/context/auth/authContext";
import algoLogo from '@/assets/images/AlgoLogo.jpeg'
import { Eye, EyeOff } from "lucide-react";

const FormSchema = z.object({
  username: z.string().min(3, "Username is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const allowedPermissions: any = [
  {
    menu_id: "flow",
    allowed_actions: [
      "add-new-project-button",
      "edit-project-button",
      "delete-project-button",
    ],
    sub_menu: [
      {
        sub_menu_id: "add-new-project",
        allowed_actions: ["add-blank-flow-button"],
        sub_sub_menu: [
          {
            sub_sub_menu_id: "templates",
            allowed_actions: ["get-started-menu", "all-templates-menu"],
          },
          {
            sub_sub_menu_id: "usecases",
            allowed_actions: [
              "assitants-menu",
              "classification-menu",
              "coding-menu",
              "content-generation-menu",
              "qandq-menu",
            ],
          },
          {
            sub_sub_menu_id: "methodology",
            allowed_actions: ["prompting-menu", "rag-menu", "agents-menu"],
          },
        ],
      },
    ],
    menu_tab: [],
  },
  {
    menu_id: "payment",
    allowed_actions: [],
    sub_menu: [],
    menu_tab: [],
  },
  {
    menu_id: "connections",
    allowed_actions: ["add-new-source"],
    sub_menu: [
      {
        sub_menu_id: "show-databases-accordian",
        allowed_actions: ["edit-database-button", "delete-database-button"],
      },
      {
        sub_menu_id: "show-files-accordian",
        allowed_actions: [],
      },
      {
        sub_menu_id: "show-email-accordian",
        allowed_actions: [],
      },
    ],
    menu_tab: [],
  },
  {
    menu_id: "master-data",
    allowed_actions: [
      "upload-master-data-button",
      "delete-master-data-button",
      "download-master-data-button",
      "refresh-master-data-button",
    ],
    sub_menu: [
      {
        sub_menu_id: "view-master-data-file-options",
        allowed_actions: [
          "view-uploaded-file",
          "download-uploaded-file",
          "edit-uploaded-file",
          "delete-uploaded-file",
        ],
      },
    ],
    menu_tab: [],
  },
  {
    menu_id: "settings",
    allowed_actions: [],
    sub_menu: [
      { sub_menu_id: "profile", allowed_actions: [] },
      {
        sub_menu_id: "users",
        allowed_actions: ["add-user-button", "refresh-users-button"],
        table: [
          {
            table_id: "view-users",
            allowed_actions: [
              "action-column",
              "edit-user-button",
              "delete-user-button",
            ],
          },
        ],
      },
      {
        sub_menu_id: "roles",
        allowed_actions: ["add-roles-button", "refresh-roles-button"],
        table: [
          {
            table_id: "view-roles",
            allowed_actions: [
              "action-role-column",
              "edit-role-button",
              "delete-role-button",
            ],
          },
        ],
      },
      { sub_menu_id: "appearance", allowed_actions: [] },
    ],
    menu_tab: [],
  },
];

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [data, setData] = useState({
    // username: "kushal",
    // password: "kushal@123",
  });
  const { dispatch } = useAuth();
  const navigate = useNavigate();

  const { login, currentUser } = useRbacStore();
  const [showPassword, setShowPassword] = useState(false);
  const companyMainText = import.meta.env.VITE_COMPANY_MAJOR_TEXT;
  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const res: any = await login(data);
    if (res?.is_authenticated) {  
      dispatch({ type: "login", payload: { user: res, token: "" } });
      navigate("/landing");
    }
  };

  return (  
    <div className="relative flex items-center justify-center min-h-screen p-4 overflow-hidden bg-background">
      <InteractiveGridPattern />
      <motion.div
        className="z-10"
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="py-0 max-w-4xl bg-background/80 backdrop-blur-sm border-border/50 overflow-hidden">
          <CardContent className="grid p-0 md:grid-cols-2">
            <div className="p-4 md:p-8 flex flex-col justify-center">
              <form onSubmit={(e) => handleFormSubmit(e)}>
                <div className="flex flex-col gap-8">
                  <div className="flex flex-col items-center text-center">
                    {/* <img
                      src={algoLogo}
                      alt="Algo"
                      className="h-14 w-auto max-w-[min(320px,85vw)] object-contain mb-1"
                    /> */}
                    <h1 className="truncate text-base font-semibold tracking-tight text-primary sm:text-lg">
                      {companyMainText}
                    </h1>
                    <p className="text-muted-foreground text-balance">
                      Login to your workflow account
                    </p>
                  </div>
                  <div className="grid gap-2 w-80">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      type="text"
                      placeholder="Enter your username"
                      required
                      className="py-2 px-3 rounded-md border border-border focus-visible:ring-0 focus-visible:ring-offset-0"
                      onChange={(e) => setData({ ...data, username: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2 w-80">
                    <div className="flex items-center">
                      <Label htmlFor="password">Password</Label>
                      <a
                        href="#"
                        className="ml-auto text-blue-500 text-sm underline-offset-2 hover:underline"
                      >
                        Forgot your password?
                      </a>
                    </div>
                  <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        required
                        className="py-2 px-3 pr-10 rounded-md border border-border focus-visible:ring-0 focus-visible:ring-offset-0"
                        onChange={(e) =>
                          setData({ ...data, password: e.target.value })
                        }
                      />

                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowPassword((prev) => !prev)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  <Button type="submit" className="w-full">
                    Login
                  </Button>

                  {/* <div className="grid grid-cols-3 gap-4">
                    <Button variant="outline" type="button" className="w-full">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4">
                        <path
                          d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
                          fill="currentColor"
                        />
                      </svg>
                      <span className="sr-only">Login with Apple</span>
                    </Button>
                    <Button variant="outline" type="button" className="w-full">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4">
                        <path
                          d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                          fill="currentColor"
                        />
                      </svg>
                      <span className="sr-only">Login with Google</span>
                    </Button>
                    <Button variant="outline" type="button" className="w-full">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4">
                        <path
                          d="M6.915 4.03c-1.968 0-3.683 1.28-4.871 3.113C.704 9.208 0 11.883 0 14.449c0 .706.07 1.369.21 1.973a6.624 6.624 0 0 0 .265.86 5.297 5.297 0 0 0 .371.761c.696 1.159 1.818 1.927 3.593 1.927 1.497 0 2.633-.671 3.965-2.444.76-1.012 1.144-1.626 2.663-4.32l.756-1.339.186-.325c.061.1.121.196.183.3l2.152 3.595c.724 1.21 1.665 2.556 2.47 3.314 1.046.987 1.992 1.22 3.06 1.22 1.075 0 1.876-.355 2.455-.843a3.743 3.743 0 0 0 .81-.973c.542-.939.861-2.127.861-3.745 0-2.72-.681-5.357-2.084-7.45-1.282-1.912-2.957-2.93-4.716-2.93-1.047 0-2.088.467-3.053 1.308-.652.57-1.257 1.29-1.82 2.05-.69-.875-1.335-1.547-1.958-2.056-1.182-.966-2.315-1.303-3.454-1.303zm10.16 2.053c1.147 0 2.188.758 2.992 1.999 1.132 1.748 1.647 4.195 1.647 6.4 0 1.548-.368 2.9-1.839 2.9-.58 0-1.027-.23-1.664-1.004-.496-.601-1.343-1.878-2.832-4.358l-.617-1.028a44.908 44.908 0 0 0-1.255-1.98c.07-.109.141-.224.211-.327 1.12-1.667 2.118-2.602 3.358-2.602zm-10.201.553c1.265 0 2.058.791 2.675 1.446.307.327.737.871 1.234 1.579l-1.02 1.566c-.757 1.163-1.882 3.017-2.837 4.338-1.191 1.649-1.81 1.817-2.486 1.817-.524 0-1.038-.237-1.383-.794-.263-.426-.464-1.13-.464-2.046 0-2.221.63-4.535 1.66-6.088.454-.687.964-1.226 1.533-1.533a2.264 2.264 0 0 1 1.088-.285z"
                          fill="currentColor"
                        />
                      </svg>
                      <span className="sr-only">Login with Meta</span>
                    </Button>
                  </div> */}
                  {/* <div className="text-center text-sm">
                    Don&apos;t have an account?{" "}
                    <a href="#" className="underline underline-offset-4">
                      Sign up
                    </a>
                  </div> */}
                </div>
              </form>
            </div>
            <div className="bg-muted relative hidden md:block">
              <img
                src="https://img.freepik.com/free-vector/ai-technology-brain-background-vector-digital-transformation-concept_53876-117820.jpg?t=st=1746794282~exp=1746797882~hmac=9128283b549537fa6740ec9a9f007aa08b47e3aef7ee6b7d544fc0e9ca0dc7b4&w=2000"
                alt="Image"
                className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
              />
            </div>
          </CardContent>
        </Card>
        <div className="text-muted-foreground *:[a]:hover:text-primary text-center text-xs text-balance *:[a]:underline *:[a]:underline-offset-4 mt-4">
          By clicking continue, you agree to our <a href="#">Terms of Service</a>{" "}
          and <a href="#">Privacy Policy</a>.
        </div>
      </motion.div>
    </div>
  );
}
