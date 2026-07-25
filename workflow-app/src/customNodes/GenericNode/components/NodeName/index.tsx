import { memo, useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { NodeHeaderTitle } from "@/components/ui/node-header";
import { Input } from "@/components/ui/input";
import { Pencil } from "lucide-react";

interface NodeNameProps {
  name: string;
  className?: string;
  onSave?: (newName: string) => void;
}

const NodeName = memo(({ name, className, onSave }: NodeNameProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editedName, setEditedName] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditedName(name);
  }, [name]);

  const handleDoubleClick = () => {
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (editedName.trim() !== name && onSave) {
      onSave(editedName.trim());
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      inputRef.current?.blur();
    } else if (event.key === "Escape") {
      setEditedName(name);
      setIsEditing(false);
    }
  };

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  return (
    <div 
      className={cn("flex items-center gap-2 w-full relative group", className)} 
      onDoubleClick={handleDoubleClick}
      onMouseEnter={() => setShowEdit(true)}
      onMouseLeave={() => setShowEdit(false)}
    >
      {isEditing ? (
        <Input
          ref={inputRef}
          value={editedName}
          onChange={(e) => setEditedName(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className={cn(
            "!px-3 py-1 h-auto p-0 border-1 focus:ring-0 !focus-visible:ring-0 !focus-visible:ring-offset-0",
            className
          )}
        />
      ) : (
        <NodeHeaderTitle
          className={cn(
            "w-full line-clamp-1 text-sm font-medium leading-tight text-foreground",
            className
          )}
          title={name}
        >
          {name}
        </NodeHeaderTitle>
      )}
      <Pencil 
        className={`w-4 h-4 text-gray-500 cursor-pointer transition-opacity ${showEdit ? 'opacity-100' : 'opacity-0'}`} 
        onClick={() => setIsEditing(true)} 
      />
    </div>
  );
});

NodeName.displayName = "NodeName";

export default NodeName;