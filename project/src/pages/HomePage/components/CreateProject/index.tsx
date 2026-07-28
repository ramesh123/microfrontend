import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus, Cog, Code2, X } from "lucide-react";
import { mockUsers, projectTypes } from "@/data/masterMockData";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Project } from "@/types";
import { Switch } from "@/components/ui/switch";
import CreateWorkflowDialog from "../CreateWorkflowDialog";
import { createProjectApi } from "@/controllers/API";
import { MultiSelectCombobox } from "@/components/ui/multi-select";
import { useNavigate } from "react-router";

interface CreateProjectPageProps {
  onProjectCreate?: (projectData: Omit<Project, 'id' | 'createdAt' | 'status'>) => void;
  onCancel?: () => void;
}

const projectSchema = z.object({
  name: z.string().min(1, { message: "Project name is required." }).optional(),
  description: z.string().optional(),
  project_team: z.array(z.string()).min(1, { message: "At least one team member must be selected." }),
  project_type: z.string({ required_error: "A team must be selected." }).optional(),
  // templateId: z.string({ required_error: "A template must be selected." }).optional(),
  project_status: z.boolean().optional(),
});

export default function CreateProjectPage() {
  const [showDescription, setShowDescription] = useState(false);
  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const navigate = useNavigate();


  const form = useForm<z.infer<typeof projectSchema>>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: "",
      description: "",
      project_team: [],
      project_type: "",
      project_status: true,
    },
  });

  const handleHideDescription = () => {
    form.setValue("description", "");
    setShowDescription(false);
  };

  const onCancel = () => {
    form.reset();
    setCurrentPage('dashboard');
    setCreateDialogOpen(false);
  };

  const onClickBack = () => {
    navigate('/project/templates');
  };

  const onSubmit = async (values: z.infer<typeof projectSchema>) => {
    console.log(values);
    setCreateDialogOpen(true);
    setCurrentPage('library');
    // onProjectCreate(values as Omit<Project, 'id' | 'createdAt' | 'status'>);
    const response = await createProjectApi(values);
    console.log(response);
  }

  return (
    <>
      <div className="flex-1 flex flex-col min-h-0">
        {/* Header */}
        <div className="flex items-center gap-4 p-2 pb-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClickBack}
            className="h-8 w-8"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Create New Project</h1>
            <p className="text-sm text-muted-foreground">
              Set up your new project with the details below
            </p>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto p-6">
            <Card className="shadow-none border-0 bg-transparent">
              <CardContent className="p-0">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                    {/* Project Name */}
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base font-medium">Project Name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter your project name"
                              className="h-12 text-base border-input bg-background focus-visible:ring-1 focus-visible:ring-ring"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Description Toggle */}
                    {!showDescription ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 text-muted-foreground hover:text-primary font-normal"
                        onClick={() => setShowDescription(true)}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add description (optional)
                      </Button>
                    ) : (
                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center justify-between">
                              <FormLabel className="text-base font-medium">Description</FormLabel>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-auto p-1 text-muted-foreground hover:text-destructive"
                                onClick={handleHideDescription}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                            <FormControl>
                              <Textarea
                                placeholder="A short description of the project's purpose and goals..."
                                className="resize-none min-h-[80px] text-base border-input bg-background focus-visible:ring-1 focus-visible:ring-ring"
                                rows={3}
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              Help your team understand what this project is about
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {/* Team Selection */}
                    {/* <FormField
                      control={form.control}
                      name="project_team"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base font-medium">Team Owner</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="h-12 text-base border-input bg-background focus:ring-1 focus:ring-ring">
                                <SelectValue placeholder="Select a team owner..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {mockUsers.map(user => (
                                <SelectItem key={user.id} value={user.id}>
                                  <div className="flex items-center gap-3">
                                    <Avatar className="h-6 w-6">
                                      <AvatarImage src={user.avatar} alt={user.name} />
                                      <AvatarFallback className="text-xs">
                                        {user.name.charAt(0)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span>{user.name}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Choose who will own and manage this project
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    /> */}

                    <FormField
                      control={form.control}
                      name="project_team"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Team</FormLabel>
                          <MultiSelectCombobox
                            options={mockUsers.map(user => ({ value: user.id, label: user.name }))}
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Select team members..."
                          />
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Project Type */}
                    <FormField
                      control={form.control}
                      name="project_type"
                      render={({ field }) => (
                        <FormItem className="space-y-4">
                          <FormLabel className="text-base font-medium">Project Type</FormLabel>
                          <FormControl>
                            <RadioGroup
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                              className="grid gap-3"
                            >
                              {projectTypes.map((type) => (
                                <FormItem key={type.id}>
                                  <FormControl>
                                    <RadioGroupItem value={type.id} id={type.id} className="sr-only" />
                                  </FormControl>
                                  <Label
                                    htmlFor={type.id}
                                    className={`
                                      flex items-center gap-4 p-4 border rounded-lg cursor-pointer transition-all duration-200 hover:shadow-sm
                                      ${field.value === type.id
                                        ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20'
                                        : 'border-border hover:bg-muted/30 hover:border-muted-foreground/30'
                                      }
                                    `}
                                  >
                                    <div className={`
                                      p-2 rounded-md transition-colors
                                      ${field.value === type.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}
                                    `}>
                                      <Code2 className="h-4 w-4" />
                                    </div>
                                    <div className="flex-1">
                                      <span className="font-medium text-sm">{type.name}</span>
                                      {/* Add description if available in your data */}
                                      {/* <p className="text-xs text-muted-foreground mt-1">{type.description}</p> */}
                                    </div>
                                    <div className={`
                                      w-4 h-4 rounded-full border-2 transition-colors
                                      ${field.value === type.id
                                        ? 'border-primary bg-primary'
                                        : 'border-muted-foreground/30'
                                      }
                                    `}>
                                      {field.value === type.id && (
                                        <div className="w-full h-full rounded-full bg-primary-foreground scale-50"></div>
                                      )}
                                    </div>
                                  </Label>
                                </FormItem>
                              ))}
                            </RadioGroup>
                          </FormControl>
                          <FormDescription>
                            Choose the technology stack for your project
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Project Status */}
                    <FormField
                      control={form.control}
                      name="project_status"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 bg-muted/20">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base font-medium">Enable Project</FormLabel>
                            <FormDescription className="text-sm">
                              Project will be active and accessible to team members
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              className="data-[state=checked]:bg-primary"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    {/* Action Buttons */}
                    <div className="flex items-center justify-end gap-3 pt-6 border-t">
                      <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        onClick={onCancel}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" size="lg" className="px-8">
                        Create Project
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      <CreateWorkflowDialog
        open={isCreateDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </>
  );
}
